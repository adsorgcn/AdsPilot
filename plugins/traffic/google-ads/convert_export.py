#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Ads 插件 · convert 动作（对账结果 -> 后台可直接上传的离线转化 CSV）

输入：core/ledger/reconcile.py 的输出（adspilot.conversions）。
输出：
  <out>                     点击转化上传文件（后台「目标 > 转化 > 上传」用，或 Google Sheets 模板同列）
  <out>.adjustments.csv     拒付对应的转化调整文件（RETRACTION），只在有拒付且能找到原转化时间时生成
时间列按 --timezone 写成 "yyyy-MM-dd HH:mm:ss+HH:MM" 带偏移，后台无需再选时区。

用法：
  python3 convert_export.py --conversions runs/<id>/conversions.json --out data/outbox/conversions-<id>.csv [--timezone Asia/Tokyo]
  python3 convert_export.py --selftest
"""
import csv
import json
import os
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "core", "ledger"))

HEADER = ["Google Click ID", "Conversion Name", "Conversion Time", "Conversion Value", "Conversion Currency"]
ADJ_HEADER = ["Google Click ID", "Conversion Name", "Conversion Time", "Adjustment Time", "Adjustment Type", "Adjusted Value", "Adjusted Value Currency"]


def tz_of(name):
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo(name)
    except Exception:  # noqa: BLE001
        return timezone.utc


def fmt_time(iso, tz):
    s = iso.replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(tz)
    off = dt.strftime("%z")
    return dt.strftime("%Y-%m-%d %H:%M:%S") + off[:3] + ":" + off[3:]


def build(conv, tz, ledger_lookup=None):
    rows = [[r["gclid"], r["conversion_name"], fmt_time(r["conversion_time"], tz), "%.2f" % r["value"], r["currency"]] for r in conv.get("rows", [])]
    adjs = []
    orig_times = {r["event_id"]: r["conversion_time"] for r in conv.get("rows", [])}
    for cb in conv.get("chargebacks", []):
        oid = cb.get("original_event_id")
        ot = orig_times.get(oid) or (ledger_lookup(oid) if (ledger_lookup and oid) else None)
        if not ot:
            continue
        adjs.append([cb["gclid"], cb["conversion_name"], fmt_time(ot, tz), fmt_time(cb["conversion_time"], tz), "RETRACTION", "", cb["currency"]])
    return rows, adjs


def ledger_time_lookup(event_id):
    try:
        import subid
        con = subid.open_db()
        r = con.execute("SELECT event_time FROM conversions WHERE event_id=?", (event_id,)).fetchone()
        return r[0] if r else None
    except Exception:  # noqa: BLE001
        return None


def write(out, rows, adjs, tzname):
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w", newline="", encoding="utf-8") as f:
        f.write("Parameters:TimeZone=%s\n" % tzname)
        w = csv.writer(f); w.writerow(HEADER); w.writerows(rows)
    if adjs:
        with open(out + ".adjustments.csv", "w", newline="", encoding="utf-8") as f:
            f.write("Parameters:TimeZone=%s\n" % tzname)
            w = csv.writer(f); w.writerow(ADJ_HEADER); w.writerows(adjs)


def selftest():
    conv = {"rows": [{"event_id": "e1", "gclid": "CjwKCAjw_example_gclid_0001", "conversion_name": "affiliate_commission", "conversion_time": "2026-09-11T03:12:44+00:00", "value": 18.4, "currency": "USD"}],
            "chargebacks": [{"event_id": "e2", "original_event_id": "e1", "gclid": "CjwKCAjw_example_gclid_0001", "conversion_name": "affiliate_commission", "conversion_time": "2026-09-18T10:00:00+00:00", "value": -18.4, "currency": "USD"}]}
    rows, adjs = build(conv, tz_of("Asia/Tokyo"))
    ok = rows[0][2] == "2026-09-11 12:12:44+09:00" and len(adjs) == 1 and adjs[0][4] == "RETRACTION"
    print("row_time=%s adjustments=%d -> %s" % (rows[0][2], len(adjs), "OK" if ok else "FAIL"))
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1, 2) if argv[i].startswith("--")}
    if "conversions" not in kv or "out" not in kv:
        print(__doc__); return 1
    conv = json.load(open(kv["conversions"], encoding="utf-8"))
    tzname = kv.get("timezone", "UTC")
    rows, adjs = build(conv, tz_of(tzname), ledger_time_lookup)
    write(kv["out"], rows, adjs, tzname)
    print("conversions=%d adjustments=%d -> %s" % (len(rows), len(adjs), kv["out"]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
