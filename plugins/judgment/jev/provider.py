#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
判断插件 · jev（TypeSafe AI 的决策模型）

支持两种端点形状（通过 config.jev.mode = auto | systemone | decide 控制）：
  1. systemone（TypeSafe 现行 `/v1/systemone` 接口）：
     用 11 维 {0, 0.5, 1} rubric 题加上 1 题 `choice` 选项分布，一次算出 11 维期望向量 `v` 与 `choice`/`distribution`。
  2. decide（早期接入 `/decide` 接口）：
     只返回 `choice` 与 `distribution`，不产出 `v`，由主干按本地规则补齐向量。
两种模式下，最终模式（M1..M8）均由主干按冻结的 f_v5 在本地计算。

用法：echo '<request json>' | python3 provider.py --config '{"jev": {...}}' [--soul soul/<n>.soul.md]
      python3 provider.py --selftest
退出码：0 成功；3 调用或解析失败；4 未配置。
"""
import json
import os
import re
import sys
import tempfile
import threading
import http.server

DIMS = ["int", "cap", "csq", "rel", "cer", "aut", "rev", "evd", "sov", "ine", "ext"]
DIM_QUESTIONS = {
    "int": ("intent", "0=destructive or harmful intent", "1=constructive declared business purpose"),
    "cap": ("capability", "0=beyond tool or budget envelope", "1=well within operating envelope"),
    "csq": ("consequence", "0=irreversible severe loss", "1=negligible or strictly bounded downside"),
    "rel": ("relationship", "0=adversarial or untrusted context", "1=high trust alignment"),
    "cer": ("certainty", "0=missing required state fields or blind guess", "1=complete required information"),
    "aut": ("authority", "0=requires explicit human consent or forbidden", "1=fully authorized within user caps"),
    "rev": ("reversibility", "0=cannot be undone once executed", "1=fully reversible action"),
    "evd": ("evidence", "0=no report or ledger evidence supporting step", "1=verified evidence present"),
    "sov": ("sovereignty", "0=violates user scope or platform compliance", "1=respects user consent and boundaries"),
    "ine": ("inertia", "0=disruptive sudden pivot", "1=continues confirmed operational pattern"),
    "ext": ("externality", "0=high third-party risk or policy violation", "1=zero adverse third-party impact"),
}
SENSITIVE_KEYS = re.compile(
    r"(?:gclid|gbraid|wbraid|click_?id|password|passwd|passphrase|secret|token|"
    r"api_?key|private_?key|authorization|cookie|credential|raw_ips|ip_list|client_ip|visitor_ip)",
    re.I,
)
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))


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


def resolve_endpoint(ep, names):
    mode = str(names.get("mode", "auto")).lower()
    ep_clean = ep.rstrip("/")
    if mode not in ("auto", "systemone", "decide"):
        raise ValueError("unknown jev mode: %s" % mode)
    if mode == "systemone":
        url = ep_clean if ep_clean.endswith("/systemone") else ep_clean + "/v1/systemone"
        return "systemone", url
    if mode == "decide":
        url = ep_clean if ep_clean.endswith("/decide") else ep_clean + "/decide"
        return "decide", url
    if ep_clean.endswith("/systemone"):
        return "systemone", ep_clean
    if ep_clean.endswith("/decide"):
        return "decide", ep_clean
    if names.get("rubric"):
        return "systemone", ep_clean + "/v1/systemone"
    return "decide", ep_clean + "/decide"


def build_systemone_body(req, names, rules):
    criteria_choices = {}
    for c in req["choices"]:
        criteria_choices[c["id"]] = str(c.get("label") or c["id"])[:200]
    questions = {}
    for d in DIMS:
        name, bad, good = DIM_QUESTIONS[d]
        questions[d] = {
            "type": "choice",
            "instructions": (
                "Rate dimension '%s' (%s) for the ad-operations step at node '%s' on the iLang v5.0 scale."
                % (name, d, req["node"])
            ),
            "criteria": {"0": bad, "0.5": "between the two or uncertain", "1": good},
        }
    questions["choice"] = {
        "type": "choice",
        "instructions": "Select the best choice id for node '%s' given the SOUL rules and state." % req["node"],
        "criteria": criteria_choices,
    }
    return {
        "model": os.environ.get(names.get("model_env", "JEV_MODEL"), names.get("model", "jev-latest")) or "jev-latest",
        "state": {
            "node": req["node"],
            "soul": req.get("soul"),
            "rules": rules or "(default)",
            "state": req["state"],
            "caps": req.get("caps", {}),
            "evidence": req.get("evidence", []),
        },
        "questions": questions,
    }


def parse_systemone_reply(res, ids):
    answers = res.get("answers") or {}
    v = {}
    confs = []
    for d in DIMS:
        ans = answers.get(d) or {}
        probs = ans.get("probabilities") or {}
        if not probs:
            raise ValueError("missing probabilities for dim %s" % d)
        score = 0.0 * float(probs.get("0", 0.0)) + 0.5 * float(probs.get("0.5", 0.0)) + 1.0 * float(probs.get("1", 0.0))
        v[d] = round(min(1.0, max(0.0, score)), 2)
        if "confidence" in ans:
            confs.append(float(ans["confidence"]))
    c_ans = answers.get("choice") or {}
    raw_dist = c_ans.get("probabilities") or {}
    dist = {k: round(min(1.0, max(0.0, float(val))), 4) for k, val in raw_dist.items() if k in ids}
    ch = c_ans.get("choice")
    if ch not in ids and dist:
        ch = max(dist, key=lambda k: dist[k])
    if ch not in ids:
        raise ValueError("jev choice not in choices")
    conf = float(c_ans.get("confidence", (sum(confs) / len(confs)) if confs else 0.5))
    conf = round(min(1.0, max(0.0, conf)), 4)
    return {"v": v, "choice": ch, "distribution": dist, "conf": conf, "reason": "jev_systemone_11d"}


def run_call(req, cfg, soul_path=None):
    import urllib.request
    names = cfg.get("jev") or {}
    ep = os.environ.get(names.get("endpoint_env", "JEV_ENDPOINT"), "")
    key = os.environ.get(names.get("api_key_env", "JEV_API_KEY"), "")
    if not ep:
        return None, 4, "jev not configured (JEV_ENDPOINT)"
    ids = [c["id"] for c in req["choices"]]
    if not ids or len(ids) > 255:
        return None, 3, "jev supports 1..255 choices"
    rules = soul_rules(req["node"], soul_path)
    clean_req = scrub(req)
    mode, url = resolve_endpoint(ep, names)
    if mode == "systemone":
        body = build_systemone_body(clean_req, names, rules)
    else:
        body = {
            "state": {
                "node": clean_req["node"],
                "soul": clean_req.get("soul"),
                "rules": rules or "(default)",
                "state": clean_req["state"],
                "caps": clean_req.get("caps", {}),
            },
            "choices": ids,
        }
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = "Bearer " + key
    r = urllib.request.Request(url, data=json.dumps(body, ensure_ascii=False).encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(r, timeout=float(cfg.get("timeout_s", 8))) as resp:
        res = json.loads(resp.read().decode("utf-8"))
    if mode == "systemone":
        return parse_systemone_reply(res, ids), 0, ""
    choice = res.get("choice")
    if choice not in ids:
        return None, 3, "jev choice not in choices"
    dist = {k: float(v) for k, v in (res.get("distribution") or {}).items() if k in ids}
    conf = round(min(1.0, max(0.0, float(res.get("confidence", 0.5)))), 4)
    return {"choice": choice, "distribution": dist, "conf": conf, "reason": "jev_typed_decision"}, 0, ""


def selftest():
    seen = []

    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))).decode("utf-8"))
            seen.append((self.path, body))
            if self.path.endswith("/systemone"):
                answers = {
                    d: {"type": "choice", "probabilities": {"0": 0.1, "0.5": 0.2, "1": 0.7}, "confidence": 0.85}
                    for d in DIMS
                }
                answers["choice"] = {"type": "choice", "probabilities": {"keep": 0.82, "pause": 0.18}, "choice": "keep", "confidence": 0.82}
                out = {"model": "jev-latest", "answers": answers}
            elif self.path.endswith("/decide"):
                out = {"choice": "keep", "distribution": {"keep": 0.9, "pause": 0.1}, "confidence": 0.8}
            else:
                self.send_response(404); self.end_headers(); return
            raw = json.dumps(out).encode("utf-8")
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(raw)))
            self.end_headers(); self.wfile.write(raw)

    import urllib.request
    def _reply(path, body):
        seen.append((path, body))
        if path.endswith("/systemone"):
            answers = {
                d: {"type": "choice", "probabilities": {"0": 0.1, "0.5": 0.2, "1": 0.7}, "confidence": 0.85}
                for d in DIMS
            }
            answers["choice"] = {"type": "choice", "probabilities": {"keep": 0.82, "pause": 0.18}, "choice": "keep", "confidence": 0.82}
            return 200, {"model": "jev-latest", "answers": answers}
        if path.endswith("/decide"):
            return 200, {"choice": "keep", "distribution": {"keep": 0.9, "pause": 0.1}, "confidence": 0.8}
        return 404, {}

    env_keys = ("JEV_ENDPOINT", "JEV_API_KEY", "NO_PROXY", "no_proxy")
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
            import urllib.parse
            path = urllib.parse.urlparse(r.full_url).path
            body = json.loads(r.data.decode("utf-8"))
            _, out = _reply(path, body)
            raw = json.dumps(out).encode("utf-8")
            class _Resp:
                def __enter__(self): return self
                def __exit__(self, *a): pass
                def read(self): return raw
            return _Resp()
        urllib.request.urlopen = _fake_urlopen

    os.environ["JEV_API_KEY"] = "selftest-dummy"
    os.environ["NO_PROXY"] = "127.0.0.1,localhost"
    os.environ["no_proxy"] = "127.0.0.1,localhost"
    req = {"node": "campaign.adjust", "state": {"avg_cpc": 0.2, "gclid": "RAW1", "ips": ["192.0.2.9"]},
           "choices": [{"id": "keep"}, {"id": "pause"}], "soul": "default@2.4.0"}
    try:
        # 1) unconfigured -> rc 4
        os.environ["JEV_ENDPOINT"] = ""
        _, rc4, _ = run_call(req, {})
        # 2) /v1/systemone mode
        os.environ["JEV_ENDPOINT"] = url + "/v1/systemone"
        out_sys, rc_sys, err_sys = run_call(req, {})
        # 3) /decide mode
        os.environ["JEV_ENDPOINT"] = url
        out_dec, rc_dec, err_dec = run_call(req, {})
        # 4) explicit missing --soul raises OSError
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
    ok = (rc4 == 4 and rc_sys == 0 and rc_dec == 0
          and out_sys["choice"] == "keep" and out_sys["v"]["int"] == 0.8
          and out_dec["choice"] == "keep" and "v" not in out_dec
          and soul_missing
          and all("gclid" not in b.get("state", {}).get("state", {}) and "ips" not in b.get("state", {}).get("state", {}) for _, b in seen))
    print("jev selftest: unconfigured=%s systemone_v_int=%s decide=%s scrubbed=%s missing_soul_err=%s -> %s" % (
        rc4, (out_sys or {}).get("v", {}).get("int"), (out_dec or {}).get("choice"), True, soul_missing, "OK" if ok else "FAIL"))
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    cfg = json.loads(argv[argv.index("--config") + 1]) if "--config" in argv else {}
    req = json.load(sys.stdin)
    try:
        out, rc, err = run_call(req, cfg, soul_arg(argv))
    except OSError as e:
        sys.stderr.write("jev: --soul unreadable: %s\n" % e); return 3
    except Exception as e:  # noqa: BLE001
        sys.stderr.write("jev call failed: %s\n" % str(e)[:200]); return 3
    if rc:
        sys.stderr.write(err + "\n"); return rc
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
