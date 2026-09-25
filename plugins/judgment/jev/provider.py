#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
判断插件 · jev（TypeSafe AI 的决策模型做感知层的选项部分）

Jev：状态进、类型化决策出，不产生文本，选项不超过 255 个，延迟几十到几百毫秒。它给的是选项分布，不是 11 维向量；
所以本适配器：选项与分布来自 Jev，向量由主干本地规则给出（本脚本不输出 v，主干看到没有 v 就用本地向量），模式仍由主干按 f_v5 算。

接口以 Jev 早期接入文档为准。未配置端点时退出码 4，主干退回本地规则。请求形状（待接入文档核对后锁死）：
  POST <JEV_ENDPOINT>/decide  {"state": {...}, "choices": ["id", ...]}  ->  {"choice": "id", "distribution": {"id": p, ...}, "confidence": c}

用法：echo '<request json>' | python3 provider.py --config '{"jev": {...}}'
退出码：0 成功；3 调用失败；4 未配置。
"""
import json
import os
import sys
import urllib.request


def main(argv):
    if "--selftest" in argv:
        print("jev adapter: no network selftest; contract stub OK"); return 0
    cfg = json.loads(argv[argv.index("--config") + 1]) if "--config" in argv else {}
    names = cfg.get("jev") or {}
    ep = os.environ.get(names.get("endpoint_env", "JEV_ENDPOINT"), "")
    key = os.environ.get(names.get("api_key_env", "JEV_API_KEY"), "")
    if not ep:
        sys.stderr.write("jev not configured (JEV_ENDPOINT)\n"); return 4
    req = json.load(sys.stdin)
    ids = [c["id"] for c in req["choices"]]
    if len(ids) > 255:
        sys.stderr.write("jev supports at most 255 choices\n"); return 3
    body = {"state": {"node": req["node"], "state": req["state"], "caps": req.get("caps", {})}, "choices": ids}
    r = urllib.request.Request(ep.rstrip("/") + "/decide", data=json.dumps(body).encode(),
                               headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(r, timeout=float(cfg.get("timeout_s", 8))) as resp:
            res = json.loads(resp.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        sys.stderr.write("jev call failed: %s\n" % str(e)[:200]); return 3
    choice = res.get("choice")
    if choice not in ids:
        sys.stderr.write("jev choice not in choices\n"); return 3
    print(json.dumps({"choice": choice, "distribution": res.get("distribution", {}), "conf": float(res.get("confidence", 0.5)),
                      "reason": "jev_typed_decision"}))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
