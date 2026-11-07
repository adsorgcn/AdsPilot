"""Build an isolated, offline fixture run set; its dates are logical dates."""
from datetime import date, timedelta
import hashlib
import json
from pathlib import Path
import tempfile

MARKER = ".adspilot-simulation.json"


def inventory(folder):
    files = [folder / "data/ledger.db"]
    files.extend(sorted(folder.glob("sim-*/report.json")))
    return {p.relative_to(folder).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}


def completed(folder, count):
    marker = folder / MARKER
    if not marker.is_file():
        raise ValueError("destination contains existing files; use a fresh simulation directory")
    meta = json.loads(marker.read_text(encoding="utf-8"))
    if (meta.get("days") != count or meta.get("files") != inventory(folder)
            or len(meta["files"]) != count + 1):
        raise ValueError("existing simulation differs; use a fresh simulation directory")
    return True


def generate(folder, count, daily):
    root = Path(daily.ROOT)
    config = json.loads((root / "config/adspilot.example.json").read_text(encoding="utf-8"))
    config.update(runs_dir=str(folder), data_dir=str(folder / "data"), apply=False)
    config["judgment"]["provider"] = "local"
    config["traffic"]["report_source"] = "csv_export"
    config["traffic"]["report_csv"] = str(root / "tests/fixtures/google-ads-report.csv")
    config["traffic"]["deploy_mode"] = "manual"
    # Import only the CSV fixture. No account exports, credentials, mappings or remote actions.
    start = date(2026, 9, 1)
    for offset in range(count):
        day = start + timedelta(days=offset)
        run = daily.Run(config, "sim-" + day.isoformat(), False)
        try:
            run.log("fixture simulation: logical date " + day.isoformat())
            traffic = run.step_traffic_report()
            if traffic is None:
                raise ValueError("traffic fixture failed validation")
            dates = sorted({row["date"] for row in traffic["rows"]})
            source_day = dates[offset % len(dates)]
            traffic["rows"] = [dict(row, date=day.isoformat()) for row in traffic["rows"] if row["date"] == source_day]
            # Replace the importer's staging path with a relative, durable evidence reference.
            traffic_file = Path(run.path("traffic-report.json"))
            traffic_file.write_text(json.dumps(traffic, indent=2), encoding="utf-8")
            run.evidence[0]["ref"] = run.run_id + "/traffic-report.json"
            run.evidence.append({"id": "fixture-simulation", "kind": "test_output",
                                 "ref": "tests/fixtures/google-ads-report.csv", "result": "pass"})
            todo, upload = run.step_judgments(traffic, None)
            run.step_execute(todo, upload, None)
            if run.needs_human:
                raise ValueError("fixture unexpectedly requires human intervention")
            report, valid = run.build_report(traffic, None, 0)
            if not valid:
                raise ValueError("simulation report failed schema validation")
            timestamp = day.isoformat() + "T12:00:00"
            report["reported_at"] = timestamp
            Path(run.path("report.json")).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            run.record_fx(report)
            run.started = timestamp
            run.finish(0, report["summary"])
            run.con.execute("UPDATE runs SET finished_at=? WHERE run_id=?", (timestamp, run.run_id))
            run.con.commit()
        finally:
            run.log_fp.close()
            run.con.close()
    meta = {"kind": "fixture-simulation", "days": count, "files": inventory(folder)}
    (folder / MARKER).write_text(json.dumps(meta, indent=2), encoding="utf-8")


def simulate(count, target, daily):
    if count < 1:
        raise ValueError("--simulate-days must be positive")
    # Refuse an existing symlink or any destination with user data.
    folder = Path(target).absolute()
    if folder.is_symlink():
        raise ValueError("simulation destination must not be a symlink")
    folder.parent.mkdir(parents=True, exist_ok=True)
    if folder.is_dir() and any(folder.iterdir()):
        completed(folder, count)
    else:
        with tempfile.TemporaryDirectory(prefix=".adspilot-simulation-", dir=str(folder.parent)) as parent:
            stage = Path(parent) / "runs"
            stage.mkdir()
            generate(stage, count, daily)
            try:
                if folder.is_dir():
                    folder.rmdir()  # succeeds only if still empty
                stage.rename(folder)
            except OSError:
                if not folder.is_dir() or not completed(folder, count):
                    raise
    print("simulation days=%d evidence=fixture exit=0" % count)
    return 0
