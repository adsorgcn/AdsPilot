#!/usr/bin/env python3
"""Produce review-only threshold proposals from local reports and a read-only ledger."""
import argparse
from collections import Counter, defaultdict
from contextlib import closing
from datetime import date, datetime, timezone
import json
import math
import os
from pathlib import Path
import sqlite3
import sys
import tempfile

import judge

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "core/selfcheck"))
from acceptance import ledger_path
from validate import load_schema, validate


def numeric_parameters(params, prefix=""):
    for key, value in params.items():
        path = prefix + key
        if isinstance(value, dict):
            yield from numeric_parameters(value, path + ".")
        elif type(value) in (int, float):
            yield path, value


def observed_lag(event, click):
    if not event or not click:
        return None
    def parse(stamp):
        value = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    seconds = (parse(event) - parse(click)).total_seconds()
    return math.ceil(seconds / 86400) if seconds >= 0 else None


def observed_spend(traffic):
    # Overlapping report windows describe the same account/day. The newest version wins.
    snapshots = {}
    for rep in traffic:
        daily = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))
        for row in rep["rows"]:
            values = daily[row["date"]][row.get("campaign_id") or row["campaign"]]
            values[0] += row["cost"]
            values[1] += row.get("conversions", 0)
        for day, campaigns in daily.items():
            snapshots[(rep.get("account", ""), day)] = campaigns
    cumulative, reached, samples = defaultdict(float), set(), []
    for (account, _day), campaigns in sorted(snapshots.items()):
        for campaign, (cost, conversions) in campaigns.items():
            key = (account, campaign)
            if key in reached:
                continue
            cumulative[key] += cost
            if conversions > 0:
                samples.append(round(cumulative[key], 2))
                reached.add(key)
    return samples


def percentile90(values):
    return sorted(values)[math.ceil(0.90 * len(values)) - 1]


def fx_ratio(rates, source, target):
    if not isinstance(rates, dict):
        return None
    pair = [rates.get(code) for code in (source, target)]
    if any(type(value) not in (int, float) or not math.isfinite(value) or value <= 0 for value in pair):
        return None
    return pair[1] / pair[0]


def select_rate(directory, report, unit, reference):
    currency = report["summary"]["currency"]
    if currency == unit:
        return 1.0, "same_currency"
    snapshot = directory / "fx.json"
    if snapshot.is_file():
        state = json.loads(snapshot.read_text(encoding="utf-8"))
        if (state.get("run_id"), state.get("reported_at"), state.get("currency")) != (
                report["run_id"], report["reported_at"], currency):
            return None, "snapshot_does_not_match_report"
        rate = fx_ratio(state.get("fx"), currency, unit)
        if rate is not None:
            return rate, "per_run_configuration"
    rate = fx_ratio(reference, currency, unit)
    return (rate, "reference_configuration") if rate is not None else (None, "missing_currency_pair")


def proposals(folder, ledger, soul_file, reference=None):
    soul = judge.load_soul(str(soul_file))
    reports = []
    fixture = (folder / ".adspilot-simulation.json").is_file()
    for path in folder.glob("*/report.json"):
        report = json.loads(path.read_text(encoding="utf-8"))
        if validate(load_schema("report.schema.json"), report) or report["run_id"] != path.parent.name:
            raise ValueError("invalid run report")
        if report.get("soul") != soul["id"] or report.get("exit_code") not in (0, 2):
            continue
        fixture |= any(e["id"] == "fixture-simulation" for e in report["evidence"])
        reports.append((report["reported_at"], path.parent, report))
    if not reports:
        raise ValueError("no completed reports for the selected SOUL")
    ids = {r["run_id"] for _, _, r in reports}
    with closing(sqlite3.connect(ledger.resolve().as_uri() + "?mode=ro", uri=True)) as con:
        ledger_ids = {row[0] for row in con.execute("SELECT run_id FROM runs WHERE exit_code IN (0,2)")}
        if not ids <= ledger_ids:
            raise ValueError("run reports disagree with the specified ledger")
        lags = []
        for batch, event, click in con.execute("SELECT batch,event_time,click_time FROM conversions"):
            if batch in ids:
                lag = observed_lag(event, click)
                if lag is not None:
                    lags.append(lag)
    traffic = []
    used_fx, skipped_fx = Counter(), Counter()
    for _stamp, directory, report in sorted(reports):
        path = directory / "traffic-report.json"
        if not path.is_file():
            continue
        item = json.loads(path.read_text(encoding="utf-8"))
        if validate(load_schema("traffic-report.schema.json"), item):
            raise ValueError("invalid traffic report")
        if item.get("currency") != report["summary"]["currency"]:
            skipped_fx["traffic_and_run_currency_disagree"] += 1
            continue
        ratio, basis = select_rate(directory, report, soul["money_unit"], reference)
        if ratio is None:
            skipped_fx[basis] += 1
            continue
        for row in item["rows"]:
            row["cost"] *= ratio
        used_fx[basis] += 1
        traffic.append(item)
    spend = observed_spend(traffic)
    methods = {
        "stop_loss.spend_no_conversion": (spend, "系列从观测窗口首日到首个有转化日的累计花费 P90（SOUL 币种），仅含观察到转化的系列"),
        "conversion.window_days": (lags, "匹配本轮账本的转化延迟天数 P90，向上取整并限制在 1..90，历史窗口可能截断长尾"),
    }
    result = []
    for key, current in numeric_parameters(soul["params_usd"]):
        values, basis = methods.get(key, ([], "报告和账本缺少可独立评估此阈值的结果标签，保留现值"))
        proposed = current
        if values:
            proposed = percentile90(values)
            if key == "conversion.window_days":
                proposed = min(90, max(1, proposed))
        elif key in methods:
            basis += "；无匹配样本，保留现值"
        result.append({"parameter": key, "current": current, "suggested": proposed, "samples": len(values), "basis": basis})
    return {"type": "adspilot.calibration.proposal", "proposal_only": True, "soul": soul["id"],
            "evidence": "fixture-simulation" if fixture else "local-records",
            "reports": len(reports), "thresholds": result, "money_unit": soul["money_unit"],
            "fx": {"used_reports": dict(used_fx), "skipped_reports": sum(skipped_fx.values()),
                   "skip_reasons": dict(skipped_fx)}}


def save(folder, result):
    target = folder / ("calibration-" + date.today().isoformat() + ".json")
    if target.is_symlink():
        raise ValueError("refusing symlink output")
    if target.exists():
        previous = json.loads(target.read_text(encoding="utf-8"))
        if not isinstance(previous, dict) or previous.get("type") != result["type"]:
            raise ValueError("a different file occupies the calibration output path")
    with tempfile.NamedTemporaryFile(mode="w", dir=str(folder), encoding="utf-8", delete=False) as temp:
        tmp = Path(temp.name)
        try:
            json.dump(result, temp, indent=2, ensure_ascii=False, allow_nan=False)
            temp.write("\n")
            temp.close()
            os.replace(tmp, target)
        finally:
            if tmp.exists():
                tmp.unlink()
    return target


def selftest():
    sys.path.insert(0, str(ROOT / "core/ledger"))
    import subid
    fixtures = ROOT / "tests/fixtures"
    with tempfile.TemporaryDirectory() as name:
        folder = Path(name)
        run_id = "sample-calibration"
        run_dir = folder / run_id
        run_dir.mkdir()
        soul = ROOT / "soul/default.soul.md"
        original = soul.read_bytes()
        expected = dict(numeric_parameters(judge.load_soul(str(soul))["params_usd"]))
        report = json.loads((fixtures / "calibration.report.json").read_text(encoding="utf-8"))
        (run_dir / "report.json").write_text(json.dumps(report), encoding="utf-8")
        db = folder / "ledger.db"
        with closing(subid.open_db(str(db))) as con:
            con.execute("INSERT INTO runs(run_id,exit_code) VALUES (?,0)", (run_id,))
            samples = json.loads((fixtures / "commissions.cj.json").read_text(encoding="utf-8"))["rows"][:2]
            for i, row in enumerate(samples):
                con.execute("INSERT INTO conversions(event_id,batch,event_time,click_time,created_at) VALUES (?,?,?,?,?)",
                            (str(i), run_id, row["event_time"], row["click_time"], row["event_time"]))
            con.commit()
        before = db.read_bytes()
        result = proposals(folder, db, soul)
        output = save(folder, result)
        rows = {row["parameter"]: row for row in json.loads(output.read_text(encoding="utf-8"))["thresholds"]}
        assert set(rows) == set(expected)
        assert rows["conversion.window_days"]["samples"] == 2 and rows["conversion.window_days"]["suggested"] == 2
        assert db.read_bytes() == before and soul.read_bytes() == original
        assert rows["authority.within_caps"]["samples"] == 0
        assert rows["authority.within_caps"]["suggested"] == expected["authority.within_caps"]
        print("calibration selftest: thresholds=%d matched_lags=2 proposal_only=true" % len(rows))
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs-dir", type=Path, default=ROOT / "runs")
    parser.add_argument("--ledger", type=Path)
    parser.add_argument("--config", type=Path, help="reference FX for historical reports without a rate snapshot")
    parser.add_argument("--soul", type=Path, default=ROOT / "soul/default.soul.md")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()
    if args.selftest:
        return selftest()
    try:
        db = ledger_path(args.runs_dir, args.ledger)
        reference = json.loads(args.config.read_text(encoding="utf-8")).get("fx") if args.config else None
        result = proposals(args.runs_dir, db, args.soul, reference)
        path = save(args.runs_dir, result)
        print("只生成建议：%d 份报告，%d 项阈值。%s" % (result["reports"], len(result["thresholds"]), path), file=sys.stderr)
        print(json.dumps({"proposal": str(path), "evidence": result["evidence"]}))
    except (OSError, ValueError, KeyError, TypeError, sqlite3.Error) as error:
        print("calibration failed: %s" % error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
