#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
对账（主干，归因与对账部件）

输入：标准佣金明细（schemas/commissions.schema.json，联盟插件 commissions/chargebacks 动作的输出）+ 账本里的映射表。
做：sub_id(token) join 映射表 -> gclid；过窗口与时间检查；写 conversions 与 chargebacks 表（幂等，按 event_id）；
输出：平台无关的转化行 JSON，交给流量插件的 convert 动作变成该平台的上传文件。

用法：
  python3 core/ledger/reconcile.py --commissions data/inbox/cj-commissions.json [--out data/outbox/conversions.json]
      [--conversion-name affiliate_commission] [--window-days 90] [--db path] [--batch run_id]
  python3 core/ledger/reconcile.py --selftest

退出码：0 正常（包括零行）；1 输入不合格。
只用标准库。日志不打印 gclid 原文。
"""
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "core", "selfcheck"))
import subid  # noqa: E402


def parse_time(s):
    if not s:
        return None
    s = s.strip().replace("Z", "+00:00")
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%d %H:%M:%S%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(s, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def gclid_ok(g):
    return isinstance(g, str) and 10 <= len(g) <= 200 and all(c.isalnum() or c in "-_" for c in g)


def reconcile(con, commissions, conversion_name="affiliate_commission", window_days=90, batch=None):
    if commissions.get("type") != "adspilot.commissions":
        raise ValueError("not adspilot.commissions")
    batch = batch or time.strftime("rec-%Y%m%d-%H%M%S")
    rows, unmatched, out_of_window, invalid, cbs = [], [], [], [], []
    now = subid.now_iso()
    for r in commissions.get("rows", []):
        tok = (r.get("sub_id") or "").strip()
        is_cb = bool(r.get("is_chargeback")) or float(r.get("amount", 0)) < 0 or r.get("status") in ("reversed", "corrected")
        m = subid.lookup(con, tok) if subid.valid_token(tok) else None
        if not m:
            unmatched.append({"event_id": r["event_id"], "sub_id": tok, "amount": r.get("amount"), "why": "no_mapping"})
            continue
        g = m.get("gclid") or ""
        if not gclid_ok(g):
            invalid.append({"event_id": r["event_id"], "token": tok, "why": "gclid_missing_or_invalid"})
            continue
        click_t = parse_time(m.get("ts"))
        ev_t = parse_time(r.get("event_time"))
        if not ev_t:
            invalid.append({"event_id": r["event_id"], "token": tok, "why": "bad_event_time"})
            continue
        if is_cb:
            con.execute("INSERT OR IGNORE INTO chargebacks(event_id,original_event_id,token,gclid,event_time,amount,currency,network,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
                        (r["event_id"], r.get("original_event_id"), tok, g, ev_t.isoformat(), float(r.get("amount", 0)), r.get("currency"), commissions.get("network"), now))
            cbs.append({"event_id": r["event_id"], "original_event_id": r.get("original_event_id"), "gclid": g, "token": tok,
                        "conversion_name": conversion_name, "conversion_time": ev_t.isoformat(), "value": float(r.get("amount", 0)),
                        "currency": r.get("currency") or commissions.get("currency")})
            continue
        if click_t and ev_t < click_t:
            invalid.append({"event_id": r["event_id"], "token": tok, "why": "conversion_before_click"})
            continue
        if click_t and ev_t - click_t > timedelta(days=window_days):
            out_of_window.append({"event_id": r["event_id"], "token": tok, "days": (ev_t - click_t).days})
            continue
        con.execute("INSERT OR IGNORE INTO conversions(event_id,token,gclid,event_time,click_time,amount,currency,status,network,offer,batch,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                    (r["event_id"], tok, g, ev_t.isoformat(), click_t.isoformat() if click_t else None, float(r.get("amount", 0)),
                     r.get("currency") or commissions.get("currency"), r.get("status", "unknown"), commissions.get("network"), r.get("offer_ref") or m.get("offer"), batch, now))
        rows.append({"event_id": r["event_id"], "gclid": g, "token": tok, "conversion_name": conversion_name,
                     "conversion_time": ev_t.isoformat(), "value": float(r.get("amount", 0)),
                     "currency": r.get("currency") or commissions.get("currency"),
                     "campaign": m.get("campaign"), "adgroup": m.get("adgroup"), "keyword": m.get("keyword"), "offer": r.get("offer_ref") or m.get("offer")})
    con.commit()
    return {"type": "adspilot.conversions", "schema_version": 1, "batch": batch, "network": commissions.get("network"),
            "conversion_name": conversion_name, "window_days": window_days, "generated_at": now,
            "rows": rows, "chargebacks": cbs, "unmatched": unmatched, "out_of_window": out_of_window, "invalid": invalid,
            "summary": {"matched": len(rows), "chargebacks": len(cbs), "unmatched": len(unmatched), "out_of_window": len(out_of_window), "invalid": len(invalid),
                        "value": round(sum(x["value"] for x in rows), 2)}}


def mark_uploaded(con, batch, event_ids):
    now = subid.now_iso()
    con.executemany("UPDATE conversions SET uploaded_at=?, batch=? WHERE event_id=? AND uploaded_at IS NULL", [(now, batch, e) for e in event_ids])
    con.commit()


def redacted(out):
    o = json.loads(json.dumps(out))
    for r in o["rows"] + o["chargebacks"]:
        r["gclid"] = subid.mask(r["gclid"])
    return o


def selftest():
    import sqlite3
    con = sqlite3.connect(":memory:")
    con.executescript(subid.SCHEMA)
    t1 = subid.record(con, {"gclid": "CjwKCAjw_example_gclid_0001", "campaign": "c1", "adgroup": "a1", "keyword": "k1", "ts": "2026-09-01T10:00:00+00:00", "network": "cj", "offer": "cj:1:1"})
    t2 = subid.record(con, {"gclid": "", "campaign": "c1", "ts": "2026-09-01T10:00:00+00:00"})
    t3 = subid.record(con, {"gclid": "CjwKCAjw_example_gclid_0003", "campaign": "c1", "ts": "2026-01-01T10:00:00+00:00"})
    con.commit()
    com = {"type": "adspilot.commissions", "schema_version": 1, "network": "cj", "currency": "USD", "pulled_at": "x", "rows": [
        {"event_id": "e1", "event_time": "2026-09-03T12:00:00Z", "sub_id": t1, "status": "new", "amount": 12.5, "currency": "USD"},
        {"event_id": "e1", "event_time": "2026-09-03T12:00:00Z", "sub_id": t1, "status": "new", "amount": 12.5, "currency": "USD"},
        {"event_id": "e2", "event_time": "2026-09-03T12:00:00Z", "sub_id": "NOPE", "status": "new", "amount": 1, "currency": "USD"},
        {"event_id": "e3", "event_time": "2026-09-03T12:00:00Z", "sub_id": t2, "status": "new", "amount": 1, "currency": "USD"},
        {"event_id": "e4", "event_time": "2026-09-03T12:00:00Z", "sub_id": t3, "status": "new", "amount": 1, "currency": "USD"},
        {"event_id": "e5", "event_time": "2026-09-10T12:00:00Z", "sub_id": t1, "status": "reversed", "amount": -12.5, "currency": "USD", "is_chargeback": True, "original_event_id": "e1"},
        {"event_id": "e6", "event_time": "2026-08-30T12:00:00Z", "sub_id": t1, "status": "new", "amount": 1, "currency": "USD"},
    ]}
    out = reconcile(con, com, window_days=90, batch="t")
    s = out["summary"]
    want = {"matched": 2, "chargebacks": 1, "unmatched": 1, "out_of_window": 1, "invalid": 2}
    ok = all(s[k] == v for k, v in want.items())
    db_rows = con.execute("SELECT COUNT(*) FROM conversions").fetchone()[0]
    ok = ok and db_rows == 1
    print(json.dumps(s), "db_conversions=%d" % db_rows, "OK" if ok else "FAIL (want %s, 1 db row)" % want)
    try:
        from validate import load_schema, validate as _v
        errs = _v(load_schema("commissions.schema.json"), com)
        print("commissions fixture schema:", "ok" if not errs else errs[:2])
        ok = ok and not errs
    except ImportError:
        pass
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {}
    i = 0
    while i < len(argv):
        if argv[i].startswith("--") and i + 1 < len(argv):
            kv[argv[i][2:]] = argv[i + 1]; i += 2
        else:
            i += 1
    if "commissions" not in kv:
        print(__doc__); return 1
    com = json.load(open(kv["commissions"], encoding="utf-8"))
    con = subid.open_db(kv.get("db"))
    out = reconcile(con, com, kv.get("conversion-name", "affiliate_commission"), int(kv.get("window-days", 90)), kv.get("batch"))
    if kv.get("out"):
        os.makedirs(os.path.dirname(os.path.abspath(kv["out"])), exist_ok=True)
        json.dump(out, open(kv["out"], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(json.dumps(out["summary"]))
    else:
        print(json.dumps(redacted(out), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
