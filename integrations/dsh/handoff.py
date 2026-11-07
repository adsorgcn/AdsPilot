"""Append one allowlisted AdsPilot report summary to a sibling DSH memory repo."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
STATES = {"in_progress", "claimed_complete", "needs_revision", "stopped", "blocked"}


def summary(report):
    if not isinstance(report, dict) or report.get("type") != "adspilot.report":
        raise ValueError("expected an AdsPilot report")
    run_id = report.get("run_id")
    if not isinstance(run_id, str) or not re.fullmatch(r"[A-Za-z0-9._-]{4,64}", run_id):
        raise ValueError("invalid report run_id")
    # A custom run id is user input. Only machine-generated dates are safe to copy.
    if not re.fullmatch(r"run-[0-9]{8}-[0-9]{6}", run_id):
        run_id = "id-" + hashlib.sha256(run_id.encode("utf-8")).hexdigest()[:16]
    state, code = report.get("status"), report.get("exit_code")
    if not isinstance(state, str) or state not in STATES or type(code) is not int or code not in range(5):
        raise ValueError("invalid report status or exit_code")
    human = report.get("needs_human")
    if not isinstance(human, dict) or type(human.get("required")) is not bool:
        raise ValueError("invalid report needs_human")
    needed = "yes" if human["required"] else "no"
    marker = "AdsPilot [%s]" % run_id
    return marker, "- %s status=%s exit=%d needs_human=%s" % (marker, state, code, needed)


def report_summary(report_path, config_path):
    config_path = config_path or ROOT / "config/adspilot.json"
    if config_path.is_file():
        with config_path.open(encoding="utf-8") as src:
            settings = json.load(src)
        if not isinstance(settings, dict):
            raise ValueError("invalid AdsPilot config")
        runs_dir = settings.get("runs_dir", "runs")
        if not isinstance(runs_dir, str) or not runs_dir:
            raise ValueError("invalid AdsPilot runs_dir")
    else:
        if config_path != ROOT / "config/adspilot.json":
            raise ValueError("specified config is unavailable")
        runs_dir = "runs"
    runs = (ROOT / runs_dir).resolve(strict=True)
    report_path = report_path.absolute()
    if (report_path.name != "report.json" or report_path.parent.parent.resolve(strict=True) != runs
            or report_path.resolve(strict=True) != runs / report_path.parent.name / "report.json"
            or report_path.is_symlink() or report_path.parent.is_symlink()):
        raise ValueError("expected a report directly inside the configured runs directory")
    with report_path.open(encoding="utf-8") as src:
        report = json.load(src)
    if not isinstance(report, dict) or report.get("run_id") != report_path.parent.name:
        raise ValueError("report run_id does not match its directory")
    return summary(report)


def append_report(report_path, memory, config_path=None):
    memory = memory.resolve(strict=True)
    handoff = memory / "handoff" / "CURRENT.md"
    if (memory.parent != ROOT.parent or memory == ROOT or not (memory / ".git").exists()
            or handoff.resolve(strict=True) != handoff or not handoff.is_file()):
        raise ValueError("expected a sibling DSH git checkout with handoff/CURRENT.md")
    marker, line = report_summary(report_path, config_path)

    with handoff.open("r+b") as dst:
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(dst.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(dst, fcntl.LOCK_EX)
        # Check the opened file, not just the path. A hard link would modify another file.
        # Closing the handle releases the OS lock, including after an exception.
        opened = os.fstat(dst.fileno())
        if opened.st_nlink != 1 or handoff.resolve(strict=True) != handoff:
            raise ValueError("refusing a linked DSH handoff")
        content = dst.read()
        if any(entry.startswith(("- " + marker + " ").encode("utf-8")) for entry in content.splitlines()):
            return "already recorded"
        newline = b"\r\n" if b"\r\n" in content else b"\n"
        if content and not content.endswith(b"\n"):
            dst.write(newline)
        dst.write(line.encode("utf-8") + newline)
        dst.flush()
        os.fsync(dst.fileno())
    return "appended"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--memory", required=True, type=Path)
    parser.add_argument("--config", type=Path, help="AdsPilot config used for this run")
    args = parser.parse_args()
    try:
        print(append_report(args.report, args.memory, args.config))
    except (OSError, ValueError) as exc:
        print("handoff failed: %s" % type(exc).__name__, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
