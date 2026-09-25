#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
判断插件 · soul-api（iLang Inc. 托管的判断服务，公益期免费）

请求与响应形状与 schemas/judgment.schema.json 一致（见 soul/soul-api.md）。服务端代码不在本仓库。
未配置端点时退出码 4，主干退回本地规则；超时或非 200 退出码 3。

用法：echo '<request json>' | python3 provider.py --config '{"soul_api": {...}}'
"""
import json
import os
import sys
import urllib.request

FORBIDDEN_KEYS = ("token", "secret", "password", "refresh_token", "api_key", "gclid")


def scrub(obj):
    if isinstance(obj, dict):
        return {k: scrub(v) for k, v in obj.items() if not any(f in k.lower() for f in FORBIDDEN_KEYS)}
    if isinstance(obj, list):
        return [scrub(x) for x in obj]
    return obj


def main(argv):
    if "--selftest" in argv:
        s = scrub({"a": 1, "gclid": "x", "n": {"api_key": "y", "b": 2}})
        ok = s == {"a": 1, "n": {"b": 2}}
        print("scrub", "OK" if ok else "FAIL"); return 0 if ok else 1
    cfg = json.loads(argv[argv.index("--config") + 1]) if "--config" in argv else {}
    names = cfg.get("soul_api") or {}
    ep = os.environ.get(names.get("endpoint_env", "SOUL_API_ENDPOINT"), "")
    key = os.environ.get(names.get("api_key_env", "SOUL_API_KEY"), "")
    if not ep:
        sys.stderr.write("soul-api not configured (SOUL_API_ENDPOINT)\n"); return 4
    req = scrub(json.load(sys.stdin))
    r = urllib.request.Request(ep.rstrip("/") + "/v1/judge", data=json.dumps(req, ensure_ascii=False).encode(),
                               headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(r, timeout=float(cfg.get("timeout_s", 8))) as resp:
            res = json.loads(resp.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        sys.stderr.write("soul-api call failed: %s\n" % str(e)[:200]); return 3
    j = res.get("judge") or {}
    out = {"v": j.get("v"), "choice": res.get("choice"), "conf": float(res.get("confidence", j.get("conf", 0.5))), "reason": j.get("reason", "soul_api")}
    if res.get("distribution"):
        out["distribution"] = res["distribution"]
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
