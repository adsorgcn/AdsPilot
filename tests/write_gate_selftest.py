#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Offline table-driven regression tests for the centralized fail-closed write gate.

Verifies identical write-authorization behavior across:
  1) Centralized write_gate.resolve_write_mode truth table
  2) Raw core/loop/daily.py (main CLI + direct run_once + API/manual + --ack + action-gate denials)
  3) Structured CLI adspilot.py (loop.run, traffic.google-ads.deploy, deploy.cloudflare.publish, loop.ack)
  4) MCP stdio core/agent/mcp_server.py (tools/list + tools/call on the same routes)
  5) Non-installing scheduler template checks (crontab, systemd, Windows PowerShell scripts)
"""
import copy
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "core", "selfcheck"))
import write_gate as WG  # noqa: E402


CREDENTIAL_ENV_PREFIXES = (
    "CJ_",
    "IMPACT_",
    "GOOGLE_ADS_",
    "CLOUDFLARE_",
    "CF_",
    "LLM_",
    "JEV_",
    "SOUL_API_",
    "ADSPILOT_",
    "DEEPSEEK_",
    "OPENAI_",
)
CREDENTIAL_EXACT_VARS = (
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
)


def clean_offline_env():
    env = {}
    for k, v in os.environ.items():
        if k.startswith(CREDENTIAL_ENV_PREFIXES) or k in CREDENTIAL_EXACT_VARS:
            continue
        env[k] = v
    env["NO_PROXY"] = "*"
    env["PYTHONUTF8"] = "1"
    return env


def copy_checkout(dst):
    """Build an isolated throwaway AdsPilot checkout without repo data/, runs/, .git, or node_modules."""
    os.makedirs(dst, exist_ok=True)
    skip_dirs = {".git", "node_modules", "data", "runs", "__pycache__", ".pytest_cache"}
    for name in os.listdir(ROOT):
        if name in skip_dirs:
            continue
        src = os.path.join(ROOT, name)
        target = os.path.join(dst, name)
        if os.path.isdir(src):
            shutil.copytree(
                src,
                target,
                ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "node_modules"),
            )
        elif os.path.isfile(src):
            shutil.copy2(src, target)
    for d in (
        os.path.join(dst, "config"),
        os.path.join(dst, "data", "inbox"),
        os.path.join(dst, "data", "outbox"),
        os.path.join(dst, "runs"),
    ):
        os.makedirs(d, exist_ok=True)
    prod_cfg = os.path.join(dst, "config", "adspilot.json")
    if os.path.isfile(prod_cfg):
        os.remove(prod_cfg)
    return dst


def install_spy_plugins(checkout_dir):
    """Replace external write plugins inside the throwaway checkout with offline spies."""
    spy_log = os.path.join(checkout_dir, "spy_writes.jsonl")
    header = f'''#!/usr/bin/env python3
import json, os, sys
SPY_LOG = {spy_log!r}
def record(plugin, payload_arg=None):
    argv = sys.argv[1:]
    entry = {{
        "plugin": plugin,
        "argv": argv,
        "has_apply": ("--apply" in argv),
        "has_dry_run": ("--dry-run" in argv),
        "is_write": ("--apply" in argv and "--dry-run" not in argv),
        "payload": payload_arg,
    }}
    with open(SPY_LOG, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\\n")
    return entry["is_write"]
'''

    deploy_py = header + '''
def main():
    argv = sys.argv[1:]
    if "--selftest" in argv:
        print(json.dumps({"ok": True}))
        return 0
    is_write = record("traffic.deploy_api")
    if "--spec" in argv:
        print(json.dumps({
            "created": {"campaign": "campaigns/spy-1"} if is_write else {},
            "plan": [{"service": "campaignBudgets", "ops": 1, "tag": "budget"}],
            "mode": "apply" if is_write else "dry",
            "applied": is_write,
            "customer": "000-000-0000",
        }))
        return 0
    # daily.py action deploy call
    todo_actions = []
    if "--actions" in argv:
        idx = argv.index("--actions")
        if idx + 1 < len(argv) and os.path.isfile(argv[idx + 1]):
            with open(argv[idx + 1], encoding="utf-8") as fh:
                todo_actions = json.load(fh).get("actions", [])
    res_rows = [
        {
            "node": a.get("node"),
            "target": a.get("target"),
            "choice": a.get("choice"),
            "applied": is_write,
            "ok": is_write,
            "status": "applied" if is_write else "dry",
            "note": "spy applied" if is_write else "spy dry",
        }
        for a in todo_actions
    ]
    print(json.dumps({
        "mode": "apply" if is_write else "dry",
        "applied": is_write,
        "results": res_rows,
        "actions": res_rows,
        "ok": True,
    }))
    return 0

if __name__ == "__main__":
    sys.exit(main())
'''

    convert_api_py = header + '''
def main():
    argv = sys.argv[1:]
    is_write = record("traffic.convert_api")
    print(json.dumps({
        "mode": "apply" if is_write else "dry",
        "customer": "000-000-0000",
        "conversion_name": "affiliate_commission",
        "rows": 1,
        "retractions": 0,
        "unlinked_chargebacks": [],
        "applied": is_write,
    }))
    return 0

if __name__ == "__main__":
    sys.exit(main())
'''

    convert_export_py = header + '''
def main():
    argv = sys.argv[1:]
    record("traffic.convert_export")
    out_path = ""
    for flag in ("--out", "--output"):
        if flag in argv:
            i = argv.index(flag)
            if i + 1 < len(argv):
                out_path = argv[i + 1]
                break
    if out_path:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as fh:
            fh.write("Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency\\n")
            fh.write("GCLIDSPY1,affiliate_commission,2026-09-11T03:12:44Z,18.4,USD\\n")
    print(json.dumps({"rows": 1, "retractions": 0, "csv": out_path}))
    return 0

if __name__ == "__main__":
    sys.exit(main())
'''

    publish_py = f'''#!/usr/bin/env python3
import json, sys
SPY_LOG = {spy_log!r}
def main():
    argv = sys.argv[1:]
    entry = {{
        "plugin": "deploy.publish",
        "argv": argv,
        "has_apply": ("--apply" in argv),
        "has_dry_run": ("--dry-run" in argv),
        "is_write": True,
        "payload": None,
    }}
    with open(SPY_LOG, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\\n")
    print(json.dumps({{
        "host": "example.com",
        "pushed": ["sample"],
        "offers_total": 1,
    }}))
    return 0

if __name__ == "__main__":
    sys.exit(main())
'''

    budget_py = '''#!/usr/bin/env python3
import json, sys
print(json.dumps({"recommendations": [{"campaign": "Widget Deals", "daily_budget": 12.0}]}))
'''

    report_api_py = f'''#!/usr/bin/env python3
import json, os, subprocess, sys
SPY_LOG = {spy_log!r}
CHECKOUT = {checkout_dir!r}
def main():
    argv = sys.argv[1:]
    entry = {{
        "plugin": "traffic.report_api",
        "argv": argv,
        "has_apply": ("--apply" in argv),
        "has_dry_run": ("--dry-run" in argv),
        "is_write": False,
    }}
    with open(SPY_LOG, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\\n")
    def opt(flag):
        if flag in argv:
            i = argv.index(flag)
            if i + 1 < len(argv):
                return argv[i + 1]
        return ""
    out_p = opt("--out")
    if out_p:
        subprocess.run(
            [sys.executable, os.path.join(CHECKOUT, "plugins", "traffic", "google-ads", "report_import.py"),
             "--csv", os.path.join(CHECKOUT, "data", "inbox", "google-ads-report.csv"), "--out", out_p],
            cwd=CHECKOUT, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    acct_out = opt("--account-out")
    if acct_out:
        flag_file = os.path.join(CHECKOUT, "data", "fake_account_status.json")
        acct_data = json.load(open(flag_file, encoding="utf-8")) if os.path.isfile(flag_file) else {{"status": "OK", "account_status": "OK", "disapprovals": 0}}
        with open(acct_out, "w", encoding="utf-8") as fh:
            json.dump(acct_data, fh)
    st_out = opt("--search-terms-out")
    if st_out:
        with open(st_out, "w", encoding="utf-8") as fh:
            json.dump({{"rows": []}}, fh)
    print(json.dumps({{"ok": True, "rows": 80}}))
    return 0

if __name__ == "__main__":
    sys.exit(main())
'''

    targets = {
        os.path.join(checkout_dir, "plugins", "traffic", "google-ads", "deploy_api.py"): deploy_py,
        os.path.join(checkout_dir, "plugins", "traffic", "google-ads", "convert_api.py"): convert_api_py,
        os.path.join(checkout_dir, "plugins", "traffic", "google-ads", "convert_export.py"): convert_export_py,
        os.path.join(checkout_dir, "plugins", "traffic", "google-ads", "budget_api.py"): budget_py,
        os.path.join(checkout_dir, "plugins", "traffic", "google-ads", "report_api.py"): report_api_py,
        os.path.join(checkout_dir, "plugins", "deploy", "cloudflare", "publish.py"): publish_py,
    }
    for path, content in targets.items():
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(content)
    return spy_log


def read_spy_events(spy_log):
    if not os.path.isfile(spy_log):
        return []
    events = []
    with open(spy_log, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                events.append(json.loads(line))
    return events


def reset_spy(spy_log):
    if os.path.isfile(spy_log):
        os.remove(spy_log)


def write_count(events):
    return sum(
        1
        for e in events
        if e.get("plugin") in ("traffic.deploy_api", "traffic.convert_api", "traffic.convert_export", "deploy.publish")
        and e.get("is_write")
    )


def all_dispatch_count(events):
    return sum(
        1
        for e in events
        if e.get("plugin") in ("traffic.deploy_api", "traffic.convert_api", "traffic.convert_export", "deploy.publish")
    )


def seed_loop_inbox_and_ledger(checkout_dir):
    """Populate inbox + ledger SQLite so daily loop produces real M1/M2 mutable & conversion actions."""
    inbox = os.path.join(checkout_dir, "data", "inbox")
    os.makedirs(inbox, exist_ok=True)
    shutil.copy2(
        os.path.join(checkout_dir, "tests", "fixtures", "google-ads-report.csv"),
        os.path.join(inbox, "google-ads-report.csv"),
    )
    shutil.copy2(
        os.path.join(checkout_dir, "tests", "fixtures", "commissions.cj.json"),
        os.path.join(inbox, "cj-commissions.json"),
    )
    with open(os.path.join(inbox, "budget-recommendations.json"), "w", encoding="utf-8") as fh:
        json.dump({"Widget Deals": 12.0}, fh)

    db_path = os.path.join(checkout_dir, "data", "ledger.db")
    if os.path.isfile(db_path):
        os.remove(db_path)
    mappings_jsonl = os.path.join(checkout_dir, "data", "mappings.jsonl")
    with open(os.path.join(checkout_dir, "tests", "fixtures", "mappings.json"), encoding="utf-8") as fh:
        mapping_rows = json.load(fh)
    with open(mappings_jsonl, "w", encoding="utf-8") as fh:
        for row in mapping_rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    rc = subprocess.run(
        [
            sys.executable,
            "core/ledger/subid.py",
            "import",
            mappings_jsonl,
            "--db",
            db_path,
        ],
        cwd=checkout_dir,
        env=clean_offline_env(),
        capture_output=True,
        text=True,
        check=True,
    )
    assert rc.returncode == 0


def reset_ledger_and_state(checkout_dir):
    """Reset mutable runs/outbox and re-seed ledger so conversions/actions trigger identically per run."""
    for sub in ("runs", os.path.join("data", "outbox")):
        p = os.path.join(checkout_dir, sub)
        if os.path.isdir(p):
            shutil.rmtree(p)
        os.makedirs(p, exist_ok=True)
    for extra in ("user-decisions.json", "fake_account_status.json"):
        p_extra = os.path.join(checkout_dir, "data", extra)
        if os.path.isfile(p_extra):
            os.remove(p_extra)
    seed_loop_inbox_and_ledger(checkout_dir)


def base_config(apply_val=False, include_apply=True, deploy_mode="api", autonomy="within_caps"):
    with open(os.path.join(ROOT, "config", "adspilot.example.json"), encoding="utf-8") as fh:
        cfg = json.load(fh)
    cfg["affiliate"]["commissions_source"] = "json"
    cfg["traffic"]["deploy_mode"] = deploy_mode
    cfg["traffic"]["report_source"] = "csv_export"
    cfg["caps"]["autonomy"] = autonomy
    cfg["deploy"]["export_url"] = ""
    if include_apply:
        cfg["apply"] = apply_val
    else:
        cfg.pop("apply", None)
    return cfg


def write_cfg(checkout_dir, name, cfg_obj):
    path = os.path.join(checkout_dir, "config", name)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(cfg_obj, fh, ensure_ascii=False, indent=2)
    return os.path.join("config", name)


def test_unit_truth_table():
    """Verify centralized write_gate.resolve_write_mode exact truth table and type strictness."""
    table = [
        # (name, cfg, req_apply, req_dry, expect_ok, expect_val_or_code)
        ("absent_request_cfg_false", {"apply": False}, False, False, True, False),
        ("config_only_true", {"apply": True}, False, False, True, False),
        ("explicit_preview_cfg_true", {"apply": True}, False, True, True, False),
        ("missing_cfg_none", None, False, False, False, 4),
        ("apply_missing_cfg_key", {}, True, False, False, 4),
        ("apply_cfg_false", {"apply": False}, True, False, False, 4),
        ("malformed_cfg_str_true_no_req", {"apply": "true"}, False, False, False, 4),
        ("malformed_cfg_str_false_no_req", {"apply": "false"}, False, False, False, 4),
        ("malformed_cfg_int_1_no_req", {"apply": 1}, False, False, False, 4),
        ("malformed_cfg_int_0_req", {"apply": 0}, True, False, False, 4),
        ("malformed_cfg_none", {"apply": None}, False, False, False, 4),
        ("malformed_req_apply_str", {"apply": True}, "true", False, False, 1),
        ("malformed_req_apply_int", {"apply": True}, 1, False, False, 1),
        ("malformed_req_apply_none", {"apply": True}, None, False, False, 1),
        ("malformed_req_dry_str", {"apply": True}, False, "true", False, 1),
        ("malformed_req_dry_int", {"apply": True}, False, 1, False, 1),
        ("malformed_req_dry_none", {"apply": True}, False, None, False, 1),
        ("conflict_apply_and_dry_run", {"apply": True}, True, True, False, 1),
        ("dual_opt_in", {"apply": True}, True, False, True, True),
    ]
    for name, cfg, r_apply, r_dry, expect_ok, expected in table:
        if expect_ok:
            got = WG.resolve_write_mode(cfg, request_apply=r_apply, request_dry_run=r_dry)
            assert got is expected, f"unit {name}: expected {expected!r}, got {got!r}"
        else:
            try:
                WG.resolve_write_mode(cfg, request_apply=r_apply, request_dry_run=r_dry)
                raise AssertionError(f"unit {name}: expected WriteGateError({expected})")
            except WG.WriteGateError as exc:
                assert exc.code == expected, f"unit {name}: expected code {expected}, got {exc.code} ({exc})"
    print("ok   truth_table: 19/19 unit cases pass")


def run_cli_raw_daily(checkout_dir, argv, spy_log):
    reset_spy(spy_log)
    proc = subprocess.run(
        [sys.executable, "core/loop/daily.py", *argv],
        cwd=checkout_dir,
        env=clean_offline_env(),
        capture_output=True,
        text=True,
    )
    return proc.returncode, proc.stdout, proc.stderr, read_spy_events(spy_log)


def run_inproc_daily_run_once(checkout_dir, cfg_obj, run_id, apply_arg, dry_run_arg, spy_log):
    """Run daily.run_once directly in an isolated subprocess with sockets blocked and spy plugins."""
    reset_spy(spy_log)
    code = r"""
import json, os, socket, sys, urllib.request
def _blocked(*a, **kw):
    raise RuntimeError("network blocked in offline selftest")
socket.create_connection = _blocked
urllib.request.urlopen = _blocked
sys.path.insert(0, os.path.join(os.getcwd(), "core", "loop"))
import daily
import write_gate as WG
cfg = json.loads(sys.argv[1])
run_id = sys.argv[2]
apply_arg = json.loads(sys.argv[3])
dry_run_arg = json.loads(sys.argv[4])
try:
    rc = daily.run_once(cfg, run_id, apply=apply_arg, dry_run=dry_run_arg)
    print(json.dumps({"rc": rc}))
except WG.WriteGateError as exc:
    print(json.dumps({"rc": exc.code, "error": str(exc)}))
"""
    proc = subprocess.run(
        [
            sys.executable,
            "-c",
            code,
            json.dumps(cfg_obj),
            run_id,
            json.dumps(apply_arg),
            json.dumps(dry_run_arg),
        ],
        cwd=checkout_dir,
        env=clean_offline_env(),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, f"run_once driver crashed: {proc.stderr}"
    last = json.loads(proc.stdout.strip().splitlines()[-1])
    return last["rc"], last.get("error", ""), read_spy_events(spy_log)


def assert_preview_artifacts_absent_and_safe(checkout_dir, run_id):
    run_dir = os.path.join(checkout_dir, "runs", run_id)
    assert os.path.isfile(os.path.join(run_dir, "report.json")), f"missing report.json in {run_id}"
    assert not os.path.exists(os.path.join(run_dir, "actions-todo.json")), f"preview leaked actions-todo.json in {run_id}"
    outbox_dir = os.path.join(checkout_dir, "data", "outbox")
    csvs = [f for f in os.listdir(outbox_dir) if f.endswith(".csv")] if os.path.isdir(outbox_dir) else []
    assert not csvs, f"preview leaked outbox conversion csvs in {run_id}: {csvs}"

    with open(os.path.join(run_dir, "report.json"), encoding="utf-8") as fh:
        rep = json.load(fh)
    noop_choices = {"continue", "keep", "hold", "skip", "propose_only"}
    for act in rep.get("actions", []):
        if act.get("node") != "anomaly.escalate" or act.get("choice") not in noop_choices:
            if act.get("choice") not in noop_choices:
                assert act.get("applied") is False, f"preview mutable action marked applied=True in {run_id}: {act}"

    con = sqlite3.connect(os.path.join(checkout_dir, "data", "ledger.db"))
    try:
        rows = con.execute("SELECT summary FROM runs WHERE run_id=?", (run_id,)).fetchall()
        assert len(rows) == 1, f"expected 1 runs row for {run_id}, got {len(rows)}"
        summary = json.loads(rows[0][0])
        assert summary.get("mode") == "preview", f"expected runs.summary mode=preview, got {summary}"
        todo_rows = con.execute("SELECT COUNT(*) FROM actions WHERE run_id=? AND note LIKE 'todo%'", (run_id,)).fetchone()[0]
        assert todo_rows == 0, f"preview leaked todo rows in DB for {run_id}: {todo_rows}"
    finally:
        con.close()


def test_raw_daily_matrix(checkout_dir, spy_log):
    matrix_results = []
    # 1. Absent request, config_only=true, explicit preview + config_only=true -> preview, 0 external writes
    preview_cases = [
        ("absent_request", base_config(apply_val=False), []),
        ("config_only_true", base_config(apply_val=True), []),
        ("explicit_preview_cfg_true", base_config(apply_val=True), ["--dry-run"]),
    ]
    for idx, (name, cfg_obj, extra_flags) in enumerate(preview_cases):
        reset_ledger_and_state(checkout_dir)
        cfg_rel = write_cfg(checkout_dir, f"daily-{name}.json", cfg_obj)
        run_id = f"raw-{name}"
        rc, out, err, events = run_cli_raw_daily(checkout_dir, ["--config", cfg_rel, "--run-id", run_id, *extra_flags], spy_log)
        assert rc == 0, f"daily.main {name} failed rc={rc} err={err} out={out}"
        assert all_dispatch_count(events) == 0, f"daily.main {name} dispatched external plugin: {events}"
        assert_preview_artifacts_absent_and_safe(checkout_dir, run_id)
        # Verify --ack on preview run acks 0 actions
        rc_ack, out_ack, err_ack, ev_ack = run_cli_raw_daily(checkout_dir, ["--config", cfg_rel, "--ack", run_id], spy_log)
        assert rc_ack == 0 and "acked 0 actions" in out_ack, f"ack on preview {name}: rc={rc_ack} out={out_ack} err={err_ack}"
        assert all_dispatch_count(ev_ack) == 0
        matrix_results.append((f"daily.main:{name}", rc, all_dispatch_count(events), write_count(events)))

    # Also test manual mode preview emits zero actions-todo.json and zero outbox CSV
    reset_ledger_and_state(checkout_dir)
    cfg_manual_true = base_config(apply_val=True, deploy_mode="manual")
    cfg_rel_mt = write_cfg(checkout_dir, "daily-manual-cfg-true.json", cfg_manual_true)
    rc, out, err, events = run_cli_raw_daily(checkout_dir, ["--config", cfg_rel_mt, "--run-id", "raw-manual-cfg-only"], spy_log)
    assert rc == 0, f"daily.main manual cfg_only failed: rc={rc} {err}"
    assert all_dispatch_count(events) == 0
    assert_preview_artifacts_absent_and_safe(checkout_dir, "raw-manual-cfg-only")
    matrix_results.append(("daily.main:manual_config_only", rc, all_dispatch_count(events), write_count(events)))

    # 2. Rejected cases before dispatch
    reject_cases = [
        ("apply_missing_cfg_file", None, ["--config", "config/does-not-exist.json", "--apply"], 4),
        ("apply_missing_cfg_key", base_config(include_apply=False), ["--apply"], 4),
        ("apply_cfg_false", base_config(apply_val=False), ["--apply"], 4),
        ("conflict_apply_dry_run", base_config(apply_val=True), ["--apply", "--dry-run"], 1),
    ]
    for bad_idx, bad_val in enumerate(["true", "false", 1, 0, None]):
        reject_cases.append((f"malformed_cfg_no_req_{bad_idx}", base_config(apply_val=bad_val), [], 4))
        reject_cases.append((f"malformed_cfg_with_apply_{bad_idx}", base_config(apply_val=bad_val), ["--apply"], 4))

    for name, cfg_obj, flags, expected_rc in reject_cases:
        reset_ledger_and_state(checkout_dir)
        if cfg_obj is not None:
            cfg_rel = write_cfg(checkout_dir, f"daily-{name}.json", cfg_obj)
            argv = ["--config", cfg_rel, "--run-id", f"raw-{name}", *flags]
        else:
            argv = ["--run-id", f"raw-{name}", *flags]
        rc, out, err, events = run_cli_raw_daily(checkout_dir, argv, spy_log)
        assert rc == expected_rc, f"daily.main {name}: expected rc={expected_rc}, got {rc} out={out} err={err}"
        assert len(events) == 0, f"daily.main {name} leaked dispatch before reject: {events}"
        assert not os.path.exists(os.path.join(checkout_dir, "runs", f"raw-{name}")), f"daily.main {name} wrote run dir before gate!"
        matrix_results.append((f"daily.main:{name}", rc, len(events), write_count(events)))

    # 3. Direct daily.run_once malformed request bools & gate enforcement
    ro_cases = [
        ("ro_config_only_apply_false", base_config(apply_val=True), False, False, 0, 0),
        ("ro_apply_cfg_false", base_config(apply_val=False), True, False, 4, 0),
        ("ro_malformed_req_str", base_config(apply_val=True), "true", False, 1, 0),
        ("ro_malformed_req_int", base_config(apply_val=True), 1, False, 1, 0),
        ("ro_malformed_req_none", base_config(apply_val=True), None, False, 1, 0),
        ("ro_malformed_dry_str", base_config(apply_val=True), False, "true", 1, 0),
        ("ro_conflict_both_true", base_config(apply_val=True), True, True, 1, 0),
    ]
    for name, cfg_obj, a_arg, d_arg, exp_rc, exp_writes in ro_cases:
        reset_ledger_and_state(checkout_dir)
        rc, err, events = run_inproc_daily_run_once(checkout_dir, cfg_obj, f"ro-{name}", a_arg, d_arg, spy_log)
        assert rc == exp_rc, f"run_once {name}: expected {exp_rc}, got {rc} ({err})"
        assert write_count(events) == exp_writes, f"run_once {name}: expected {exp_writes} writes, got {events}"
        if exp_rc == 0:
            assert_preview_artifacts_absent_and_safe(checkout_dir, f"ro-{name}")
        matrix_results.append((f"daily.run_once:{name}", rc, all_dispatch_count(events), write_count(events)))

    # 4. Dual opt-in API mode: reaches spy deploy_api & convert_api with --apply, marks applied=True
    reset_ledger_and_state(checkout_dir)
    cfg_api_live = base_config(apply_val=True, deploy_mode="api")
    cfg_rel_api = write_cfg(checkout_dir, "daily-api-live.json", cfg_api_live)
    rc, out, err, events = run_cli_raw_daily(checkout_dir, ["--config", cfg_rel_api, "--run-id", "raw-api-live", "--apply"], spy_log)
    assert rc == 0, f"daily.main api dual opt-in failed: rc={rc} err={err} out={out}"
    plugins_hit = {e["plugin"] for e in events if e["is_write"]}
    with open(os.path.join(checkout_dir, "runs", "raw-api-live", "report.json"), encoding="utf-8") as fh:
        rep_live = json.load(fh)
    assert "traffic.deploy_api" in plugins_hit, f"expected spy deploy_api write hit, got {events}\nlog={out}"
    assert "traffic.convert_api" in plugins_hit, f"expected spy convert_api write hit, got {events}\nlog={out}\nactions={rep_live['actions']}"
    assert any(
        a.get("node") in ("campaign.adjust", "keyword.action", "conversion.upload") and a.get("applied") is True
        for a in rep_live["actions"]
    ), f"expected mutable applied=True action in live run: {rep_live['actions']}"
    matrix_results.append(("daily.main:dual_opt_in_api", rc, all_dispatch_count(events), write_count(events)))

    # Also test direct run_once dual opt-in reaches spy writes
    reset_ledger_and_state(checkout_dir)
    rc, err, events = run_inproc_daily_run_once(checkout_dir, cfg_api_live, "ro-live", True, False, spy_log)
    assert rc == 0 and write_count(events) >= 2, f"run_once live failed: rc={rc} events={events} err={err}"
    matrix_results.append(("daily.run_once:dual_opt_in_api", rc, all_dispatch_count(events), write_count(events)))

    # 5. Dual opt-in MANUAL mode: emits actions-todo.json + outbox/conversions-*.csv AND --ack updates them
    reset_ledger_and_state(checkout_dir)
    cfg_manual_live = base_config(apply_val=True, deploy_mode="manual")
    cfg_rel_ml = write_cfg(checkout_dir, "daily-manual-live.json", cfg_manual_live)
    rc, out, err, events = run_cli_raw_daily(checkout_dir, ["--config", cfg_rel_ml, "--run-id", "raw-manual-live", "--apply"], spy_log)
    assert rc == 0, f"daily.main manual live failed: rc={rc} err={err}"
    todo_path = os.path.join(checkout_dir, "runs", "raw-manual-live", "actions-todo.json")
    assert os.path.isfile(todo_path), "manual dual opt-in must emit actions-todo.json"
    outbox_csvs = [f for f in os.listdir(os.path.join(checkout_dir, "data", "outbox")) if f.endswith(".csv")]
    assert len(outbox_csvs) == 1, f"manual dual opt-in must emit outbox CSV, got {outbox_csvs}; events={events}; out={out}"
    assert any(e["plugin"] == "traffic.convert_export" for e in events), f"expected convert_export dispatch, got {events}"
    rc_ack, out_ack, err_ack, _ = run_cli_raw_daily(checkout_dir, ["--config", cfg_rel_ml, "--ack", "raw-manual-live", "--apply"], spy_log)
    assert rc_ack == 0 and "acked " in out_ack and "acked 0 " not in out_ack, f"manual ack failed: rc={rc_ack} out={out_ack} err={err_ack}"
    matrix_results.append(("daily.main:dual_opt_in_manual", rc, all_dispatch_count(events), write_count(events)))

    # 6. Dual opt-in WITH existing action gates DENYING: propose_only AND compliance user hold -> ZERO mock external writes!
    reset_ledger_and_state(checkout_dir)
    cfg_propose = base_config(apply_val=True, deploy_mode="api", autonomy="propose_only")
    cfg_rel_prop = write_cfg(checkout_dir, "daily-propose-only.json", cfg_propose)
    rc, out, err, events = run_cli_raw_daily(checkout_dir, ["--config", cfg_rel_prop, "--run-id", "raw-propose-only", "--apply"], spy_log)
    assert rc == 0, f"daily.main propose_only failed: rc={rc} err={err}"
    assert all_dispatch_count(events) == 0, f"propose_only must execute 0 external writes even under dual opt-in! {events}"
    matrix_results.append(("daily.main:dual_opt_in_propose_only_deny", rc, all_dispatch_count(events), write_count(events)))

    # 7. Dual opt-in WITH manual propose_only -> zero actions-todo.json and zero outbox CSV
    reset_ledger_and_state(checkout_dir)
    cfg_man_prop = base_config(apply_val=True, deploy_mode="manual", autonomy="propose_only")
    cfg_rel_mp = write_cfg(checkout_dir, "daily-manual-propose.json", cfg_man_prop)
    rc, out, err, events = run_cli_raw_daily(checkout_dir, ["--config", cfg_rel_mp, "--run-id", "raw-man-propose", "--apply"], spy_log)
    assert rc == 0 and all_dispatch_count(events) == 0
    assert not os.path.exists(os.path.join(checkout_dir, "runs", "raw-man-propose", "actions-todo.json"))
    matrix_results.append(("daily.main:dual_opt_in_manual_propose_deny", rc, all_dispatch_count(events), write_count(events)))

    # 8. Dual opt-in WITH anomaly/account gate DENYING (SUSPENDED triggers pause_all blocking adjustments) -> ZERO mock external writes!
    reset_ledger_and_state(checkout_dir)
    with open(os.path.join(checkout_dir, "data", "fake_account_status.json"), "w", encoding="utf-8") as fh:
        json.dump({"status": "SUSPENDED", "account_status": "SUSPENDED", "disapprovals": 0}, fh)
    comm_json_p = os.path.join(checkout_dir, "data", "inbox", "cj-commissions.json")
    comm_obj = json.load(open(comm_json_p, encoding="utf-8"))
    comm_obj["rows"] = []
    with open(comm_json_p, "w", encoding="utf-8") as fh:
        json.dump(comm_obj, fh)
    cfg_susp = base_config(apply_val=True, deploy_mode="api")
    cfg_susp["traffic"]["report_source"] = "api"
    cfg_rel_susp = write_cfg(checkout_dir, "daily-susp-halt.json", cfg_susp)
    rc, out, err, events = run_cli_raw_daily(checkout_dir, ["--config", cfg_rel_susp, "--run-id", "raw-susp-deny", "--apply"], spy_log)
    assert rc == 0, f"suspended halt unexpected rc={rc} err={err}\nlog={out}"
    assert "pause_all" in out, f"expected anomaly pause_all in log: {out}"
    assert all_dispatch_count(events) == 0 and write_count(events) == 0, f"suspended halt leaked writes: {events}\nlog={out}"
    matrix_results.append(("daily.main:dual_opt_in_anomaly_pause_all_deny", rc, all_dispatch_count(events), write_count(events)))

    # 9. Preview with report_source=api performs configured read (report_api) and 0 external writes
    reset_ledger_and_state(checkout_dir)
    cfg_read_prev = base_config(apply_val=True, deploy_mode="api")
    cfg_read_prev["traffic"]["report_source"] = "api"
    cfg_rel_rp = write_cfg(checkout_dir, "daily-read-prev.json", cfg_read_prev)
    rc_rp, out_rp, err_rp, ev_rp = run_cli_raw_daily(checkout_dir, ["--config", cfg_rel_rp, "--run-id", "raw-read-prev", "--dry-run"], spy_log)
    assert rc_rp == 0, f"preview configured read failed: rc={rc_rp} err={err_rp} out={out_rp}"
    assert any(e["plugin"] == "traffic.report_api" for e in ev_rp), f"expected configured read report_api call in preview, got {ev_rp}"
    assert all_dispatch_count(ev_rp) == 0 and write_count(ev_rp) == 0, f"preview configured read leaked external write: {ev_rp}"

    # Also verify explicit --help / -h returns 0 cleanly even without config/adspilot.json
    proc_help = subprocess.run([sys.executable, "core/loop/daily.py", "--help"], cwd=checkout_dir, env=clean_offline_env(), capture_output=True, text=True)
    assert proc_help.returncode == 0 and "config.apply" in proc_help.stdout
    matrix_results.append(("daily.main:preview_configured_read", rc_rp, all_dispatch_count(ev_rp), write_count(ev_rp)))
    return matrix_results


def run_adspilot_cli(checkout_dir, argv, spy_log):
    reset_spy(spy_log)
    proc = subprocess.run(
        [sys.executable, "adspilot.py", *argv],
        cwd=checkout_dir,
        env=clean_offline_env(),
        capture_output=True,
        text=True,
    )
    return proc.returncode, proc.stdout, proc.stderr, read_spy_events(spy_log)


def test_structured_cli_matrix(checkout_dir, spy_log):
    """Verify adspilot.py across loop.run, traffic.google-ads.deploy, deploy.cloudflare.publish, loop.ack."""
    matrix_results = []
    cfg_off_rel = write_cfg(checkout_dir, "c_off.json", base_config(apply_val=False))
    cfg_on_rel = write_cfg(checkout_dir, "c_on.json", base_config(apply_val=True))
    cfg_missing_key_rel = write_cfg(checkout_dir, "c_nokey.json", base_config(include_apply=False))
    cfg_malformed_str_rel = write_cfg(checkout_dir, "c_badstr.json", base_config(apply_val="true"))
    cfg_malformed_int_rel = write_cfg(checkout_dir, "c_badint.json", base_config(apply_val=1))
    cfg_manual_on_rel = write_cfg(checkout_dir, "c_man.json", base_config(apply_val=True, deploy_mode="manual"))

    # Fixture inputs for traffic.google-ads.deploy & deploy.cloudflare.publish
    with open(os.path.join(checkout_dir, "tests", "fixtures", "interfaces", "traffic.google-ads.deploy.request.json"), encoding="utf-8") as fh:
        tdeploy_base = json.load(fh)
    with open(os.path.join(checkout_dir, "tests", "fixtures", "interfaces", "deploy.cloudflare.publish.request.json"), encoding="utf-8") as fh:
        dpub_base = json.load(fh)

    def write_req(name, obj):
        p = os.path.join(checkout_dir, f"{name}.req.json")
        with open(p, "w", encoding="utf-8") as fh:
            json.dump(obj, fh)
        return p

    # Matrix across loop.run, traffic.google-ads.deploy, deploy.cloudflare.publish
    endpoints = [
        ("loop.run", lambda r: write_req("loop_run", {"run_id": r})),
        ("traffic.google-ads.deploy", lambda _: write_req("tdeploy", tdeploy_base)),
        ("deploy.cloudflare.publish", lambda _: write_req("dpub", dpub_base)),
    ]
    for iface, make_req in endpoints:
        base_inp = make_req("cbase-00")
        cases = [
            # (case_name, cli_args, req_override, expected_rc, allow_dispatch, expect_write)
            ("absent_request", ["--config", cfg_off_rel, "--input", base_inp], None, 0, False, False),
            ("config_only_true", ["--config", cfg_on_rel, "--input", base_inp], None, 0, False, False),
            ("explicit_preview_cfg_true", ["--config", cfg_on_rel, "--dry-run", "--input", base_inp], None, 0, False, False),
            ("req_only_missing_cfg_file", ["--config", "config/c_nope.json", "--apply", "--input", base_inp], None, 4, False, False),
            ("req_only_missing_cfg_key", ["--config", cfg_missing_key_rel, "--apply", "--input", base_inp], None, 4, False, False),
            ("req_only_cfg_off", ["--config", cfg_off_rel, "--apply", "--input", base_inp], None, 4, False, False),
            ("malformed_cfg_str", ["--config", cfg_malformed_str_rel, "--apply", "--input", base_inp], None, 4, False, False),
            ("malformed_cfg_int", ["--config", cfg_malformed_int_rel, "--apply", "--input", base_inp], None, 4, False, False),
            ("malformed_req_str_with_flag", ["--config", cfg_on_rel, "--apply"], {"apply": "true"}, 1, False, False),
            ("malformed_req_int", ["--config", cfg_on_rel], {"apply": 1}, 1, False, False),
            ("malformed_req_none", ["--config", cfg_on_rel], {"apply": None}, 1, False, False),
            ("malformed_dry_str_with_flag", ["--config", cfg_on_rel, "--dry-run"], {"dry_run": "true"}, 1, False, False),
            ("conflict_cli_flags", ["--config", cfg_on_rel, "--apply", "--dry-run", "--input", base_inp], None, 4, False, False),
            ("conflict_json_flags", ["--config", cfg_on_rel], {"apply": True, "dry_run": True}, 4, False, False),
            ("conflict_cli_apply_json_off", ["--config", cfg_on_rel, "--apply"], {"apply": False}, 1, False, False),
            ("dual_opt_in", ["--config", cfg_on_rel, "--apply", "--input", base_inp], None, 0, True, True),
        ]
        for idx, (cname, cli_args, override, exp_rc, allow_disp, exp_write) in enumerate(cases):
            run_tag = f"cr-{idx:02d}"
            if iface == "loop.run":
                reset_ledger_and_state(checkout_dir)
                req_obj = {"run_id": run_tag}
            elif iface == "traffic.google-ads.deploy":
                req_obj = copy.deepcopy(tdeploy_base)
            else:
                req_obj = copy.deepcopy(dpub_base)
            if override is not None:
                req_obj.update(override)
                inp_path = write_req(f"{iface}_{idx:02d}", req_obj)
                cli_args = [*cli_args, "--input", inp_path]
            elif iface == "loop.run":
                inp_path = write_req(f"{iface}_{idx:02d}", req_obj)
                pos = cli_args.index("--input")
                cli_args = [*cli_args[:pos], "--input", inp_path, *cli_args[pos + 2 :]]

            rc, out, err, events = run_adspilot_cli(checkout_dir, [iface, *cli_args], spy_log)
            assert rc == exp_rc, f"adspilot {iface} {cname}: expected rc={exp_rc}, got {rc} out={out} err={err}"
            if not exp_write:
                assert write_count(events) == 0, f"adspilot {iface} {cname} wrote unexpectedly: {events}"
                if exp_rc != 0 or iface != "traffic.google-ads.deploy":
                    assert all_dispatch_count(events) == 0, f"adspilot {iface} {cname} dispatched external plugin in preview/reject: {events}"
                elif iface == "traffic.google-ads.deploy":
                    parsed = json.loads(out)
                    assert parsed.get("mode") == "dry" and parsed.get("applied") is False, f"expected dry deploy plan, got {parsed}"
            else:
                assert write_count(events) >= 1, f"adspilot {iface} {cname} missed spy write! events={events} out={out}"
            if iface == "loop.run" and exp_rc == 0 and not exp_write:
                assert_preview_artifacts_absent_and_safe(checkout_dir, run_tag)
            matrix_results.append((f"adspilot:{iface}:{cname}", rc, all_dispatch_count(events), write_count(events)))

    # loop.ack checks via adspilot CLI: preview returns dry_run=True; --apply on preview run returns acknowledged=0; --apply on manual live run >0
    reset_ledger_and_state(checkout_dir)
    preview_req = write_req("loop_run_prev_ack", {"run_id": "clia-prev"})
    rc, out_p, err_p, _ = run_adspilot_cli(checkout_dir, ["loop.run", "--config", cfg_manual_on_rel, "--input", preview_req], spy_log)
    assert rc == 0, f"cli preview ack setup failed: {out_p} {err_p}"
    ack_prev_req = write_req("ack_prev", {"run_id": "clia-prev"})
    rc_ad, out_ad, err_ad, _ = run_adspilot_cli(checkout_dir, ["loop.ack", "--config", cfg_manual_on_rel, "--input", ack_prev_req], spy_log)
    assert rc_ad == 0 and json.loads(out_ad).get("dry_run") is True, f"cli ack preview dry_run failed: {out_ad} {err_ad}"
    rc_a0, out_a0, err_a0, _ = run_adspilot_cli(checkout_dir, ["loop.ack", "--config", cfg_manual_on_rel, "--apply", "--input", ack_prev_req], spy_log)
    assert rc_a0 == 0 and json.loads(out_a0)["acknowledged"] == 0, f"cli ack on preview run failed: {out_a0} {err_a0}"

    reset_ledger_and_state(checkout_dir)
    live_man_req = write_req("loop_run_live_ack", {"run_id": "clia-live"})
    rc, out_l, err_l, _ = run_adspilot_cli(checkout_dir, ["loop.run", "--config", cfg_manual_on_rel, "--apply", "--input", live_man_req], spy_log)
    assert rc == 0, f"cli live ack setup failed: {out_l} {err_l}"
    ack_live_req = write_req("ack_live", {"run_id": "clia-live"})
    rc_a1, out_a1, err_a1, _ = run_adspilot_cli(checkout_dir, ["loop.ack", "--config", cfg_manual_on_rel, "--apply", "--input", ack_live_req], spy_log)
    assert rc_a1 == 0 and json.loads(out_a1)["acknowledged"] > 0, f"ack_live failed: {out_a1} {err_a1}"
    matrix_results.append(("adspilot:loop.ack:preview_0_live_gt0", rc_a1, 0, 0))
    return matrix_results


class McpClient:
    def __init__(self, checkout_dir, server_config=None):
        cmd = [sys.executable, "core/agent/mcp_server.py"]
        if server_config:
            cmd.extend(["--config", server_config])
        self.proc = subprocess.Popen(
            cmd,
            cwd=checkout_dir,
            env=clean_offline_env(),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        self._id = 0

    def request(self, method, params=None):
        self._id += 1
        msg = {"jsonrpc": "2.0", "id": self._id, "method": method}
        if params is not None:
            msg["params"] = params
        self.proc.stdin.write(json.dumps(msg) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        assert line, f"MCP EOF while waiting for {method}; stderr={self.proc.stderr.read()}"
        return json.loads(line)

    def notify(self, method, params=None):
        msg = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            msg["params"] = params
        self.proc.stdin.write(json.dumps(msg) + "\n")
        self.proc.stdin.flush()

    def close(self):
        try:
            self.proc.stdin.close()
        except Exception:
            pass
        self.proc.wait(timeout=5)


def test_mcp_stdio_matrix(checkout_dir, spy_log):
    """Verify real MCP stdio server enforces identical write gate across loop.run, deploy, publish, loop.ack."""
    matrix_results = []
    write_cfg(checkout_dir, "m_off.json", base_config(apply_val=False))
    write_cfg(checkout_dir, "m_on.json", base_config(apply_val=True))
    write_cfg(checkout_dir, "m_nokey.json", base_config(include_apply=False))
    write_cfg(checkout_dir, "m_badstr.json", base_config(apply_val="true"))
    write_cfg(checkout_dir, "m_man.json", base_config(apply_val=True, deploy_mode="manual"))

    with open(os.path.join(checkout_dir, "tests", "fixtures", "interfaces", "traffic.google-ads.deploy.request.json"), encoding="utf-8") as fh:
        tdeploy_base = json.load(fh)
    with open(os.path.join(checkout_dir, "tests", "fixtures", "interfaces", "deploy.cloudflare.publish.request.json"), encoding="utf-8") as fh:
        dpub_base = json.load(fh)

    clients = {}

    def get_client(cfg_rel):
        if cfg_rel not in clients:
            c = McpClient(checkout_dir, server_config=cfg_rel)
            init_res = c.request(
                "initialize",
                {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "wg-test", "version": "1.0"}},
            )
            assert "result" in init_res, f"MCP initialize failed for {cfg_rel}: {init_res}"
            c.notify("notifications/initialized")
            clients[cfg_rel] = c
        return clients[cfg_rel]

    try:
        listed = get_client("config/m_on.json").request("tools/list")
        tool_names = {t["name"] for t in listed["result"]["tools"]}
        for expected in ("loop.run", "traffic.google-ads.deploy", "deploy.cloudflare.publish", "loop.ack"):
            assert expected in tool_names, f"missing MCP tool {expected}"

        # Verify caller cannot override host --config via tool arguments
        reset_spy(spy_log)
        override_res = get_client("config/m_off.json").request(
            "tools/call",
            {"name": "deploy.cloudflare.publish", "arguments": {"config": "config/m_on.json", **copy.deepcopy(dpub_base), "apply": True}},
        )
        assert override_res.get("result", {}).get("isError") is True
        assert all_dispatch_count(read_spy_events(spy_log)) == 0

        mcp_cases = [
            ("absent_request", "config/m_off.json", {}, False, False, False),
            ("config_only_true", "config/m_on.json", {}, False, False, False),
            ("explicit_preview_cfg_true", "config/m_on.json", {"dry_run": True}, False, False, False),
            ("req_only_missing_cfg_file", "config/m_nope.json", {"apply": True}, True, False, False),
            ("req_only_missing_cfg_key", "config/m_nokey.json", {"apply": True}, True, False, False),
            ("req_only_cfg_off", "config/m_off.json", {"apply": True}, True, False, False),
            ("malformed_cfg_str", "config/m_badstr.json", {"apply": True}, True, False, False),
            ("malformed_req_str", "config/m_on.json", {"apply": "true"}, True, False, False),
            ("malformed_req_int", "config/m_on.json", {"apply": 1}, True, False, False),
            ("malformed_dry_str", "config/m_on.json", {"dry_run": "true"}, True, False, False),
            ("conflict_apply_and_dry", "config/m_on.json", {"apply": True, "dry_run": True}, True, False, False),
            ("dual_opt_in", "config/m_on.json", {"apply": True}, False, True, True),
        ]

        for tool_name in ("loop.run", "traffic.google-ads.deploy", "deploy.cloudflare.publish"):
            for idx, (cname, cfg_rel, flags, exp_err, allow_disp, exp_write) in enumerate(mcp_cases):
                if tool_name == "loop.run":
                    reset_ledger_and_state(checkout_dir)
                    args = {"run_id": f"mr-{idx:02d}", **flags}
                elif tool_name == "traffic.google-ads.deploy":
                    args = {**copy.deepcopy(tdeploy_base), **flags}
                else:
                    args = {**copy.deepcopy(dpub_base), **flags}
                reset_spy(spy_log)
                res = get_client(cfg_rel).request("tools/call", {"name": tool_name, "arguments": args})
                events = read_spy_events(spy_log)
                is_err = bool(res.get("error")) or bool(res.get("result", {}).get("isError"))
                assert is_err == exp_err, f"MCP {tool_name} {cname}: expected isError={exp_err}, got {res}"
                if not exp_write:
                    assert write_count(events) == 0, f"MCP {tool_name} {cname} wrote unexpectedly: {events}"
                    if exp_err or tool_name != "traffic.google-ads.deploy":
                        assert all_dispatch_count(events) == 0, f"MCP {tool_name} {cname} dispatched in preview/reject: {events}"
                    elif tool_name == "traffic.google-ads.deploy":
                        parsed = json.loads(res["result"]["content"][0]["text"])
                        assert parsed.get("mode") == "dry" and parsed.get("applied") is False, f"expected dry MCP deploy plan, got {parsed}"
                else:
                    assert write_count(events) >= 1, f"MCP {tool_name} {cname} missed spy write: {res}"
                if tool_name == "loop.run" and not exp_err and not exp_write:
                    assert_preview_artifacts_absent_and_safe(checkout_dir, args["run_id"])
                matrix_results.append((f"mcp:{tool_name}:{cname}", int(is_err), all_dispatch_count(events), write_count(events)))

        # MCP loop.ack on manual preview vs manual dual opt-in
        man_client = get_client("config/m_man.json")
        reset_ledger_and_state(checkout_dir)
        res_prev = man_client.request("tools/call", {"name": "loop.run", "arguments": {"run_id": "mcpa-prev"}})
        assert not res_prev["result"].get("isError"), f"mcp prev ack setup failed: {res_prev}"
        ack_dry = man_client.request("tools/call", {"name": "loop.ack", "arguments": {"run_id": "mcpa-prev"}})
        assert not ack_dry["result"].get("isError"), f"mcp ack dry failed: {ack_dry}"
        assert json.loads(ack_dry["result"]["content"][0]["text"]).get("dry_run") is True
        ack_prev = man_client.request("tools/call", {"name": "loop.ack", "arguments": {"run_id": "mcpa-prev", "apply": True}})
        assert not ack_prev["result"].get("isError"), f"mcp ack prev failed: {ack_prev}"
        assert json.loads(ack_prev["result"]["content"][0]["text"])["acknowledged"] == 0

        reset_ledger_and_state(checkout_dir)
        res_live = man_client.request("tools/call", {"name": "loop.run", "arguments": {"run_id": "mcpa-live", "apply": True}})
        assert not res_live["result"].get("isError"), f"mcp live ack setup failed: {res_live}"
        ack_live = man_client.request("tools/call", {"name": "loop.ack", "arguments": {"run_id": "mcpa-live", "apply": True}})
        assert not ack_live["result"].get("isError"), f"mcp ack live failed: {ack_live}"
        assert json.loads(ack_live["result"]["content"][0]["text"])["acknowledged"] > 0
        matrix_results.append(("mcp:loop.ack:preview_0_live_gt0", 0, 0, 0))
    finally:
        for c in clients.values():
            c.close()
    return matrix_results


def test_schedulers_offline():
    """Verify shipped crontab, systemd, and Windows scheduler scripts default explicitly to preview."""
    cron_txt = open(os.path.join(ROOT, "core", "loop", "crontab.example"), encoding="utf-8").read()
    active_cron = [ln.strip() for ln in cron_txt.splitlines() if ln.strip() and not ln.strip().startswith("#")]
    daily_cron = [ln for ln in active_cron if "daily.py" in ln]
    assert len(daily_cron) == 1, f"expected 1 active daily cron line, got {daily_cron}"
    assert "--dry-run" in daily_cron[0] and "--apply" not in daily_cron[0], f"bad cron default: {daily_cron[0]}"

    svc_txt = open(os.path.join(ROOT, "core", "loop", "systemd", "adspilot-daily.service"), encoding="utf-8").read()
    exec_lines = [ln.strip() for ln in svc_txt.splitlines() if ln.strip().startswith("ExecStart=")]
    assert len(exec_lines) == 1 and "daily.py --dry-run" in exec_lines[0] and "--apply" not in exec_lines[0], f"bad systemd ExecStart: {exec_lines}"

    reg_txt = open(os.path.join(ROOT, "core", "loop", "windows", "register-task.ps1"), encoding="utf-8").read()
    assert "[switch]$DryRun" in reg_txt and "[switch]$Apply" in reg_txt
    assert "Conflicting flags: -Apply and -DryRun" in reg_txt
    assert '-DryRun"' in reg_txt and 'if ($Apply) { $arguments += " -Apply" }' in reg_txt

    run_txt = open(os.path.join(ROOT, "core", "loop", "windows", "run-task.ps1"), encoding="utf-8").read()
    assert "[switch]$DryRun" in run_txt and "[switch]$Apply" in run_txt
    assert "Conflicting flags: -Apply and -DryRun" in run_txt
    assert '"core/loop/daily.py" "--dry-run"' in run_txt and '"core/loop/daily.py" "--apply"' in run_txt

    pwsh = shutil.which("pwsh") or shutil.which("powershell.exe") or shutil.which("powershell")
    if pwsh:
        res = subprocess.run([pwsh, "-NoProfile", "-File", os.path.join(ROOT, "tests", "k2_windows_preview.ps1")], capture_output=True, text=True)
        assert res.returncode == 0, f"Windows preview script failed: {res.stdout}\n{res.stderr}"
        pwsh_note = f"pwsh executed ok ({pwsh})"
    else:
        pwsh_note = "pwsh unavailable on Linux host (static template checks passed)"
    print(f"ok   schedulers: cron=--dry-run systemd=--dry-run windows=-DryRun/--dry-run ({pwsh_note})")


def main():
    test_unit_truth_table()
    test_schedulers_offline()
    with tempfile.TemporaryDirectory(prefix="adspilot-wg-") as tmp:
        checkout_dir = copy_checkout(os.path.join(tmp, "AdsPilot"))
        spy_log = install_spy_plugins(checkout_dir)
        m1 = test_raw_daily_matrix(checkout_dir, spy_log)
        m2 = test_structured_cli_matrix(checkout_dir, spy_log)
        m3 = test_mcp_stdio_matrix(checkout_dir, spy_log)
        all_rows = m1 + m2 + m3
        non_live = [r for r in all_rows if "dual_opt_in" not in r[0] or "deny" in r[0]]
        live = [r for r in all_rows if "dual_opt_in" in r[0] and "deny" not in r[0]]
        print(
            "ok   raw_daily=%d structured_cli=%d mcp_stdio=%d non_live_writes=%d live_writes=%d (non_live_dispatches=%d live_dispatches=%d)"
            % (
                len(m1),
                len(m2),
                len(m3),
                sum(r[3] for r in non_live),
                sum(r[3] for r in live),
                sum(r[2] for r in non_live),
                sum(r[2] for r in live),
            )
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
