#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Ads 插件 · report 动作的 API 路（可选，用户自有凭据）

只有当用户自己持有 Google Ads API 的 developer token、OAuth 客户端与 refresh token 时才走这条路；否则用 report_import.py 的 CSV 路。
凭据全部从环境变量读，脚本不落盘、不打印。REST 版本从 GOOGLE_ADS_API_VERSION 取（默认 v25；Google 每季度下线旧版本，改一个环境变量即可）。
2026-09-09 起 developer token 已废弃，API 权限级别由生成 OAuth 凭据的 Google Cloud 项目决定；过渡期请求头仍可带 developer-token，没有就不带。

环境变量：
  GOOGLE_ADS_CLIENT_ID  GOOGLE_ADS_CLIENT_SECRET  GOOGLE_ADS_REFRESH_TOKEN  GOOGLE_ADS_CUSTOMER_ID（不带横线）
  可选：GOOGLE_ADS_DEVELOPER_TOKEN（过渡期）  GOOGLE_ADS_LOGIN_CUSTOMER_ID（经理账号时）  GOOGLE_ADS_API_VERSION（默认 v25）

用法：
  python3 report_api.py --out runs/<id>/traffic-report.json [--days 30] [--apply]
  不带 --apply 只打印将要发的请求（不含凭据），退出码 0。
退出码：0 成功；3 API 失败；4 凭据缺失。
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
NEEDED = ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"]
GAQL = ("SELECT segments.date, campaign.id, campaign.name, campaign.status, ad_group.id, ad_group.name, "
        "ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, "
        "metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value%s "
        "FROM keyword_view WHERE segments.date DURING LAST_%%d_DAYS")
# 谷歌给每个词的首页出价估计：出价上限的兜底（没有 offer 上限与用户上限时）。这个字段被 API 拒绝时退回不带它的查询。
BID_EST = ", ad_group_criterion.position_estimates.top_of_page_cpc_micros"


def queries(days):
    """先带首页出价估计，不行再不带。"""
    return [(GAQL % BID_EST) % days, (GAQL % "") % days]
MATCH = {"PHRASE": "phrase", "EXACT": "exact", "BROAD": "broad"}


def access_token(env):
    data = urllib.parse.urlencode({"client_id": env["GOOGLE_ADS_CLIENT_ID"], "client_secret": env["GOOGLE_ADS_CLIENT_SECRET"],
                                   "refresh_token": env["GOOGLE_ADS_REFRESH_TOKEN"], "grant_type": "refresh_token"}).encode()
    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data, method="POST")
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())["access_token"]


def search_stream(env, token, query):
    ver = env.get("GOOGLE_ADS_API_VERSION") or "v25"
    url = "https://googleads.googleapis.com/%s/customers/%s/googleAds:searchStream" % (ver, env["GOOGLE_ADS_CUSTOMER_ID"])
    headers = {"Authorization": "Bearer " + token, "Content-Type": "application/json"}
    if env.get("GOOGLE_ADS_DEVELOPER_TOKEN"):
        headers["developer-token"] = env["GOOGLE_ADS_DEVELOPER_TOKEN"]
    if env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID"):
        headers["login-customer-id"] = env["GOOGLE_ADS_LOGIN_CUSTOMER_ID"]
    req = urllib.request.Request(url, data=json.dumps({"query": query}).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def to_rows(chunks):
    rows = []
    for chunk in chunks:
        for res in chunk.get("results", []):
            m, c, ag, cr = res.get("metrics", {}), res.get("campaign", {}), res.get("adGroup", {}), res.get("adGroupCriterion", {})
            clicks = int(m.get("clicks", 0)); cost = int(m.get("costMicros", 0)) / 1e6
            row = {"date": res["segments"]["date"], "campaign": c.get("name", ""), "campaign_id": str(c.get("id", "")), "campaign_status": c.get("status", ""),
                   "adgroup": ag.get("name", ""), "adgroup_id": str(ag.get("id", "")), "keyword": cr.get("keyword", {}).get("text", ""),
                   "keyword_id": str(cr.get("criterionId", "")), "match": MATCH.get(cr.get("keyword", {}).get("matchType", ""), ""),
                   "impressions": int(m.get("impressions", 0)), "clicks": clicks, "cost": round(cost, 4),
                   "avg_cpc": round(cost / clicks, 4) if clicks else 0.0, "conversions": float(m.get("conversions", 0)), "conv_value": float(m.get("conversionsValue", 0))}
            tb = int((cr.get("positionEstimates") or {}).get("topOfPageCpcMicros") or 0)
            if tb > 0:
                row["top_of_page_bid"] = round(tb / 1e6, 2)
            rows.append(row)
    return rows


def selftest():
    """离线：查询里带首页出价估计、退路查询不带；to_rows 把 topOfPageCpcMicros 折成 top_of_page_bid，没有就不写；行过 schema。"""
    sys.path.insert(0, os.path.join(ROOT, "core", "selfcheck"))
    from validate import load_schema, validate
    q1, q2 = queries(30)
    base = {"segments": {"date": "2026-09-20"}, "campaign": {"id": "1", "name": "C", "status": "ENABLED"}, "adGroup": {"id": "2", "name": "A"},
            "metrics": {"impressions": "100", "clicks": "10", "costMicros": "30000000"}}
    with_est = dict(base, adGroupCriterion={"criterionId": "3", "keyword": {"text": "k1", "matchType": "PHRASE"}, "positionEstimates": {"topOfPageCpcMicros": "4200000"}})
    without = dict(base, adGroupCriterion={"criterionId": "4", "keyword": {"text": "k2", "matchType": "EXACT"}})
    rows = to_rows([{"results": [with_est, without]}])
    rep = {"type": "adspilot.traffic_report", "schema_version": 1, "platform": "google-ads", "account": "123***", "currency": "USD",
           "pulled_at": "2026-09-20T00:00:00", "source": "api", "rows": rows}
    errs = validate(load_schema("traffic-report.schema.json"), rep)
    ok = ("position_estimates.top_of_page_cpc_micros" in q1 and "position_estimates" not in q2 and "LAST_30_DAYS" in q1 and "LAST_30_DAYS" in q2
          and rows[0].get("top_of_page_bid") == 4.2 and "top_of_page_bid" not in rows[1] and rows[0]["avg_cpc"] == 3.0 and not errs)
    print("T4-g api 查询带估计=%s 退路不带=%s 行=%s/%s schema=%s -> %s" % ("position_estimates" in q1, "position_estimates" not in q2,
          rows[0].get("top_of_page_bid"), rows[1].get("top_of_page_bid"), "ok" if not errs else errs[:2], "OK" if ok else "FAIL"))
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1) if argv[i].startswith("--") and not argv[i + 1].startswith("--")}
    apply = "--apply" in argv
    days = int(kv.get("days", 30))
    env = {k: os.environ.get(k, "") for k in NEEDED + ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_LOGIN_CUSTOMER_ID", "GOOGLE_ADS_API_VERSION"]}
    missing = [k for k in NEEDED if not env.get(k)]
    if missing:
        print("missing env: %s (走 CSV 路：report_import.py)" % ", ".join(missing)); return 4
    qs = queries(days)
    query = qs[0]
    if not apply:
        print("dry-run: POST googleads.googleapis.com/%s/customers/%s/googleAds:searchStream\n%s" % (env.get("GOOGLE_ADS_API_VERSION") or "v25", env["GOOGLE_ADS_CUSTOMER_ID"][:3] + "***", query))
        return 0
    try:
        tok = access_token(env)
        try:
            rows = to_rows(search_stream(env, tok, qs[0]))
        except urllib.error.HTTPError as e:
            if e.code != 400:
                raise
            sys.stderr.write("首页出价估计字段被拒（HTTP 400），退回不带它的查询；本轮没有谷歌推荐出价\n")
            rows = to_rows(search_stream(env, tok, qs[1]))
    except Exception as e:  # noqa: BLE001
        print("api failed: %s" % str(e)[:300]); return 3
    rep = {"type": "adspilot.traffic_report", "schema_version": 1, "platform": "google-ads", "account": env["GOOGLE_ADS_CUSTOMER_ID"][:3] + "***",
           "currency": kv.get("currency", "USD"), "pulled_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "source": "api", "rows": rows}
    out = kv.get("out")
    if out:
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        json.dump(rep, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("rows=%d -> %s" % (len(rows), out))
    else:
        print(json.dumps(rep, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
