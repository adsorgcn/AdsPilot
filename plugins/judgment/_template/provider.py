#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
判断插件模板（感知层提供者）

复制本目录到 plugins/judgment/<name>/ 并改好 manifest.json 的 id 后即可被动态发现。
契约要点：
  - stdin 接收 schemas/judgment.schema.json 的 request（主干调用前已剥离凭据、gclid 原文与 IP 列表）
  - CLI 接收 --config <judgment JSON> [--soul <SOUL 文件路径>]
  - stdout 输出 JSON：{v: {int..ext 11 维两位小数}, choice: <choices 里的 id>, conf: 0..1, reason: <单行短因>}
  - 决策模式（M1..M8）由主干 f_v5 在本地计算；超时或异常退出码 3，未配置退出码 4。
"""
import json
import os
import re
import sys
import urllib.request

DIMS = ["int", "cap", "csq", "rel", "cer", "aut", "rev", "evd", "sov", "ine", "ext"]
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))


def soul_arg(argv):
    return argv[argv.index("--soul") + 1] if "--soul" in argv and argv.index("--soul") + 1 < len(argv) else None


def soul_rules(node, soul_path):
    if not soul_path:
        return ""
    p = soul_path if os.path.isabs(soul_path) else os.path.join(ROOT, soul_path)
    txt = open(p, encoding="utf-8").read()
    m = re.search(r"### %s.*?(?=\n### |\n## |\Z)" % re.escape(node), txt, re.S)
    return m.group(0)[:1500] if m else ""


def selftest():
    sample = {
        "v": {d: 0.80 for d in DIMS},
        "choice": "keep",
        "conf": 0.75,
        "reason": "template_selftest_ok",
    }
    assert sorted(sample["v"]) == sorted(DIMS)
    print("judgment template selftest: OK")
    return 0


def main(argv):
    if "--selftest" in argv:
        return selftest()
    cfg = json.loads(argv[argv.index("--config") + 1]) if "--config" in argv else {}
    names = cfg.get("custom") or {}
    ep = os.environ.get(names.get("endpoint_env", "MY_JUDGE_ENDPOINT"), "")
    key = os.environ.get(names.get("api_key_env", "MY_JUDGE_API_KEY"), "")
    if not ep:
        sys.stderr.write("judgment template: MY_JUDGE_ENDPOINT not configured\n")
        return 4
    req = json.load(sys.stdin)
    rules = soul_rules(req["node"], soul_arg(argv))
    payload = {
        "node": req["node"],
        "state": req.get("state", {}),
        "choices": req.get("choices", []),
        "caps": req.get("caps", {}),
        "evidence": req.get("evidence", []),
        "soul_rules": rules,
    }
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = "Bearer " + key
    try:
        r = urllib.request.Request(ep, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(r, timeout=float(cfg.get("timeout_s", 8))) as resp:
            res = json.loads(resp.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        sys.stderr.write("judgment plugin call failed: %s\n" % str(e)[:200])
        return 3
    ids = [c["id"] for c in req["choices"]]
    if res.get("choice") not in ids:
        sys.stderr.write("invalid choice from provider\n")
        return 3
    out = {
        "v": {d: round(min(1.0, max(0.0, float(res["v"][d]))), 2) for d in DIMS},
        "choice": res["choice"],
        "conf": round(min(1.0, max(0.0, float(res.get("conf", 0.5)))), 4),
        "reason": str(res.get("reason", "custom_provider"))[:120],
    }
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
