#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
判断插件 · soul-api（iLang Inc. 托管的判断服务，公益期免费）

同时支持两种 /v1/judge 接口方言（通过 config.judgment.soul_api.dialect = auto | v1 | ilang-judge 控制）：
  1. canonical v1（soul/soul-api.md 契约）：请求为 schemas/judgment.schema.json 的 request，返回 {judge:{v,conf,reason}, choice, confidence}。
  2. ilang-judge（space/app.py 方言）：请求为 {caller, state, action, rubric}，返回 {vector, probabilities, confidence, class5_key, mode, ...}。
     未带 choice 时按 --soul（或默认 SOUL）的本地规则给出对应节点候选 choice，11 维向量仍取服务端评估结果。

未配置端点时退出码 4，主干继续回退链或退回本地规则；超时或非 200 退出码 3。
用法：echo '<request json>' | python3 provider.py --config '{"soul_api": {...}}' [--soul soul/<n>.soul.md]
      python3 provider.py --selftest
"""
import http.server
import json
import os
import re
import sys
import tempfile
import threading
import urllib.error
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
DIMS = ["int", "cap", "csq", "rel", "cer", "aut", "rev", "evd", "sov", "ine", "ext"]
SENSITIVE_KEYS = re.compile(
    r"(?:gclid|gbraid|wbraid|click_?id|password|passwd|passphrase|secret|token|"
    r"api_?key|private_?key|authorization|cookie|credential|raw_ips|ip_list|client_ip|visitor_ip)",
    re.I,
)


def scrub(obj):
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            ks = str(k)
            if ks == "gclid_all_valid" and isinstance(v, bool):
                out[k] = v
                continue
            if ks == "gclid_kind" and v in ("", "gclid", "gbraid", "wbraid"):
                out[k] = v
                continue
            if SENSITIVE_KEYS.search(ks) or (ks == "ips" and isinstance(v, list)):
                continue
            out[k] = scrub(v)
        return out
    if isinstance(obj, list):
        return [scrub(x) for x in obj]
    return obj


def soul_arg(argv):
    return argv[argv.index("--soul") + 1] if "--soul" in argv and argv.index("--soul") + 1 < len(argv) else None


def soul_rules(node, soul_path):
    if not soul_path:
        return ""
    p = soul_path if os.path.isabs(soul_path) else os.path.join(ROOT, soul_path)
    txt = open(p, encoding="utf-8").read()
    m = re.search(r"### %s.*?(?=\n### |\n## |\Z)" % re.escape(node), txt, re.S)
    return m.group(0)[:1500] if m else ""


def local_choice_for(req, soul_path):
    sys.path.insert(0, os.path.join(ROOT, "core", "judge"))
    import judge as J  # noqa: E402
    soul = J.load_soul(soul_path or os.path.join("soul", "default.soul.md"))
    ch, _ = J.local_choice(req["node"], req.get("state") or {}, req["choices"], soul, req.get("caps"))
    return ch


def build_ilang_judge_body(req, names, rules):
    ids = [c["id"] for c in req["choices"]]
    caller = str(names.get("caller") or "adspilot")
    rubric = str(names.get("rubric") or "v5")
    state_payload = {
        "node": req["node"],
        "soul": req.get("soul"),
        "rules": rules or "(default)",
        "state": req.get("state", {}),
        "caps": req.get("caps", {}),
        "evidence": req.get("evidence", []),
    }
    state_text = json.dumps(state_payload, ensure_ascii=False)[:6000]
    action_text = ("node=%s choices=%s" % (req["node"], ",".join(ids)))[:3000]
    return {"caller": caller, "state": state_text, "action": action_text, "rubric": rubric}


def parse_reply(res, req, soul_path):
    ids = [c["id"] for c in req["choices"]]
    if "vector" in res and "judge" not in res:
        raw_v = res.get("vector") or {}
        v = {d: round(min(1.0, max(0.0, float(raw_v[d]))), 2) for d in DIMS}
        raw_conf = res.get("confidence", 0.5)
        if isinstance(raw_conf, dict):
            vals = [float(x) for x in raw_conf.values() if isinstance(x, (int, float))]
            conf = round(min(1.0, max(0.0, sum(vals) / len(vals))) if vals else 0.5, 4)
        else:
            conf = round(min(1.0, max(0.0, float(raw_conf))), 4)
        ch = res.get("choice")
        if ch not in ids:
            ch = local_choice_for(req, soul_path)
        reason = str(res.get("reason") or "ilang_judge")[:120]
        return {"v": v, "choice": ch, "conf": conf, "reason": reason}
    j = res.get("judge") or {}
    out = {
        "v": j.get("v"),
        "choice": res.get("choice"),
        "conf": float(res.get("confidence", j.get("conf", 0.5))),
        "reason": j.get("reason", "soul_api"),
    }
    if res.get("distribution"):
        out["distribution"] = res["distribution"]
    return out


def post_json(url, payload, key, timeout_s):
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = "Bearer " + key
    r = urllib.request.Request(url, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(r, timeout=timeout_s) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run_call(req, cfg, soul_path=None):
    names = cfg.get("soul_api") or {}
    ep = os.environ.get(names.get("endpoint_env", "SOUL_API_ENDPOINT"), "")
    key = os.environ.get(names.get("api_key_env", "SOUL_API_KEY"), "")
    if not ep:
        return None, 4, "soul-api not configured (SOUL_API_ENDPOINT)"
    clean_req = scrub(req)
    rules = soul_rules(clean_req["node"], soul_path)
    ep_clean = ep.rstrip("/")
    url = ep_clean if ep_clean.endswith("/v1/judge") else ep_clean + "/v1/judge"
    dialect = str(names.get("dialect", "auto")).lower()
    timeout_s = float(cfg.get("timeout_s", 8))
    if dialect == "ilang-judge":
        res = post_json(url, build_ilang_judge_body(clean_req, names, rules), key, timeout_s)
    elif dialect == "v1":
        res = post_json(url, clean_req, key, timeout_s)
    elif dialect == "auto":
        try:
            res = post_json(url, clean_req, key, timeout_s)
        except urllib.error.HTTPError as e:
            body_err = ""
            try:
                body_err = e.read().decode("utf-8", errors="replace")
            except Exception:  # noqa: BLE001
                body_err = ""
            if e.code == 422 and "need_caller_and_state" in body_err:
                res = post_json(url, build_ilang_judge_body(clean_req, names, rules), key, timeout_s)
            else:
                raise
    else:
        raise ValueError("unknown soul_api dialect: %s" % dialect)
    return parse_reply(res, clean_req, soul_path), 0, ""


def selftest():
    s = scrub({"a": 1, "gclid": "x", "gclid_all_valid": True, "gclid_kind": "gclid", "ips": ["192.0.2.1"], "n": {"api_key": "y", "b": 2}})
    ok = s == {"a": 1, "gclid_all_valid": True, "gclid_kind": "gclid", "n": {"b": 2}}

    mode_ref = ["v1"]
    seen = []

    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))).decode("utf-8"))
            seen.append((mode_ref[0], body))
            if mode_ref[0] == "v1":
                out = {"choice": "keep", "confidence": 0.85, "judge": {"reason": "v1_ok"}}
                code = 200
            else:
                if "caller" not in body:
                    code = 422
                    out = {"error": "need_caller_and_state"}
                else:
                    code = 200
                    out = {
                        "mode": "M2",
                        "class5_key": "act",
                        "reason": "STEP-4 S=0.8000>0.70",
                        "vector": {d: 0.80 for d in DIMS},
                        "confidence": {d: 0.90 for d in DIMS},
                    }
            raw = json.dumps(out).encode("utf-8")
            self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(raw)))
            self.end_headers(); self.wfile.write(raw)

    def _reply(body):
        seen.append((mode_ref[0], body))
        if mode_ref[0] == "v1":
            return 200, {"choice": "keep", "confidence": 0.85, "judge": {"reason": "v1_ok"}}
        if "caller" not in body:
            return 422, {"error": "need_caller_and_state"}
        return 200, {
            "mode": "M2",
            "class5_key": "act",
            "reason": "STEP-4 S=0.8000>0.70",
            "vector": {d: 0.80 for d in DIMS},
            "confidence": {d: 0.90 for d in DIMS},
        }

    env_keys = ("SOUL_API_ENDPOINT", "SOUL_API_KEY", "NO_PROXY", "no_proxy")
    old = {k: os.environ.get(k) for k in env_keys}
    orig_urlopen = urllib.request.urlopen
    srv = None
    try:
        srv = http.server.HTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        url = "http://127.0.0.1:%d" % srv.server_address[1]
    except PermissionError:
        url = "http://127.0.0.1:0"
        def _fake_urlopen(r, timeout=8):
            import io
            body = json.loads(r.data.decode("utf-8"))
            code, out = _reply(body)
            raw = json.dumps(out).encode("utf-8")
            if code >= 400:
                raise urllib.error.HTTPError(r.full_url, code, "ERR", {}, io.BytesIO(raw))
            class _Resp:
                def __enter__(self): return self
                def __exit__(self, *a): pass
                def read(self): return raw
            return _Resp()
        urllib.request.urlopen = _fake_urlopen

    os.environ["SOUL_API_KEY"] = "selftest-dummy"
    os.environ["NO_PROXY"] = "127.0.0.1,localhost"
    os.environ["no_proxy"] = "127.0.0.1,localhost"
    req = {
        "node": "campaign.adjust",
        "state": {"days_running": 4, "spend_total": 40, "spend_window": 20, "clicks": 80, "avg_cpc": 0.2,
                  "conversions": 2, "commission": 30, "last_change_days": 3, "gclid": "RAW1"},
        "choices": [{"id": "keep"}, {"id": "bid_down"}, {"id": "pause"}],
        "caps": {},
    }
    try:
        os.environ["SOUL_API_ENDPOINT"] = ""
        _, rc4, _ = run_call(req, {})
        os.environ["SOUL_API_ENDPOINT"] = url
        mode_ref[0] = "v1"
        out_v1, rc_v1, _ = run_call(req, {})
        mode_ref[0] = "ilang-judge"
        out_ij, rc_ij, _ = run_call(req, {}, os.path.join("soul", "default.soul.md"))
        soul_missing = False
        try:
            with tempfile.TemporaryDirectory() as td:
                run_call(req, {}, os.path.join(td, "missing.soul.md"))
        except OSError:
            soul_missing = True
    finally:
        urllib.request.urlopen = orig_urlopen
        if srv is not None:
            srv.shutdown(); srv.server_close()
        for k, v in old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
    ok = (ok and rc4 == 4 and rc_v1 == 0 and out_v1["choice"] == "keep"
          and rc_ij == 0 and out_ij["choice"] == "keep" and out_ij["v"]["int"] == 0.8 and out_ij["conf"] == 0.9
          and soul_missing)
    print("soul-api selftest: scrub=%s v1=%s ilang_judge_retry=%s missing_soul_err=%s -> %s" % (
        s.get("gclid_all_valid"), rc_v1 == 0, rc_ij == 0, soul_missing, "OK" if ok else "FAIL"))
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    cfg = json.loads(argv[argv.index("--config") + 1]) if "--config" in argv else {}
    req = json.load(sys.stdin)
    try:
        out, rc, err = run_call(req, cfg, soul_arg(argv))
    except OSError as e:
        sys.stderr.write("soul-api: --soul unreadable: %s\n" % e); return 3
    except Exception as e:  # noqa: BLE001
        sys.stderr.write("soul-api call failed: %s\n" % str(e)[:200]); return 3
    if rc:
        sys.stderr.write(err + "\n"); return rc
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
