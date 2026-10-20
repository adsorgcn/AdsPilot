#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Impact 插件 · chargebacks 动作（拒付解析）

Impact 没有负数的新记录：一笔 Action 被撤销是同一个 Id 的 State 变成 REVERSED。commissions 动作已经把这种行出成拒付行（event_id "<Id>:rev"，amount 为负，
is_chargeback true，original_event_id 指向原 Id，金额优先取 ActionUpdates 的 DeltaPayout）。本动作从 commissions 的输出（或直接走 api 再拉一次）里筛出这些行；
原事件 id 在 Impact 里永远可知，关联不上的只会是缺 ActionId 的坏数据，单独列在 unlinked 里，主干对它们记 unknown，不做负转化。

用法：
  python3 chargebacks.py --commissions runs/<id>/commissions.json [--out runs/<id>/chargebacks.json]
  python3 chargebacks.py --days 30 [--out ...]      # 直接走 api
  python3 chargebacks.py --selftest
退出码：0 成功；3 API 失败；4 凭据缺失或凭据错。
"""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import commissions as CM  # noqa: E402


def split(env):
    cbs = [r for r in env["rows"] if r.get("is_chargeback") or float(r.get("amount", 0) or 0) < 0]
    ids = {r["event_id"] for r in env["rows"]}
    linked = [r for r in cbs if r.get("original_event_id")]
    unlinked = [r for r in cbs if not r.get("original_event_id")]
    out = dict(env)
    out["rows"] = linked
    out["pulled_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    return out, unlinked, sum(1 for r in linked if r["original_event_id"] in ids)


def selftest():
    env = json.load(open(os.path.join(CM.FIX, "commissions.impact.json"), encoding="utf-8"))
    out, unlinked, in_batch = split(env)
    env2 = dict(env, rows=env["rows"] + [{"event_id": "bad:rev", "event_time": "2026-09-19T00:00:00Z", "sub_id": "FIXTURETOKEN00000009", "status": "reversed",
                                          "amount": -1.0, "currency": "USD", "is_chargeback": True}])
    out2, unlinked2, _ = split(env2)
    ok = len(out["rows"]) == 1 and out["rows"][0]["original_event_id"] == "1234567.1001.900003" and not unlinked and in_batch == 0 \
        and len(out2["rows"]) == 1 and len(unlinked2) == 1
    print("linked=%d unlinked=%d original_in_batch=%d bad_row_unlinked=%d -> %s" % (len(out["rows"]), len(unlinked), in_batch, len(unlinked2), "OK" if ok else "FAIL"))
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1) if argv[i].startswith("--") and not argv[i + 1].startswith("--")}
    if "commissions" in kv:
        env = json.load(open(kv["commissions"], encoding="utf-8"))
    else:
        data, msg, rc = CM.fetch_api(int(kv.get("days", 30)))
        if rc:
            print(msg); return rc
        env = CM.envelope(data)
    out, unlinked, _ = split(env)
    out["unlinked"] = unlinked
    if kv.get("out"):
        os.makedirs(os.path.dirname(os.path.abspath(kv["out"])), exist_ok=True)
        json.dump(out, open(kv["out"], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("chargebacks=%d unlinked=%d -> %s" % (len(out["rows"]), len(unlinked), kv["out"]))
    else:
        print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
