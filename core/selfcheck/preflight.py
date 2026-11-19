#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
上线前只读总检（config / SOUL-FX / 判断提供者 / Google Ads OAuth scope 与币种 / Cloudflare /health + /export）

设计目标：
  - 默认离线（dry-run）：只检查配置结构、SOUL 与 FX 映射、环境变量是否齐全，不发外部请求。
  - 加 `--apply` 才联网做只读探测：核对 Google Ads 真实账户币种 == config.currency、OAuth 含 adwords+datamanager
    双 scope，以及落地位 `/health` 与 `/export` Bearer 鉴权。
  - 绝不输出任何凭据值、gclid 或私钥。

用法：
  python3 core/selfcheck/preflight.py [--config config/adspilot.json] [--apply]
  python3 core/selfcheck/preflight.py --selftest

退出码：0 通过或仅 warn；4 存在 fail（缺关键配置/凭据、币种不一致、scope 缺失或落地位鉴权失败）。
"""
import argparse
import http.server
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "core" / "judge"))
sys.path.insert(0, str(ROOT / "core" / "selfcheck"))
sys.path.insert(0, str(ROOT / "plugins" / "traffic" / "google-ads"))

import judge as J  # noqa: E402
import validate as V  # noqa: E402


def _item(check, status, detail, fix=""):
    return {"check": check, "status": status, "detail": detail, "fix": fix}


def _load_cfg(config_path):
    if config_path:
        p = Path(config_path)
        if not p.is_absolute():
            p = ROOT / p
        if not p.is_file():
            raise FileNotFoundError("config file not found: %s" % config_path)
        return json.loads(p.read_text(encoding="utf-8")), str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else p.name, False
    local_cfg = ROOT / "config" / "adspilot.json"
    if local_cfg.is_file():
        return json.loads(local_cfg.read_text(encoding="utf-8")), "config/adspilot.json", False
    ex_cfg = ROOT / "config" / "adspilot.example.json"
    return json.loads(ex_cfg.read_text(encoding="utf-8")), "config/adspilot.example.json", True


def _http_json(url, headers=None, timeout=15):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "adspilot-preflight/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def _http_text(url, headers=None, timeout=15):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "adspilot-preflight/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode("utf-8", errors="replace")


def _probe_google_ads(cfg, env, oauth_mod, report_mod):
    try:
        scopes_res, scope_rc = oauth_mod.inspect_refresh_scopes(env)
    except Exception as exc:  # noqa: BLE001
        return _item("google_ads_live", "fail", "OAuth refresh failed: %s" % str(exc)[:160],
                     "运行 plugins/traffic/google-ads/oauth_helper.py --apply 重新授权")
    if scope_rc == 4:
        return _item("google_ads_live", "fail", "missing OAuth env vars", "补齐 GOOGLE_ADS_* 环境变量")
    if scope_rc == 2:
        return _item("google_ads_live", "fail",
                     "missing required OAuth scope(s): %s" % ",".join(scopes_res.get("missing_scopes") or []),
                     "用 oauth_helper.py --apply 重授权，必须同时勾 adwords 与 datamanager")
    if scope_rc != 0:
        return _item("google_ads_live", "fail", "OAuth tokeninfo failed", "检查 Google Cloud OAuth 客户端")

    try:
        tok = report_mod.access_token(env)
        chunks = report_mod.search_stream(env, tok, report_mod.ACCOUNT_STATUS_GAQL)
        acct = report_mod.parse_account_status(chunks)
    except Exception as exc:  # noqa: BLE001
        return _item("google_ads_live", "fail", "Google Ads customer query failed: %s" % str(exc)[:160],
                     "检查 GOOGLE_ADS_CUSTOMER_ID（不带横线）与 API 权限")

    acct_currency = acct.get("currency") or ""
    acct_status = acct.get("account_status") or "unknown"
    want_currency = cfg.get("currency") or ""
    if acct_currency and want_currency and acct_currency != want_currency:
        return _item("google_ads_live", "fail",
                     "currency mismatch: account=%s config.currency=%s" % (acct_currency, want_currency),
                     "把 config.currency 改成 %s 并在 config.fx 填对应汇率" % acct_currency)
    if acct_status not in ("ok", "enabled", ""):
        return _item("google_ads_live", "fail",
                     "account_status=%s (currency=%s)" % (acct_status, acct_currency or "?"),
                     "账号被暂停或受限，先在 Google Ads 后台完成本人验证/申诉")
    return _item("google_ads_live", "pass",
                 "currency=%s status=%s scopes=adwords+datamanager" % (acct_currency or want_currency, acct_status))


def _probe_deploy(cfg, env, deploy_file):
    dep_cfg = cfg.get("deploy") or {}
    export_url = dep_cfg.get("export_url") or ""
    host = dep_cfg.get("host") or ""
    export_env = dep_cfg.get("export_key_env") or "ADSPILOT_EXPORT_KEY"
    export_key = env.get(export_env, "")

    base_url = ""
    if export_url:
        parsed = urllib.parse.urlparse(export_url)
        if parsed.scheme and parsed.netloc:
            base_url = "%s://%s" % (parsed.scheme, parsed.netloc)
    elif host:
        base_url = host if "://" in host else ("https://" + host)
    elif deploy_file.is_file():
        try:
            dep_doc = json.loads(deploy_file.read_text(encoding="utf-8"))
            base_url = dep_doc.get("base_url") or ""
            export_url = export_url or dep_doc.get("export_url") or ""
            export_key = export_key or dep_doc.get("export_key") or ""
        except ValueError:
            pass

    if not base_url:
        return _item("deploy_live", "skip", "no deploy host or export_url configured")

    try:
        code, body = _http_json(base_url.rstrip("/") + "/health")
        if code != 200 or body.get("ok") is not True:
            return _item("deploy_live", "fail", "/health unhealthy (HTTP %s)" % code,
                         "运行 plugins/deploy/cloudflare/status.py 检查 Worker")
    except Exception as exc:  # noqa: BLE001
        return _item("deploy_live", "fail", "/health unreachable: %s" % str(exc)[:160],
                     "确认 Cloudflare Worker 已部署且域名生效")

    if export_url or base_url:
        exp_target = export_url or (base_url.rstrip("/") + "/export")
        if not export_key:
            return _item("deploy_live", "warn", "/health ok; missing %s so /export auth not verified" % export_env,
                         "注入 %s 或由 setup.py 写入 data/deploy.json" % export_env)
        since = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 3600))
        try:
            code, _ = _http_text("%s?since=%s" % (exp_target, urllib.parse.quote(since)),
                                 headers={"Authorization": "Bearer " + export_key, "User-Agent": "adspilot-preflight/1.0"})
            if code != 200:
                return _item("deploy_live", "fail", "/export returned HTTP %s" % code, "核对 EXPORT_KEY 与 Worker secret")
        except urllib.error.HTTPError as exc:
            return _item("deploy_live", "fail", "/export auth failed (HTTP %s)" % exc.code,
                         "核对 %s 与 Worker EXPORT_KEY secret 是否一致" % export_env)
        except Exception as exc:  # noqa: BLE001
            return _item("deploy_live", "fail", "/export error: %s" % str(exc)[:160], "检查落地位 Worker 状态")

    return _item("deploy_live", "pass", "/health ok & /export Bearer auth ok")


def run_preflight(cfg, config_label="config/adspilot.json", is_example=False, apply=False, env=None,
                  oauth_mod=None, report_mod=None):
    env = os.environ if env is None else env
    checks = []

    schema_errs = V.validate(V.CONFIG_SCHEMA, cfg)
    if schema_errs:
        checks.append(_item("config_schema", "fail", "; ".join(schema_errs[:3]), "修正 config 字段格式"))
    else:
        checks.append(_item("config_schema", "pass", "%s valid" % config_label))

    if is_example:
        checks.append(_item("config_file", "warn", "using %s (copy to config/adspilot.json)" % config_label,
                            "cp config/adspilot.example.json config/adspilot.json"))
    elif not cfg.get("apply"):
        checks.append(_item("config_file", "warn", "dry-run mode (config apply disabled)",
                            "首轮 dry-run 核对无误后再将 apply 设为 true"))
    else:
        checks.append(_item("config_file", "pass", "config apply enabled"))

    # Writable workspace paths
    writable_bad = []
    for key in ("data_dir", "runs_dir"):
        val = cfg.get(key) or key.split("_")[0]
        p = Path(val)
        p = p if p.is_absolute() else ROOT / p
        try:
            p.mkdir(parents=True, exist_ok=True)
            if not os.access(p, os.W_OK):
                writable_bad.append(val)
        except OSError:
            writable_bad.append(val)
    if writable_bad:
        checks.append(_item("paths_writable", "fail", "not writable: %s" % ", ".join(writable_bad), "检查 data_dir / runs_dir 权限"))
    else:
        checks.append(_item("paths_writable", "pass", "%s, %s" % (cfg.get("data_dir", "data"), cfg.get("runs_dir", "runs"))))

    # SOUL & FX
    cur = cfg.get("currency", "")
    fx = cfg.get("fx") or {}
    try:
        soul = J.load_soul(cfg.get("soul", "soul/default.soul.md"), cfg)
        unit = soul.get("money_unit", "USD")
        if cur not in fx or unit not in fx:
            checks.append(_item("soul_and_fx", "fail", "config.fx missing %s or %s" % (cur, unit),
                                "在 config.fx 填入该币种每 1 美元汇率"))
        else:
            checks.append(_item("soul_and_fx", "pass", "%s (%s -> %s)" % (soul.get("id"), unit, cur)))
    except Exception as exc:  # noqa: BLE001
        checks.append(_item("soul_and_fx", "fail", "SOUL load failed: %s" % str(exc)[:160], "检查 config.soul 路径与 syntax"))

    # Judgment provider readiness
    jcfg = cfg.get("judgment") or {}
    prov = jcfg.get("provider", "local")
    chain = list(jcfg.get("provider_chain") or [prov])
    req_envs_map = {
        "llm": [(jcfg.get("llm") or {}).get("base_url_env", "LLM_BASE_URL"),
                (jcfg.get("llm") or {}).get("api_key_env", "LLM_API_KEY"),
                (jcfg.get("llm") or {}).get("model_env", "LLM_MODEL")],
        "jev": [(jcfg.get("jev") or {}).get("endpoint_env", "JEV_ENDPOINT")],
        "soul-api": [(jcfg.get("soul_api") or {}).get("endpoint_env", "SOUL_API_ENDPOINT")],
    }
    if prov == "local":
        checks.append(_item("judgment_provider", "pass", "local rules engine active"))
    else:
        needed = req_envs_map.get(prov, [])
        missing_j = [k for k in needed if not env.get(k)]
        if not missing_j:
            checks.append(_item("judgment_provider", "pass", "%s env ready (chain=%s)" % (prov, ",".join(chain))))
        elif "local" in chain or len(chain) > 1:
            checks.append(_item("judgment_provider", "warn", "%s missing %s (will fallback along chain)" % (prov, ",".join(missing_j)),
                                "按需要注入 %s" % ", ".join(missing_j)))
        else:
            checks.append(_item("judgment_provider", "fail", "%s missing %s" % (prov, ",".join(missing_j)),
                                "注入对应环境变量或改 provider=local"))

    # Traffic credentials & mode
    tcfg = cfg.get("traffic") or {}
    g_req = ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"]
    g_miss = [k for k in g_req if not env.get(k)]
    t_wants_api = tcfg.get("deploy_mode") == "api" or tcfg.get("report_source") == "api"
    if not g_miss:
        checks.append(_item("traffic_credentials", "pass", "Google Ads OAuth env vars present"))
    elif t_wants_api and apply:
        checks.append(_item("traffic_credentials", "fail", "API mode selected; missing: %s" % ", ".join(g_miss),
                            "注入环境变量或将 deploy_mode=manual 与 report_source=csv_export"))
    else:
        checks.append(_item("traffic_credentials", "warn", "missing %s (manual/csv fallback available)" % ", ".join(g_miss),
                            "补齐 OAuth 凭据或改 manual/csv_export"))

    # Affiliate credentials
    acfg = cfg.get("affiliate") or {}
    ap = acfg.get("plugin", "cj")
    if ap == "cj":
        a_req = [acfg.get("publisher_id_env") or "CJ_PUBLISHER_ID", acfg.get("token_env") or "CJ_ACCESS_TOKEN"]
    elif ap == "impact":
        a_req = [acfg.get("account_sid_env") or "IMPACT_ACCOUNT_SID", acfg.get("token_env") or "IMPACT_AUTH_TOKEN"]
    else:
        a_req = []
    a_miss = [k for k in a_req if not env.get(k)]
    if not a_miss:
        checks.append(_item("affiliate_credentials", "pass", "%s env vars present" % ap))
    elif acfg.get("commissions_source") == "api" and apply:
        checks.append(_item("affiliate_credentials", "fail", "%s missing: %s" % (ap, ", ".join(a_miss)),
                            "注入 %s 或改 commissions_source=json/csv_export" % ", ".join(a_miss)))
    else:
        checks.append(_item("affiliate_credentials", "warn", "%s missing: %s" % (ap, ", ".join(a_miss)),
                            "接入真账号前通过 vault 注入或改用本地 json"))

    # Deploy / export readiness
    dcfg = cfg.get("deploy") or {}
    exp_env = dcfg.get("export_key_env") or "ADSPILOT_EXPORT_KEY"
    cf_ready = bool(env.get("CF_API_TOKEN") or (env.get("CF_EMAIL") and env.get("CF_GLOBAL_API_KEY")))
    if (dcfg.get("host") or dcfg.get("export_url")) and (env.get(exp_env) or cf_ready):
        checks.append(_item("deploy_credentials", "pass", "deploy target & key configured"))
    else:
        checks.append(_item("deploy_credentials", "warn", "deploy.host / %s / CF_API_TOKEN incomplete" % exp_env,
                            "建落地位前配置 CF_API_TOKEN 与 deploy.host"))

    # Optional sentinel webhook
    if env.get("ADSPILOT_NOTIFY_WEBHOOK"):
        checks.append(_item("sentinel_webhook", "pass", "ADSPILOT_NOTIFY_WEBHOOK configured"))
    else:
        checks.append(_item("sentinel_webhook", "warn", "ADSPILOT_NOTIFY_WEBHOOK not set (sentinel logs only)",
                            "如需异常即时推送，可在调度器环境配置 ADSPILOT_NOTIFY_WEBHOOK"))

    # Live read-only checks (only with --apply)
    if apply:
        if oauth_mod is None:
            import oauth_helper as oauth_mod  # noqa: E402
        if report_mod is None:
            import report_api as report_mod  # noqa: E402
        if not g_miss:
            checks.append(_probe_google_ads(cfg, env, oauth_mod, report_mod))
        else:
            checks.append(_item("google_ads_live", "skip", "skipped (Google Ads credentials incomplete)"))
        data_dir = Path(cfg.get("data_dir", "data"))
        deploy_file = (data_dir if data_dir.is_absolute() else ROOT / data_dir) / "deploy.json"
        checks.append(_probe_deploy(cfg, env, deploy_file))
    else:
        checks.append(_item("google_ads_live", "skip", "offline preview (pass --apply to probe Google Ads currency & OAuth scopes)"))
        checks.append(_item("deploy_live", "skip", "offline preview (pass --apply to probe Cloudflare /health & /export)"))

    summary = {k: sum(1 for c in checks if c["status"] == k) for k in ("pass", "warn", "fail", "skip")}
    if summary["fail"]:
        verdict = "fail"
    elif summary["warn"]:
        verdict = "warn"
    else:
        verdict = "pass"

    ready_for_apply = bool(
        cfg.get("apply") is True
        and summary["fail"] == 0
        and not g_miss
        and not a_miss
        and checks[[c["check"] for c in checks].index("deploy_credentials")]["status"] == "pass"
    )
    return {
        "type": "adspilot.preflight",
        "verdict": verdict,
        "mode": "live" if apply else "offline",
        "live_checked": bool(apply),
        "ready_for_apply": ready_for_apply,
        "currency": cur,
        "config_file": config_label,
        "checks": checks,
        "summary": summary,
    }


def selftest():
    J.console_safe()
    cfg = json.loads((ROOT / "config" / "adspilot.example.json").read_text(encoding="utf-8"))
    # 1. Offline mode on example config exits cleanly with live_checked=False
    off = run_preflight(cfg, config_label="config/adspilot.example.json", is_example=True, apply=False, env={})
    assert off["mode"] == "offline" and off["live_checked"] is False and off["summary"]["fail"] == 0, off

    # 2. Live currency mismatch + good mock round-trip
    class MockOAuth:
        @staticmethod
        def inspect_refresh_scopes(env):
            return {"ok": True, "has_adwords_scope": True, "has_datamanager_scope": True, "missing_scopes": []}, 0

    class MockReportMismatch:
        ACCOUNT_STATUS_GAQL = "SELECT"
        @staticmethod
        def access_token(env): return "tok"
        @staticmethod
        def search_stream(env, tok, q): return [{"results": [{"customer": {"status": "ENABLED", "currencyCode": "HKD"}}]}]
        @staticmethod
        def parse_account_status(chunks): return {"account_status": "ok", "currency": "HKD"}

    class MockReportMatch:
        ACCOUNT_STATUS_GAQL = "SELECT"
        @staticmethod
        def access_token(env): return "tok"
        @staticmethod
        def search_stream(env, tok, q): return [{"results": [{"customer": {"status": "ENABLED", "currencyCode": "USD"}}]}]
        @staticmethod
        def parse_account_status(chunks): return {"account_status": "ok", "currency": "USD"}

    env_keys = ("NO_PROXY", "no_proxy")
    old = {k: os.environ.get(k) for k in env_keys}
    os.environ["NO_PROXY"] = "127.0.0.1,localhost"
    os.environ["no_proxy"] = "127.0.0.1,localhost"

    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            if self.path.startswith("/health"):
                code, body = 200, json.dumps({"ok": True, "version": "test"})
            elif self.path.startswith("/export"):
                auth = self.headers.get("Authorization", "")
                code, body = (200, "") if auth == "Bearer exp-secret" else (401, "unauthorized")
            else:
                code, body = 404, "not found"
            raw = body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

    orig_urlopen = urllib.request.urlopen
    srv = None
    try:
        try:
            srv = http.server.HTTPServer(("127.0.0.1", 0), H)
            threading.Thread(target=srv.serve_forever, daemon=True).start()
            base = "http://127.0.0.1:%d" % srv.server_address[1]
        except PermissionError:
            base = "http://127.0.0.1:0"
            def _fake_urlopen(r, timeout=15):
                p = urllib.parse.urlparse(r.full_url).path
                if p.startswith("/health"):
                    raw = json.dumps({"ok": True, "version": "test"}).encode("utf-8")
                    class _Resp:
                        status = 200
                        def __enter__(self): return self
                        def __exit__(self, *a): pass
                        def read(self): return raw
                    return _Resp()
                if p.startswith("/export"):
                    auth = r.get_header("Authorization") or ""
                    if auth != "Bearer exp-secret":
                        raise urllib.error.HTTPError(r.full_url, 401, "Unauthorized", {}, None)
                    class _Resp2:
                        status = 200
                        def __enter__(self): return self
                        def __exit__(self, *a): pass
                        def read(self): return b""
                    return _Resp2()
                raise urllib.error.HTTPError(r.full_url, 404, "Not Found", {}, None)
            urllib.request.urlopen = _fake_urlopen

        live_cfg = dict(cfg, apply=True)
        live_cfg["deploy"] = dict(cfg["deploy"], host="127.0.0.1", export_url=base + "/export")
        full_env = {
            "GOOGLE_ADS_CLIENT_ID": "cid",
            "GOOGLE_ADS_CLIENT_SECRET": "sec",
            "GOOGLE_ADS_REFRESH_TOKEN": "rt",
            "GOOGLE_ADS_CUSTOMER_ID": "1234567890",
            "CJ_PUBLISHER_ID": "pub1",
            "CJ_ACCESS_TOKEN": "cj1",
            "ADSPILOT_EXPORT_KEY": "exp-secret",
            "CF_API_TOKEN": "cf1",
            "ADSPILOT_NOTIFY_WEBHOOK": "https://example.invalid/hook",
        }
        bad = run_preflight(live_cfg, apply=True, env=full_env, oauth_mod=MockOAuth, report_mod=MockReportMismatch)
        bad_ga = [c for c in bad["checks"] if c["check"] == "google_ads_live"][0]
        assert bad["verdict"] == "fail" and "currency mismatch" in bad_ga["detail"], bad

        good = run_preflight(live_cfg, apply=True, env=full_env, oauth_mod=MockOAuth, report_mod=MockReportMatch)
        assert good["verdict"] == "pass" and good["ready_for_apply"] is True and good["live_checked"] is True, good
    finally:
        urllib.request.urlopen = orig_urlopen
        if srv is not None:
            srv.shutdown()
            srv.server_close()
        for k, v in old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    print("preflight selftest: offline=warn/0fail currency_mismatch=fail live_match=pass -> OK")
    return 0


def main(argv=None):
    J.console_safe()
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--config", help="配置文件路径")
    p.add_argument("--apply", action="store_true", help="执行只读联网核对（Google Ads 币种/scope 与落地位 /health /export）")
    p.add_argument("--selftest", action="store_true")
    args = p.parse_args(argv)
    if args.selftest:
        return selftest()
    try:
        cfg, label, is_ex = _load_cfg(args.config)
        res = run_preflight(cfg, config_label=label, is_example=is_ex, apply=args.apply)
    except (OSError, ValueError, KeyError) as exc:
        print(json.dumps({"error": str(exc)[:200]}, ensure_ascii=False), file=sys.stderr)
        return 4
    print(json.dumps(res, ensure_ascii=False, indent=2))
    return 4 if res["verdict"] == "fail" else 0


if __name__ == "__main__":
    sys.exit(main())
