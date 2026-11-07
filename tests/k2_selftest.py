#!/usr/bin/env python3
"""Regression tests for the K2 offline tools; all write targets are temporary."""
from contextlib import closing
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import warnings

ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable
LOOP = ROOT / "core/loop/daily.py"
ACCEPT = ROOT / "core/selfcheck/acceptance.py"
CAL = ROOT / "core/judge/calibrate.py"
IP = ROOT / "plugins/ipintel/ipapi-is/lookup.py"


def cli(script, *args, code=0, payload=None, env=None):
    proc = subprocess.run([PYTHON, str(script), *(str(arg) for arg in args)], cwd=ROOT, env=env,
                          input=json.dumps(payload) if payload is not None else None, capture_output=True,
                          encoding="utf-8", errors="replace", timeout=60)
    if proc.returncode != code:
        raise AssertionError("expected %d, got %d: %s" % (code, proc.returncode, (proc.stdout + proc.stderr)[-800:]))
    return proc.stdout.strip()


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def save(path, obj):
    path.write_text(json.dumps(obj), encoding="utf-8")


class K2(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.source = Path(cls.tmp.name) / "sample"
        cli(LOOP, "--simulate-days", "7", "--runs-dir", cls.source)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def setUp(self):
        self.case = tempfile.TemporaryDirectory()
        self.addCleanup(self.case.cleanup)
        self.runs = Path(self.case.name) / "runs"
        shutil.copytree(self.source, self.runs)
        self.day = self.runs / "sim-2026-09-03"
        self.db = self.runs / "data/ledger.db"

    def edit_db(self, sql, args=()):
        with closing(sqlite3.connect(str(self.db))) as con:
            con.execute(sql, args)
            con.commit()

    def test_simulation_schema_acceptance_idempotence(self):
        original = {p.relative_to(self.runs): p.read_bytes() for p in self.runs.rglob("*") if p.is_file()}
        self.assertIn("evidence=fixture-simulation", cli(ACCEPT, self.runs))
        cli(LOOP, "--simulate-days", "7", "--runs-dir", self.runs)
        self.assertEqual(original, {p.relative_to(self.runs): p.read_bytes() for p in self.runs.rglob("*") if p.is_file()})
        for path in self.runs.glob("sim-*/report.json"):
            report = load(path)
            self.assertEqual(report["run_id"], path.parent.name)
            self.assertEqual(report["exit_code"], 0)
            self.assertTrue(report["judgments"])
            self.assertTrue(report["actions"])
            self.assertIn("fixture-simulation", {e["id"] for e in report["evidence"]})
            self.assertEqual(load(path.parent / "fx.json")["reported_at"], report["reported_at"])

    def test_external_run_evidence_and_private_input_paths(self):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", ResourceWarning)  # Legacy scripts open short-lived JSON handles.
            # On Windows CI the checkout and temp dir can be on different drives.
            sys.path.insert(0, str(ROOT))
            from core.loop import daily
            config = load(ROOT / "config/adspilot.example.json")
            external = Path(self.case.name)
            source = external / "private-input-filename.csv"
            shutil.copyfile(ROOT / "tests/fixtures/google-ads-report.csv", source)
            config.update(runs_dir=str(external / "external-runs"), data_dir=str(external / "external-data"))
            config["traffic"]["report_csv"] = str(source)
            config["affiliate"].update(commissions_source="json", commissions_json=str(ROOT / "tests/fixtures/commissions.cj.json"))
            run = daily.Run(config, "portable-test", False)
            try:
                rep = run.step_traffic_report()
                commissions = run.step_commissions()
                reconciled = run.step_reconcile(commissions)
                report, valid = run.build_report(rep, reconciled, 0)
                self.assertTrue(valid)
                refs = [item["ref"] for item in report["evidence"]]
                self.assertEqual(refs, ["./traffic-report.json", "./commissions.json", "./conversions.json"])
                for ref in refs:
                    self.assertTrue((Path(run.dir) / ref).is_file())
                outbox = Path(config["data_dir"]) / "outbox" / "conversions-portable-test.csv"
                self.assertEqual(run.path_ref(outbox), "config.data_dir/outbox/conversions-portable-test.csv")
                source.unlink()
                self.assertIsNone(run.step_traffic_report())
                saved = Path(run.path("run.log")).read_text(encoding="utf-8") + json.dumps(run.needs_human)
                self.assertIn("config.traffic.report_csv", saved)
                self.assertNotIn(source.name, saved)
                self.assertNotIn(str(external), saved)
            finally:
                run.log_fp.close()
                run.con.close()
            standard = daily.Run.__new__(daily.Run)
            standard.cfg = {}
            standard.run_id = "portable-test"
            standard.dir = str(ROOT / "runs/portable-test")
            standard.data_dir = str(ROOT / "data")
            self.assertEqual(standard.path_ref(ROOT / "runs/portable-test/report.json"), "runs/portable-test/report.json")
            self.assertEqual(standard.path_ref(ROOT / "data/outbox/conversions-portable-test.csv"),
                             "data/outbox/conversions-portable-test.csv")

    def test_reject_unowned_dir_and_modified_simulation(self):
        occupied = self.runs.parent / "existing"
        occupied.mkdir()
        existing = occupied / "keep"
        existing.write_bytes(b"keep")
        cli(LOOP, "--simulate-days", "1", "--runs-dir", occupied, code=1)
        self.assertEqual(existing.read_bytes(), b"keep")
        (self.day / "report.json").write_text("{}", encoding="utf-8")
        cli(LOOP, "--simulate-days", "7", "--runs-dir", self.runs, code=1)
        self.assertEqual(load(self.day / "report.json"), {})

    def test_gap_and_duplicate(self):
        self.edit_db("DELETE FROM runs WHERE run_id=?", (self.day.name,))
        shutil.rmtree(self.day)
        self.assertIn("2026-09-03 has 0", cli(ACCEPT, self.runs, code=1))
        # Give the second date a separate, otherwise valid run and matching report.
        clone = self.runs / "repeat-2026-09-02"
        shutil.copytree(self.runs / "sim-2026-09-02", clone)
        report = load(clone / "report.json")
        report["run_id"] = clone.name
        save(clone / "report.json", report)
        self.edit_db("INSERT INTO runs SELECT ?,started_at,finished_at,exit_code,summary FROM runs WHERE run_id=?",
                     (clone.name, "sim-2026-09-02"))
        self.assertIn("2026-09-02 has 2", cli(ACCEPT, self.runs, code=1))

    def test_bad_exit_codes_and_human_reasons(self):
        for code in (1, 3):
            self.edit_db("UPDATE runs SET exit_code=? WHERE run_id=?", (code, self.day.name))
            self.assertIn("exit code %d" % code, cli(ACCEPT, self.runs, code=1))
        self.edit_db("UPDATE runs SET exit_code=2 WHERE run_id=?", (self.day.name,))
        report = load(self.day / "report.json")
        report["exit_code"] = 2
        for reason in ("kyc", "payment", "appeal", "other"):
            report["needs_human"] = {"required": True, "reasons": [reason]}
            save(self.day / "report.json", report)
            out = cli(ACCEPT, self.runs, code=1 if reason == "other" else 0)
            self.assertTrue(out.startswith("fail " if reason == "other" else "pass "))

    def test_window_orphan_period_and_utc(self):
        old = self.runs / "run-20200101-broken"
        old.mkdir()
        (old / "run.log").write_text("incomplete", encoding="utf-8")
        self.edit_db("UPDATE runs SET started_at=started_at||'Z', finished_at=finished_at||'Z'")
        report = load(self.day / "report.json")
        report["reported_at"] += "Z"
        save(self.day / "report.json", report)
        self.assertTrue(cli(ACCEPT, self.runs).startswith("pass "))
        new = self.runs / "run-20260908-unfinished"
        old.rename(new)
        self.assertIn("2026-09-08", cli(ACCEPT, self.runs, code=1))
        orphan = self.runs / "custom-job"
        new.rename(orphan)
        stamp = datetime(2026, 9, 4, 12, tzinfo=timezone.utc).timestamp()
        os.utime(orphan / "run.log", (stamp, stamp))
        self.assertIn("without a ledger row", cli(ACCEPT, self.runs, code=1))
        orphan.rename(self.runs / "fixture-child")
        (self.runs / "fixture-child/.adspilot-simulation.json").touch()
        self.assertTrue(cli(ACCEPT, self.runs).startswith("pass "))

    def test_ip_default_offline_and_invalid_replies(self):
        env = dict(os.environ)
        env.pop("IPAPI_IS_KEY", None)
        self.assertEqual(json.loads(cli(IP, payload={"ips": ["192.0.2.23"]}, env=env))["rows"][0]["country"], "US")
        self.assertEqual(json.loads(cli(IP, payload={"ips": ["192.0.2.99"]}, env=env)), {"rows": []})
        for payload in ({"ips": [123]}, {"ips": ["127.0.0.1:80"]}, {"ips": ["fe80::1%5"]}):
            self.assertIn("error", json.loads(cli(IP, code=4, payload=payload, env=env)))
        self.assertIn("missing", cli(IP, "--apply", code=4, payload={"ips": ["192.0.2.23"]}, env=env))
        self.assertIn("public unicast", cli(IP, "--apply", code=4, payload={"ips": ["127.0.0.1"]},
                                            env=dict(env, IPAPI_IS_KEY="test-only")))
        self.assertIn('"network": false', cli(IP, "--selftest"))

    def test_calibration_fx_and_read_only_sources(self):
        protected = [self.db, ROOT / "soul/default.soul.md", ROOT / "core/judge/judge.py"]
        before = [p.read_bytes() for p in protected]
        for directory in self.runs.glob("sim-*"):
            report = load(directory / "report.json")
            report["summary"]["currency"] = "HKD"
            save(directory / "report.json", report)
            traffic = load(directory / "traffic-report.json")
            traffic.update(currency="HKD", rows=[dict(date=report["reported_at"][:10], campaign="sample",
                                                       impressions=1, clicks=1, cost=78, conversions=1)])
            save(directory / "traffic-report.json", traffic)
            (directory / "fx.json").unlink()
        def evaluate(*args):
            reply = json.loads(cli(CAL, "--runs-dir", self.runs, *args))
            result = load(Path(reply["proposal"]))
            row = next(r for r in result["thresholds"] if r["parameter"] == "stop_loss.spend_no_conversion")
            return result["fx"], row
        fx, row = evaluate()
        self.assertEqual(fx["skip_reasons"], {"missing_currency_pair": 7})
        self.assertEqual(row["samples"], 0)
        config = ROOT / "config/adspilot.example.json"
        fx, row = evaluate("--config", config)
        self.assertEqual(fx["used_reports"], {"reference_configuration": 7})
        self.assertEqual((row["samples"], row["suggested"]), (1, 10))
        for directory in self.runs.glob("sim-*"):
            rep = load(directory / "report.json")
            save(directory / "fx.json", dict(run_id=directory.name, reported_at=rep["reported_at"],
                                              currency="HKD", fx={"HKD": 6, "USD": 1}))
        fx, row = evaluate("--config", config)
        self.assertEqual(fx["used_reports"], {"per_run_configuration": 7})
        self.assertEqual((row["samples"], row["suggested"]), (1, 13))
        self.assertEqual([p.read_bytes() for p in protected], before)

    @unittest.skipUnless(os.name == "nt", "Windows PowerShell preview")
    def test_windows_preview(self):
        proc = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "RemoteSigned",
                               "-File", str(ROOT / "tests/k2_windows_preview.ps1"), "-Python", sys.executable],
                              cwd=ROOT, capture_output=True, encoding="utf-8", errors="replace")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("Windows templates: parsed, two triggers", proc.stdout,
                      "PowerShell must execute the template checks and emit their completion marker")


if __name__ == "__main__":
    unittest.main(verbosity=2)
