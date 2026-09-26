#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Ads 插件 · report 动作（CSV 导出 -> 标准投放报表）

Agent 在用户自己的 Google Ads 后台导出「关键字」或「广告系列」报表（按天分段，CSV），本脚本把它翻译成
schemas/traffic-report.schema.json。英文与中文界面的列名都认；报表头部的标题行、尾部的合计行会跳过。

用法：
  python3 report_import.py --csv data/inbox/google-ads-report.csv --out runs/<id>/traffic-report.json [--currency USD] [--account xxx]
  python3 report_import.py --selftest
退出码：0 成功；1 找不到可识别的表头。
"""
import csv
import io
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))

ALIASES = {
    "date": ["day", "date", "日期", "天"],
    "campaign": ["campaign", "campaign name", "广告系列", "广告系列名称"],
    "campaign_id": ["campaign id", "广告系列 id", "广告系列id"],
    "campaign_status": ["campaign state", "campaign status", "广告系列状态"],
    "adgroup": ["ad group", "ad group name", "广告组", "广告组名称"],
    "adgroup_id": ["ad group id", "广告组 id", "广告组id"],
    "keyword": ["keyword", "search keyword", "关键字", "关键词", "搜索关键字"],
    "keyword_id": ["keyword id", "关键字 id"],
    "match": ["match type", "匹配类型"],
    "impressions": ["impr.", "impressions", "展示次数", "展示"],
    "clicks": ["clicks", "点击次数", "点击"],
    "cost": ["cost", "费用", "花费"],
    "avg_cpc": ["avg. cpc", "average cpc", "平均每次点击费用", "平均cpc"],
    "conversions": ["conversions", "conv.", "转化次数", "转化"],
    "conv_value": ["conv. value", "conversion value", "转化价值", "总转化价值"],
    "top_of_page_bid": ["top of page bid est.", "est. top of page bid", "top of page bid estimate", "top of page cpc",
                        "首页顶部出价估算值", "首页顶部出价估计值"],
    "policy": ["policy details", "approval status", "政策详情", "审批状态", "ad approval status"],
}
MATCH = {"phrase match": "phrase", "exact match": "exact", "broad match": "broad", "词组匹配": "phrase", "完全匹配": "exact", "广泛匹配": "broad",
         "phrase": "phrase", "exact": "exact", "broad": "broad"}


def norm(s):
    return re.sub(r"\s+", " ", (s or "").strip().lower().replace("﻿", ""))


def to_num(s):
    if s is None:
        return 0.0
    s = str(s).strip().replace(",", "").replace("$", "").replace("¥", "").replace("US", "").replace("%", "")
    if s in ("", "--", "—", "-"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def to_date(s):
    s = (s or "").strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%b %d, %Y", "%d %b %Y", "%Y年%m月%d日"):
        try:
            return time.strftime("%Y-%m-%d", time.strptime(s, fmt))
        except ValueError:
            continue
    return None


def parse_csv_text(text, currency="USD", account=""):
    lines = text.splitlines()
    # 找表头：含 date/day 与 clicks 的那一行
    header_idx, header = None, None
    for i, line in enumerate(lines[:20]):
        cells = next(csv.reader([line]))
        n = [norm(c) for c in cells]
        if any(c in ALIASES["clicks"] for c in n) and any(c in ALIASES["date"] for c in n):
            header_idx, header = i, n
            break
    if header is None:
        raise ValueError("no recognizable header (need a day/date column and a clicks column)")
    colmap = {}
    for key, names in ALIASES.items():
        for j, h in enumerate(header):
            if h in names and key not in colmap:
                colmap[key] = j
    rows = []
    for rec in csv.reader(io.StringIO("\n".join(lines[header_idx + 1:]))):
        if not rec or all(not c.strip() for c in rec):
            continue
        first = norm(rec[0])
        if first.startswith(("total", "合计", "总计")) or (colmap.get("campaign") is not None and len(rec) > colmap["campaign"] and norm(rec[colmap["campaign"]]).startswith(("total", "合计", "总计"))):
            continue
        d = to_date(rec[colmap["date"]]) if len(rec) > colmap["date"] else None
        if not d:
            continue

        def g(k, default=""):
            j = colmap.get(k)
            return rec[j] if j is not None and j < len(rec) else default

        clicks = int(round(to_num(g("clicks"))))
        cost = round(to_num(g("cost")), 4)
        row = {"date": d, "campaign": g("campaign").strip(), "impressions": int(round(to_num(g("impressions")))), "clicks": clicks, "cost": cost}
        for k in ("campaign_id", "campaign_status", "adgroup", "adgroup_id", "keyword", "keyword_id"):
            v = g(k).strip()
            if v:
                row[k] = v
        m = MATCH.get(norm(g("match")), "")
        if m:
            row["match"] = m
        row["avg_cpc"] = round(cost / clicks, 4) if clicks else round(to_num(g("avg_cpc")), 4)
        if colmap.get("conversions") is not None:
            row["conversions"] = to_num(g("conversions"))
        if colmap.get("conv_value") is not None:
            row["conv_value"] = to_num(g("conv_value"))
        tb = to_num(g("top_of_page_bid"))   # 谷歌给这个词的首页出价估计；空、-- 或 0 不写
        if tb > 0:
            row["top_of_page_bid"] = round(tb, 2)
        pol = g("policy").strip()
        if pol:
            row["policy"] = pol
            row["disapproved"] = bool(re.search(r"disapproved|不符合|已拒登|拒登", pol, re.I))
        rows.append(row)
    return {"type": "adspilot.traffic_report", "schema_version": 1, "platform": "google-ads", "account": account, "currency": currency,
            "pulled_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "source": "csv_export", "rows": rows}


def selftest():
    p = os.path.join(ROOT, "tests", "fixtures", "google-ads-report.csv")
    rep = parse_csv_text(open(p, encoding="utf-8").read())
    sys.path.insert(0, os.path.join(ROOT, "core", "selfcheck"))
    from validate import load_schema, validate
    errs = validate(load_schema("traffic-report.schema.json"), rep)
    ok = not errs and len(rep["rows"]) >= 5 and any(r.get("keyword") for r in rep["rows"])
    print("rows=%d schema=%s -> %s" % (len(rep["rows"]), "ok" if not errs else errs[:2], "OK" if ok else "FAIL"))
    # T4-g：谷歌给每个词的首页出价估计（英文、中文表头各一份）进 rows[].top_of_page_bid；空值不写
    en = "Day,Campaign,Ad group,Keyword,Clicks,Cost,Top of page bid est.\n2026-09-20,C,A,k1,10,30.00,4.20\n2026-09-20,C,A,k2,3,6.00,--\n"
    zh = "日期,广告系列,广告组,关键字,点击次数,费用,首页顶部出价估算值\n2026-09-20,C,A,k1,10,30.00,4.20\n"
    r_en, r_zh = parse_csv_text(en), parse_csv_text(zh)
    t4g = (r_en["rows"][0].get("top_of_page_bid") == 4.2 and "top_of_page_bid" not in r_en["rows"][1] and r_zh["rows"][0].get("top_of_page_bid") == 4.2
           and not validate(load_schema("traffic-report.schema.json"), r_en))
    print("T4-g 首页出价估计列 en=%s zh=%s 空值不写=%s -> %s" % (r_en["rows"][0].get("top_of_page_bid"), r_zh["rows"][0].get("top_of_page_bid"),
                                                          "top_of_page_bid" not in r_en["rows"][1], "OK" if t4g else "FAIL"))
    ok = ok and t4g
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1, 2) if argv[i].startswith("--")}
    if "csv" not in kv:
        print(__doc__); return 1
    raw = open(kv["csv"], "rb").read()
    for enc in ("utf-8-sig", "utf-16", "utf-8", "gbk"):
        try:
            text = raw.decode(enc); break
        except UnicodeDecodeError:
            continue
    else:
        print("cannot decode csv"); return 1
    try:
        rep = parse_csv_text(text, kv.get("currency", "USD"), kv.get("account", ""))
    except ValueError as e:
        print("import failed: %s" % e); return 1
    if kv.get("out"):
        os.makedirs(os.path.dirname(os.path.abspath(kv["out"])), exist_ok=True)
        json.dump(rep, open(kv["out"], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("rows=%d -> %s" % (len(rep["rows"]), kv["out"]))
    else:
        print(json.dumps(rep, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
