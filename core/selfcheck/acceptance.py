"""Judge the latest seven ledger dates against the loop's published ACCEPT."""
from collections import Counter
from contextlib import closing
from datetime import date, datetime, timedelta
import json
from pathlib import Path
import re
import sqlite3
import sys

from validate import load_schema, validate

ROOT = Path(__file__).resolve().parents[2]
RUN_ID = re.compile(r"[A-Za-z0-9._-]{4,64}\Z")
ALLOWED_REASONS = {"kyc", "payment", "appeal"}


def ledger_path(folder, explicit):
    if explicit:
        return Path(explicit)
    if (folder / ".adspilot-simulation.json").is_file():
        return folder / "data/ledger.db"
    config_file = ROOT / "config/adspilot.json"
    if config_file.is_file():
        config = json.loads(config_file.read_text(encoding="utf-8"))
        if (ROOT / config.get("runs_dir", "runs")).resolve() == folder.resolve():
            return ROOT / config.get("data_dir", "data") / "ledger.db"
    return folder.parent / "data/ledger.db"


def read_report(folder, run_id, code, start, finish, schema):
    if not isinstance(run_id, str) or not RUN_ID.fullmatch(run_id):
        raise ValueError("invalid ledger run id")
    report_file = folder / run_id / "report.json"
    if report_file.parent.is_symlink() or report_file.is_symlink():
        raise ValueError("unexpected report symlink")
    if not report_file.is_file():
        raise ValueError("missing report for " + run_id)
    report = json.loads(report_file.read_text(encoding="utf-8"))
    if validate(schema, report):
        raise ValueError("invalid report schema for " + run_id)
    report_day = timestamp(report["reported_at"]).date()
    if not start.date() <= report_day <= finish.date():
        raise ValueError("report date disagrees with ledger for " + run_id)
    if report["run_id"] != run_id or report.get("exit_code") != code:
        raise ValueError("report disagrees with ledger for " + run_id)
    human = report["needs_human"]
    reasons = set(human.get("reasons", []))
    if reasons - ALLOWED_REASONS or (human["required"] and not reasons):
        raise ValueError("needs_human reason outside kyc/payment/appeal or missing: " + run_id)
    if code == 2 and not human["required"]:
        raise ValueError("exit 2 without required human intervention: " + run_id)
    return report


def timestamp(stamp):
    if not isinstance(stamp, str):
        raise ValueError('missing run timestamp')
    try:
        return datetime.fromisoformat(stamp.replace('Z', '+00:00'))
    except ValueError:
        raise ValueError('invalid run timestamp') from None


def orphan_date(path):
    report = path / "report.json"
    if report.is_file():
        try:
            return timestamp(json.loads(report.read_text(encoding="utf-8"))["reported_at"]).date()
        except (KeyError, ValueError, TypeError):
            pass
    match = re.fullmatch(r"run-(\d{8})(?:-.*)?", path.name)
    if match:
        try:
            return datetime.strptime(match[1], "%Y%m%d").date()
        except ValueError:
            pass
    match = re.fullmatch(r"sim-(\d{4}-\d{2}-\d{2})", path.name)
    if match:
        try:
            return date.fromisoformat(match[1])
        except ValueError:
            pass
    log = path / "run.log"
    if log.is_file():
        return datetime.fromtimestamp(log.stat().st_mtime).date()
    raise ValueError("orphan run date cannot be determined: " + path.name)


def check(runs_dir, ledger=None):
    folder = Path(runs_dir)
    db = ledger_path(folder, ledger)
    if not db.is_file():
        raise ValueError("ledger.db missing; supply the matching ledger with --ledger")
    schema = load_schema("report.schema.json")
    with closing(sqlite3.connect(db.resolve().as_uri() + "?mode=ro", uri=True)) as con:
        rows = con.execute("SELECT run_id,started_at,finished_at,exit_code FROM runs").fetchall()
    if not rows:
        raise ValueError("runs table is empty")
    ids = {r[0] for r in rows}
    parsed = [(run_id, timestamp(start), finish, code) for run_id, start, finish, code in rows]
    # A crash before finish() may leave only run.log and no ledger row.
    orphans = {}
    for path in folder.iterdir():
        if not path.is_dir() or path.name in ids or (path / ".adspilot-simulation.json").is_file():
            continue
        if (path / "report.json").is_file() or (path / "run.log").is_file() or path.name.startswith(("run-", "sim-")):
            orphans[path.name] = orphan_date(path)
    end = max([start.date() for _, start, _, _ in parsed] + list(orphans.values()))
    first = end - timedelta(days=6)
    for name, day in orphans.items():
        if day >= first:
            raise ValueError("run directory without a ledger row on %s: %s" % (day, name))
    by_day = Counter()
    fixture = (folder / ".adspilot-simulation.json").is_file()
    for run_id, start, finish_text, code in parsed:
        if start.date() < first:
            continue
        by_day[start.date()] += 1
        if code not in (0, 2, 4):
            raise ValueError("exit code %s for %s" % (code, run_id))
        finish = timestamp(finish_text)
        if finish < start:
            raise ValueError("unfinished or inconsistent ledger timestamps: " + run_id)
        rep = read_report(folder, run_id, code, start, finish, schema)
        fixture |= any(e["id"] == "fixture-simulation" for e in rep["evidence"])
    for day in (first + timedelta(days=n) for n in range(7)):
        if by_day[day] != 1:
            raise ValueError("%s has %d runs; expected exactly 1" % (day, by_day[day]))
    return "dates=%s..%s days=7 evidence=%s" % (first, end, "fixture-simulation" if fixture else "local-ledger-and-reports")


def main(runs_dir, ledger=None):
    try:
        print("pass " + check(runs_dir, ledger))
    except (OSError, ValueError, TypeError, KeyError, sqlite3.Error) as exc:
        print("fail " + str(exc))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
