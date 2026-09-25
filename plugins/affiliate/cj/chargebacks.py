#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CJ 插件 · chargebacks 动作（拒付解析）

从 commissions 动作的输出（或直接走 api/csv 再拉一次）里筛出拒付与纠正行：is_chargeback 为 true，amount 为负，original_event_id 指向原事件。
关联不上原事件的行单独列在 unlinked 里，主干对它们记 unknown，不做负转化。

用法：
  python3 chargebacks.py --commissions runs/<id>/commissions.json [--out runs/<id>/chargebacks.json]
  python3 chargebacks.py --days 30 [--out ...]      # 直接走 api
  python3 chargebacks.py --selftest
"""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import commissions as CM  # noqa: E402


def split(env):
    cbs = [r for r in env["rows"] if r.get("is_chargeback")]
    ids = {r["event_id"] for r in env["rows"]}
    linked = [r for r in cbs if r.get("original_event_id")]
    unlinked = [r for r in cbs if not r.get("original_event_id")]
    out = dict(env)
    out["rows"] = linked
    out["pulled_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    return out, unlinked, sum(1 for r in linked if r["original_event_id"] in ids)


def selftest():
    env = {"type": "adspilot.commissions", "schema_version": 1, "network": "cj", "currency": "USD", "pulled_at": "x", "rows": [
        {"event_id": "1", "event_time": "2026-09-01T00:00:00Z", "sub_id": "A", "status": "new", "amount": 5, "currency": "USD"},
        {"event_id": "2", "event_time": "2026-09-02T00:00:00Z", "sub_id": "A", "status": "reversed", "amount": -5, "currency": "USD", "is_chargeback": True, "original_event_id": "1"},
        {"event_id": "3", "event_time": "2026-09-02T00:00:00Z", "sub_id": "B", "status": "reversed", "amount": -2, "currency": "USD", "is_chargeback": True}]}
    out, unlinked, in_batch = split(env)
    ok = len(out["rows"]) == 1 and len(unlinked) == 1 and in_batch == 1
    print("linked=%d unlinked=%d -> %s" % (len(out["rows"]), len(unlinked), "OK" if ok else "FAIL"))
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
