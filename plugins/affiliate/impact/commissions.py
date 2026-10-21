#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Impact 插件 · commissions 动作（Actions -> 标准佣金明细，拒付行一起出）

api 路：GET /Actions 按「最后更新时间」开窗（StartDate 与 EndDate 必须成对，单次跨度不超过 45 天，脚本按 45 天切段，翻 @nextpageuri 取齐）。
按更新时间而不是事件时间开窗，是为了让状态变化也落进窗口：一条早先追踪的 Action 这几天被撤销，它会再出现一次，State=REVERSED。
  PENDING ⇒ new，APPROVED ⇒ closed：一行佣金，sub_id 装 SubId1，click_time 装 ReferringDate（点击时间），event_time 装 EventDate。
  REVERSED ⇒ 一行拒付：event_id "<Id>:rev"，amount 为负，is_chargeback true，original_event_id 指向原 Id。金额优先取同窗口 GET /ActionUpdates?State=REVERSED
  里该 Action 的 DeltaPayout（负数），没有就取 Payout 或 IntendedPayout 的相反数；event_time 取 UpdateDate。
offer_ref 要 AdvertiserId，Actions 里只有 CampaignId，所以先 GET /Campaigns 建一张 CampaignId → AdvertiserId 表（一次请求；拉不到就写 "impact:?:<CampaignId>"）。
csv 路：后台 Reports → Action Listing 导出的 CSV（没有 API 时的退路），--csv <file>。列名别名在 CSV_ALIASES，还没对着真实导出核过。
输出 schemas/commissions.schema.json。

用法：
  python3 commissions.py --days 7 --out runs/<id>/commissions.json            # api 路（日常循环调的就是这一条）
  python3 commissions.py --csv data/inbox/impact-action-listing.csv --out ...  # csv 路
  python3 commissions.py --selftest
退出码：0 成功（含零行）；3 API 失败；4 凭据缺失或凭据错。
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
import impact_common as I  # noqa: E402

FIX = os.path.join(ROOT, "tests", "fixtures")
# CSV 表头别名 -> Impact 字段名；按导出表头的英文小写比。还没对着真实导出核过（见使用方法「待核对」）。
CSV_ALIASES = {"Id": ["action id", "actionid", "id"], "EventDate": ["action date", "event date", "actiondate", "eventdate"],
               "ReferringDate": ["referring date", "referringdate", "click date"], "SubId1": ["sub id 1", "subid1", "sub id1", "sub_id1"],
               "State": ["state", "status", "action status"], "Payout": ["payout", "commission", "earnings"], "Amount": ["sale amount", "amount", "saleamount"],
               "Currency": ["currency", "payout currency"], "CampaignName": ["campaign", "brand", "campaign name", "program"],
               "CampaignId": ["campaign id", "campaignid", "program id"], "ActionTrackerName": ["event type", "action tracker", "action tracker name", "event name"],
               "IntendedPayout": ["intended payout"]}


def _iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def campaign_map():
    """CampaignId -> AdvertiserId。拉不到就空表（offer_ref 写 impact:?:<CampaignId>），不因此失败。"""
    try:
        camps, _ = I.get_all("Campaigns", {}, "Campaigns")
    except I.Unauthorized:
        raise
    except I.ImpactError:
        return {}
    return {str(c.get("CampaignId")): str(c.get("AdvertiserId") or "") for c in camps}


def fetch_api(days):
    miss = I.missing_creds()
    if miss:
        return None, "missing env: %s" % ", ".join(miss), 4
    until = datetime.now(timezone.utc)
    since = until - timedelta(days=days)
    try:
        adv = campaign_map()
    except I.Unauthorized as e:
        return None, str(e), 4
    rows, pages, seen, updates = [], 0, set(), {}
    seg_start = since
    while seg_start < until:
        seg_end = min(seg_start + timedelta(days=I.WINDOW_DAYS), until)
        prm = {"StartDate": _iso(seg_start), "EndDate": _iso(seg_end)}
        try:
            ups, p2 = I.get_all("ActionUpdates", dict(prm, State="REVERSED"), "ActionUpdates")
        except I.Forbidden:
            ups, p2 = [], 0   # 没勾作用域就不用 DeltaPayout，拒付金额退回 Payout / IntendedPayout
        except I.Unauthorized as e:
            return None, str(e), 4
        except I.ImpactError as e:
            return None, "api failed: %s" % str(e)[:300], 3
        for u in ups:
            updates[str(u.get("ActionId") or "")] = {"delta": I.num(u.get("DeltaPayout")), "time": u.get("UpdateDate") or ""}
        try:
            acts, p1 = I.get_all("Actions", prm, "Actions")
        except I.Unauthorized as e:
            return None, str(e), 4
        except I.ImpactError as e:
            return None, "api failed: %s" % str(e)[:300], 3
        pages += p1 + p2
        for a in acts:
            for r in I.action_rows(a, adv, updates):
                if r["event_id"] not in seen:
                    seen.add(r["event_id"]); rows.append(r)
        seg_start = seg_end
    return {"network": "impact", "window": {"since": since.strftime("%Y-%m-%d"), "until": until.strftime("%Y-%m-%d")}, "rows": rows, "pages": pages}, "", 0


def parse_csv(text):
    rdr = csv.reader(io.StringIO(text))
    header, rows = None, []
    for rec in rdr:
        if header is None:
            n = [c.strip().lower() for c in rec]
            if any(c in CSV_ALIASES["Id"] for c in n):
                header = n
            continue
        if not rec or all(not c.strip() for c in rec):
            continue
        a = {}
        for key, names in CSV_ALIASES.items():
            for j, h in enumerate(header):
                if h in names and j < len(rec):
                    a[key] = rec[j].strip().replace("$", "").replace(",", "") if key in ("Payout", "Amount", "IntendedPayout") else rec[j].strip()
                    break
        rows.extend(I.action_rows(a))
    if header is None:
        raise ValueError("no recognizable Impact action listing header")
    return rows


def envelope(data):
    cur = next((r.get("currency") for r in data["rows"] if r.get("currency")), "USD")
    return {"type": "adspilot.commissions", "schema_version": 1, "network": "impact", "currency": cur,
            "pulled_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "window": data.get("window", {}), "rows": data["rows"]}


def selftest():
    acts = json.load(open(os.path.join(FIX, "impact.actions.json"), encoding="utf-8"))["Actions"]
    ups = json.load(open(os.path.join(FIX, "impact.action-updates.json"), encoding="utf-8"))["ActionUpdates"]
    camps = json.load(open(os.path.join(FIX, "impact.campaigns.json"), encoding="utf-8"))["Campaigns"]
    adv = {str(c["CampaignId"]): str(c["AdvertiserId"]) for c in camps}
    updates = {str(u["ActionId"]): {"delta": I.num(u.get("DeltaPayout")), "time": u.get("UpdateDate")} for u in ups}
    rows = [r for a in acts for r in I.action_rows(a, adv, updates)]
    env = envelope({"rows": rows})
    sys.path.insert(0, os.path.join(ROOT, "core", "selfcheck"))
    from validate import load_schema, validate
    errs = validate(load_schema("commissions.schema.json"), env)
    by = {r["event_id"]: r for r in rows}
    pend, appr = by.get("1234567.1001.900001", {}), by.get("1234567.1002.900002", {})
    cb = by.get("1234567.1001.900003:rev", {})
    no_upd = [r for a in acts if a["State"] == "REVERSED" for r in I.action_rows(a, adv, {})][0]
    checks = {
        "schema": not errs,
        "三条 Action 出三行（REVERSED 不出正数行）": len(rows) == 3 and "1234567.1001.900003" not in by,
        "PENDING ⇒ new 带 SubId1 与点击时间": pend.get("status") == "new" and pend.get("sub_id") == "FIXTURETOKEN00000001" and pend.get("click_time") == "2026-09-10T14:03:00Z" and pend.get("amount") == 18.4,
        "APPROVED ⇒ closed": appr.get("status") == "closed" and appr.get("offer_ref") == "impact:1002:4322",
        "REVERSED ⇒ 拒付行取 DeltaPayout": cb.get("is_chargeback") is True and cb.get("amount") == -3.68 and cb.get("original_event_id") == "1234567.1001.900003" and cb.get("event_time") == "2026-09-18T10:00:00Z" and cb.get("status") == "reversed",
        "没有 ActionUpdates ⇒ 用 IntendedPayout 取负": no_upd.get("amount") == -3.68 and no_upd.get("event_id").endswith(":rev"),
        "offer_ref 带 AdvertiserId": pend.get("offer_ref") == "impact:1001:4321",
    }
    sample = ("Action Id,Action Date,Referring Date,State,Payout,Sale Amount,Currency,Campaign,Campaign Id,Event Type,Sub Id 1\n"
              "1234567.1001.900009,2026-09-11T03:12:44Z,2026-09-10T14:03:00Z,PENDING,$18.40,\"$1,092.00\",USD,Brand X,4321,Online Sale,FIXTURETOKEN00000001\n"
              "1234567.1001.900010,2026-09-12T03:12:44Z,2026-09-11T14:03:00Z,REVERSED,$2.00,$25.00,USD,Brand X,4321,Online Sale,FIXTURETOKEN00000003\n")
    csv_rows = parse_csv(sample)
    checks["csv 退路：两行，拒付为负"] = len(csv_rows) == 2 and csv_rows[0]["amount"] == 18.4 and csv_rows[0]["sale_amount"] == 1092.0 and csv_rows[1]["amount"] == -2.0 and csv_rows[1]["is_chargeback"] is True
    checks["csv 行过 schema"] = not validate(load_schema("commissions.schema.json"), envelope({"rows": csv_rows}))
    ok = all(checks.values())
    print("rows=%d schema=%s %s -> %s" % (len(rows), "ok" if not errs else errs[:2], {k: v for k, v in checks.items() if not v} or "all checks pass", "OK" if ok else "FAIL"))
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
