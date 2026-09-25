#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CJ 插件 · commissions 动作（佣金明细 -> 标准佣金明细）

两条路：
  api  Commission Detail GraphQL（commissions.api.cj.com），用户自己的 personal access token 与 publisher id（CID）。
  csv  后台 Reports > Commission Detail 导出的 CSV（没有 API 时的退路），列名按 CJ 导出的英文表头。
输出 schemas/commissions.schema.json。sub_id 装的是 shopperId 字段（sid 已废弃）。

用法：
  python3 commissions.py --days 7 --out runs/<id>/commissions.json            # api 路
  python3 commissions.py --csv data/inbox/cj-commission-detail.csv --out ...   # csv 路
  python3 commissions.py --selftest
退出码：0 成功；3 API 失败；4 凭据缺失。
"""
import csv
import io
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
import cj_common as C  # noqa: E402

QUERY = """{ publisherCommissions(forPublishers: ["%s"], sincePostingDate: "%s", beforePostingDate: "%s") {
  count payloads { commissionId actionStatus actionType advertiserId advertiserName aid clickDate eventDate postingDate orderId original originalActionId
    pubCommissionAmountUsd saleAmountUsd shopperId correctionReason websiteId } } }"""

CSV_ALIASES = {"event_id": ["commission id", "action id"], "event_time": ["event date", "posting date"], "click_time": ["click date"],
               "sub_id": ["shopper id", "sid"], "status": ["action status", "status"], "amount": ["publisher commission usd", "commission amount", "publisher commission"],
               "sale_amount": ["sale amount usd", "sale amount"], "advertiser": ["advertiser name"], "advertiser_id": ["advertiser id", "cid"],
               "action": ["action type"], "original": ["original"], "original_event_id": ["original action id"], "correction": ["correction reason"]}


def fetch_api(days):
    miss = C.missing_creds()
    if miss:
        return None, "missing env: %s" % ", ".join(miss), 4
    _, pid = C.creds()
    until = datetime.now(timezone.utc)
    since = until - timedelta(days=days)
    q = QUERY % (pid, since.strftime("%Y-%m-%dT%H:%M:%SZ"), until.strftime("%Y-%m-%dT%H:%M:%SZ"))
    try:
        res = C.graphql(q)
    except Exception as e:  # noqa: BLE001
        return None, "api failed: %s" % str(e)[:200], 3
    if res.get("errors"):
        return None, "api errors: %s" % json.dumps(res["errors"])[:300], 3
    payloads = res.get("data", {}).get("publisherCommissions", {}).get("payloads", [])
    return {"network": "cj", "publisher_id": pid, "window": {"since": since.strftime("%Y-%m-%d"), "until": until.strftime("%Y-%m-%d")},
            "rows": [C.commission_row(p) for p in payloads]}, "", 0


def parse_csv(text):
    rdr = csv.reader(io.StringIO(text))
    header = None
    rows = []
    for rec in rdr:
        if header is None:
            n = [c.strip().lower() for c in rec]
            if any(c in CSV_ALIASES["event_id"] for c in n):
                header = n
            continue
        if not rec or all(not c.strip() for c in rec):
            continue
        g = {}
        for key, names in CSV_ALIASES.items():
            for j, h in enumerate(header):
                if h in names and j < len(rec):
                    g[key] = rec[j].strip(); break
        amt = float((g.get("amount") or "0").replace("$", "").replace(",", "") or 0)
        original = (g.get("original", "true").lower() != "false")
        is_cb = (not original and amt < 0) or (bool(g.get("correction")) and amt < 0)
        row = {"event_id": g.get("event_id", ""), "event_time": g.get("event_time", ""), "click_time": g.get("click_time", ""),
               "sub_id": g.get("sub_id", ""), "status": C.status_map(g.get("status")), "amount": amt,
               "sale_amount": float((g.get("sale_amount") or "0").replace("$", "").replace(",", "") or 0), "currency": "USD",
               "advertiser": g.get("advertiser", ""), "advertiser_id": g.get("advertiser_id", ""), "action": g.get("action", ""), "is_chargeback": is_cb}
        if g.get("original_event_id"):
            row["original_event_id"] = g["original_event_id"]
        if is_cb and row["status"] in ("unknown", "new"):
            row["status"] = "reversed"
        rows.append(row)
    if header is None:
        raise ValueError("no recognizable CJ commission detail header")
    return rows


def envelope(data, currency="USD"):
    return {"type": "adspilot.commissions", "schema_version": 1, "network": "cj", "publisher_id": data.get("publisher_id", ""), "currency": currency,
            "pulled_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "window": data.get("window", {}), "rows": data["rows"]}


def selftest():
    sample = ("Commission ID,Action Status,Action Type,Advertiser ID,Advertiser Name,Click Date,Event Date,Posting Date,Original,Original Action ID,Publisher Commission USD,Sale Amount USD,Shopper ID\n"
              "111,new,sale,100001,Brand X,2026-09-10T14:03:00Z,2026-09-11T03:12:44Z,2026-09-11T05:00:00Z,true,,18.40,92.00,FIXTURETOKEN00000001\n"
              "112,locked,sale,100001,Brand X,2026-09-10T14:03:00Z,2026-09-18T10:00:00Z,2026-09-18T11:00:00Z,false,111,-18.40,0,FIXTURETOKEN00000001\n")
    rows = parse_csv(sample)
    payload = {"commissionId": "113", "actionStatus": "new", "actionType": "sale", "advertiserId": "100002", "advertiserName": "Brand Y", "aid": "12346",
               "clickDate": "2026-09-12T09:30:00Z", "eventDate": "2026-09-13T11:00:00Z", "original": True, "pubCommissionAmountUsd": "7.5", "saleAmountUsd": "50", "shopperId": "FIXTURETOKEN00000002"}
    rows.append(C.commission_row(payload))
    env = envelope({"rows": rows, "publisher_id": "1234567"})
    sys.path.insert(0, os.path.join(ROOT, "core", "selfcheck"))
    from validate import load_schema, validate
    errs = validate(load_schema("commissions.schema.json"), env)
    ok = not errs and rows[1]["is_chargeback"] and rows[1]["original_event_id"] == "111" and rows[2]["sub_id"] == "FIXTURETOKEN00000002"
    print("rows=%d chargeback=%s schema=%s -> %s" % (len(rows), rows[1]["is_chargeback"], "ok" if not errs else errs[:2], "OK" if ok else "FAIL"))
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1) if argv[i].startswith("--") and not argv[i + 1].startswith("--")}
    if "csv" in kv:
        try:
            data = {"rows": parse_csv(open(kv["csv"], encoding="utf-8-sig").read())}
        except ValueError as e:
            print(str(e)); return 1
    else:
        data, msg, rc = fetch_api(int(kv.get("days", 7)))
        if rc:
            print(msg); return rc
    env = envelope(data)
    if kv.get("out"):
        os.makedirs(os.path.dirname(os.path.abspath(kv["out"])), exist_ok=True)
        json.dump(env, open(kv["out"], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("rows=%d -> %s" % (len(env["rows"]), kv["out"]))
    else:
        print(json.dumps(env, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
