"""Black-box test of the DSH handoff using only disposable sibling repos."""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def exercise(parent):
    project = parent / "AdsPilot"
    runner = project / "integrations/dsh/handoff.py"
    runner.parent.mkdir(parents=True)
    shutil.copyfile(ROOT / "integrations/dsh/handoff.py", runner)
    memory = parent / "dsh-memory"
    memory.mkdir()
    subprocess.run(["git", "init", "-q", str(memory)], check=True)
    destination = memory / "handoff/CURRENT.md"
    destination.parent.mkdir()
    original = "交接记录\r\n最后一次检查".encode("utf-8")
    destination.write_bytes(original)

    def write_report(runs, run_id):
        path = runs / run_id / "report.json"
        path.parent.mkdir(parents=True)
        report = {"type": "adspilot.report", "run_id": run_id, "status": "claimed_complete",
                  "exit_code": 0, "needs_human": {"required": False, "note": "private details"},
                  "summary": {"visit": "private visit", "token": "private example"}}
        path.write_text(json.dumps(report), encoding="utf-8")
        return path

    def call(report, config=None):
        cmd = [sys.executable, str(runner), "--report", str(report), "--memory", str(memory)]
        if config:
            cmd.extend(["--config", str(config)])
        return subprocess.run(cmd, cwd=project, capture_output=True, text=True, timeout=30)

    first = write_report(project / "runs", "run-20261106-120000")
    assert call(first).stdout.strip() == "appended"
    assert call(first).stdout.strip() == "already recorded"
    config = project / "config/adspilot.json"
    config.parent.mkdir()
    config.write_text(json.dumps({"runs_dir": "custom-runs"}), encoding="utf-8")
    assert call(first).returncode == 1

    reports = [write_report(project / "custom-runs", "private-run-%02d" % n) for n in range(4)]
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(call, reports * 3))
    assert all(r.returncode == 0 for r in results), [r.stderr for r in results if r.returncode]
    assert sum(r.stdout.strip() == "appended" for r in results) == 4
    explicit = project / "config/other.json"
    custom = parent / "external-runs"
    explicit.write_text(json.dumps({"runs_dir": str(custom)}), encoding="utf-8")
    last = write_report(custom, "private-last")
    assert call(last, config=explicit).stdout.strip() == "appended"
    assert call(last).returncode == 1

    content = destination.read_bytes()
    lines = [line for line in content.splitlines() if line.startswith(b"- AdsPilot [")]
    assert content.startswith(original) and len(lines) == len(set(lines)) == 6
    assert b"private" not in content and b"\n" not in content.replace(b"\r\n", b"")
    assert list(destination.parent.iterdir()) == [destination]
    bad = write_report(project / "custom-runs", "run-bad")
    raw = json.loads(bad.read_text(encoding="utf-8"))
    raw["run_id"] = "another-id"
    bad.write_text(json.dumps(raw), encoding="utf-8")
    assert call(bad).returncode == 1 and destination.read_bytes() == content
    # A hard link has the right path but an append would mutate a second file.
    neighbor = parent / "outside.md"
    neighbor.write_bytes(b"untouched")
    destination.unlink()
    os.link(neighbor, destination)
    assert call(reports[0]).returncode == 1 and neighbor.read_bytes() == b"untouched"
    print("DSH handoff: 12 concurrent calls, 4 distinct new summaries; 6 total summary lines")
    print("DSH handoff: private fields omitted; invalid source and hard-linked destination rejected")


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="adspilot-handoff-test-") as work:
        exercise(Path(work))
