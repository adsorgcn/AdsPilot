#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
流量插件 Google Ads · 谷歌推荐预算（只读）

预算照谷歌推荐。谷歌的推荐是权威；用户要改自己改（brief.daily_budget、config.caps、user-decisions）；
谷歌没给推荐，主干不编数，交给用户定。

  --new <brief.json> [--new-customer]   建系列前：RecommendationService.GenerateRecommendations，类型 CAMPAIGN_BUDGET，
                                         渠道 SEARCH，带关键词、国家、语言、出价方式与最终网址；新账号带 isNewCustomer。
                                         出价方式跟要建的系列一致：默认尽可能多点击（TARGET_SPEND），brief.bidding 为 manual_cpc 时 MANUAL_CPC
  --campaigns                            已有系列：GAQL FROM recommendation WHERE recommendation.type = 'CAMPAIGN_BUDGET'
  --out <file>                           结果写这里；不写就打到 stdout
  默认 dry-run 只打印请求；--apply 才调接口（只读，不改账号）。

输出：
  --new        {"type":"adspilot.budget_recommendation","recommended": 金额或 null,"options":[金额...],"currency":...}
  --campaigns  {"type":"adspilot.budget_recommendations","campaigns":{"<campaign_id>":{"recommended":金额,"current":金额}}}
  金额是广告账户币种。谷歌数据不够时不会报错，只是不返回推荐：recommended 为 null，退出码仍是 0。
  只给了几档、没标推荐的那一档时，recommended 为 null，options 列出几档，由用户定。

退出码：0 成功；3 调用失败；4 凭据缺失。只用标准库。
2026-09-26 加。同日真实账号核过一轮（CC）：--new 必须带地区 ID；--campaigns 在 v25 只能整个选 campaign_budget_recommendation；
金额是账户币种。改后两条请求都能调通，那次谷歌没给推荐（返回空）。
同日第二轮（2.0.17 之上）：谷歌对 MANUAL_CPC 不给推荐预算；TARGET_SPEND 与 MAXIMIZE_CONVERSIONS 都给（同一组词 84.76 港币，三档 67.81、84.76、101.71），
带不带网址、isNewCustomer 数值一样；请求带了当前预算时谷歌把它也当一档返回。2.0.18 起默认尽可能多点击，几档里剔掉当前预算。
"""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
from gads_api import Client, GadsError  # noqa: E402

MATCH = {"phrase": "PHRASE", "exact": "EXACT", "broad": "BROAD"}
BIDDING = {"maximize_clicks": "TARGET_SPEND", "manual_cpc": "MANUAL_CPC"}   # spec 的出价方式 ⇒ 谷歌的出价策略类型
# v25 里 campaign_budget_recommendation 只能整个选，子字段单选会报 UNRECOGNIZED_FIELD（2026-09-26 真实账号核出）
GAQL_EXISTING = ("SELECT recommendation.resource_name, recommendation.campaign, recommendation.campaign_budget_recommendation "
                 "FROM recommendation WHERE recommendation.type = 'CAMPAIGN_BUDGET'")


def _money(micros):
    try:
        v = int(micros)
    except (TypeError, ValueError):
        return None
    return round(v / 1e6, 2) if v > 0 else None


def _budget_from(cb):
    """一条 CampaignBudgetRecommendation：谷歌标的推荐预算；没标但只有一档就是它；几档都没标 ⇒ None，几档交给用户。
    谷歌会把当前预算也当一档放进 budgetOptions（2026-09-26 真实账号核出），它不是推荐，剔掉。"""
    cur = _money((cb or {}).get("currentBudgetAmountMicros"))
    options = [x for x in (_money(o.get("budgetAmountMicros")) for o in (cb or {}).get("budgetOptions") or []) if x is not None and x != cur]
    rec = _money((cb or {}).get("recommendedBudgetAmountMicros"))
    if rec is None and len(options) == 1:
        rec = options[0]
    return rec, options, cur


def account_currency(client):
    """谷歌返回的金额是广告账户币种；标签取账户的，不取 brief 的。查不到就 None。"""
    try:
        rows = client.search("SELECT customer.currency_code FROM customer")
        return rows[0]["customer"]["currencyCode"] if rows else None
    except Exception:  # noqa: BLE001
        return None


def generate_body(brief, new_customer=False, location_ids=None):
    """建系列前的预算推荐请求：搜索系列要带关键词、国家与地区 ID（只给国家代码会报
    CAMPAIGN_BUDGET_RECOMMENDATION_TYPE_REQUIRES_EITHER_POSITIVE_OR_NEGATIVE_LOCATION_IDS_FOR_SEARCH_CHANNEL）；语言、出价方式、最终网址一并带上。"""
    body = {"recommendationTypes": ["CAMPAIGN_BUDGET"], "advertisingChannelType": "SEARCH",
            "countryCodes": [str(brief.get("country", "US")).upper()], "languageCodes": [str(brief.get("language", "en")).lower()],
            "adGroupInfo": [{"keywords": [{"text": k["text"], "matchType": MATCH.get(k.get("match", "phrase"), "PHRASE")} for k in brief.get("keywords", [])]}],
            "biddingInfo": {"biddingStrategyType": BIDDING.get(str(brief.get("bidding") or "maximize_clicks").lower(), "TARGET_SPEND")}}
    if location_ids:
        body["positiveLocationsIds"] = [int(x) for x in location_ids]
    if brief.get("final_url"):
        body["assetGroupInfo"] = [{"finalUrl": brief["final_url"]}]
    if new_customer:
        body["isNewCustomer"] = True
    return body


def parse_generate(resp):
    """取谷歌标的推荐预算；只有一档就是它；几档都没标推荐 ⇒ recommended 为 null，把几档交给用户。"""
    for r in (resp or {}).get("recommendations") or []:
        cb = r.get("campaignBudgetRecommendation")
        if not cb:
            continue
        rec, options, cur = _budget_from(cb)
        return {"recommended": rec, "options": options, "current": cur}
    return {"recommended": None, "options": [], "current": None}


def parse_existing(rows):
    """已有系列的推荐预算，按 campaign id。"""
    out = {}
    for row in rows or []:
        rec = row.get("recommendation") or {}
        cid = str(rec.get("campaign", "")).rsplit("/", 1)[-1]
        amt, _, cur = _budget_from(rec.get("campaignBudgetRecommendation"))
        if cid and amt is not None:
            out[cid] = {"recommended": amt, "current": cur}
    return out


def run_new(client, brief, new_customer=False):
    """建系列前取谷歌推荐预算：国家 ⇒ 地区 ID，调 recommendations:generate，金额标账户币种。"""
    loc = client.geo_constant(str(brief.get("country", "US")))
    body = generate_body(brief, new_customer=new_customer, location_ids=[str(loc).rsplit("/", 1)[-1]])
    res = parse_generate(client.call("/recommendations:generate", body))
    return dict({"type": "adspilot.budget_recommendation", "currency": account_currency(client), "pulled_at": time.strftime("%Y-%m-%dT%H:%M:%S")}, **res)


def run_campaigns(client):
    """已有系列的谷歌推荐预算，按 campaign id，金额标账户币种。"""
    camps = parse_existing(client.search(GAQL_EXISTING))
    return {"type": "adspilot.budget_recommendations", "currency": account_currency(client), "pulled_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "campaigns": camps}


def selftest():
    brief = json.load(open(os.path.join(ROOT, "tests", "fixtures", "brief.example.json"), encoding="utf-8"))
    body = generate_body(brief, new_customer=True)
    ok = (body["recommendationTypes"] == ["CAMPAIGN_BUDGET"] and body["advertisingChannelType"] == "SEARCH" and body["countryCodes"] == ["US"]
          and body["adGroupInfo"][0]["keywords"][1] == {"text": "buy widget x", "matchType": "EXACT"} and body["isNewCustomer"] is True
          and body["assetGroupInfo"][0]["finalUrl"].startswith("https://") and "isNewCustomer" not in generate_body(brief))
    one = parse_generate({"recommendations": [{"campaignBudgetRecommendation": {"recommendedBudgetAmountMicros": "12500000",
                                                                               "budgetOptions": [{"budgetAmountMicros": "8000000"}, {"budgetAmountMicros": "12500000"}]}}]})
    single = parse_generate({"recommendations": [{"campaignBudgetRecommendation": {"budgetOptions": [{"budgetAmountMicros": "9000000"}]}}]})
    several = parse_generate({"recommendations": [{"campaignBudgetRecommendation": {"budgetOptions": [{"budgetAmountMicros": "8000000"}, {"budgetAmountMicros": "15000000"}]}}]})
    empty = parse_generate({})
    existing = parse_existing([{"recommendation": {"campaign": "customers/1/campaigns/42", "campaignBudgetRecommendation": {
        "currentBudgetAmountMicros": "10000000", "recommendedBudgetAmountMicros": "20000000"}}}, {"recommendation": {"campaign": "customers/1/campaigns/43"}}])
    ok = ok and one["recommended"] == 12.5 and single["recommended"] == 9.0 and several["recommended"] is None and several["options"] == [8.0, 15.0]
    ok = ok and empty["recommended"] is None and existing == {"42": {"recommended": 20.0, "current": 10.0}} and "FROM recommendation" in GAQL_EXISTING
    print("T5-e 请求形状 ok=%s 推荐=%s 单档=%s 多档无推荐=%s/%s 空=%s 已有系列=%s -> %s" % (
        body["advertisingChannelType"] == "SEARCH", one["recommended"], single["recommended"], several["recommended"], several["options"],
        empty["recommended"], existing, "OK" if ok else "FAIL"))
    # T6：2026-09-26 真实账号核出的三处（CC 回报）
    class Fake:
        cid = "1234567890"
        missing = []

        def __init__(self, resp=None, rows=None):
            self.resp, self.rows, self.sent = resp or {}, rows or [], []

        def geo_constant(self, cc):
            return {"US": "geoTargetConstants/2840", "HK": "geoTargetConstants/2344"}[cc.upper()]

        def search(self, q):
            self.sent.append(q)
            if "FROM customer" in q:
                return [{"customer": {"currencyCode": "HKD"}}]
            return self.rows

        def call(self, path, body):
            self.sent.append((path, body))
            return self.resp
    t6 = {}
    try:
        f1 = Fake(resp={"recommendations": [{"campaignBudgetRecommendation": {"recommendedBudgetAmountMicros": "60000000"}}]})
        o1 = run_new(f1, dict(brief, currency="USD"), new_customer=True)
        sent_body = [b for x in f1.sent if isinstance(x, tuple) for b in [x[1]]][0]
        t6["a 带地区ID"] = sent_body.get("positiveLocationsIds") == [2840] and sent_body.get("countryCodes") == ["US"]
        t6["c 币种取账户"] = o1["currency"] == "HKD" and o1["recommended"] == 60.0
        f2 = Fake(rows=[{"recommendation": {"campaign": "customers/1/campaigns/42", "campaignBudgetRecommendation": {
            "currentBudgetAmountMicros": "10000000", "budgetOptions": [{"budgetAmountMicros": "25000000"}]}}}])
        o2 = run_campaigns(f2)
        q = [x for x in f2.sent if isinstance(x, str) and "FROM recommendation" in x][0]
        t6["b 选整个推荐对象"] = ("recommendation.campaign_budget_recommendation " in q + " " and ".current_budget_amount_micros" not in q
                            and o2["campaigns"] == {"42": {"recommended": 25.0, "current": 10.0}} and o2["currency"] == "HKD")
    except Exception as e:  # noqa: BLE001
        t6["error"] = "%s: %s" % (type(e).__name__, str(e)[:120])
    print("T6 %s -> %s" % (t6, "OK" if t6 and all(v is True for v in t6.values()) else "FAIL"))
    ok = ok and bool(t6) and all(v is True for v in t6.values())
    # T7（2.0.18）：c 请求的出价方式跟要建的系列一致，默认尽可能多点击（谷歌对手动 CPC 不给推荐预算，2026-09-26 真实账号核出）；
    # d 请求带了当前预算时谷歌把它也放进几档里，要剔掉（真实账号返回的形状）
    t7 = {}
    try:
        t7["c 默认TARGET_SPEND"] = generate_body(brief)["biddingInfo"] == {"biddingStrategyType": "TARGET_SPEND"}
        t7["c 手动出价跟着brief"] = generate_body(dict(brief, bidding="manual_cpc"))["biddingInfo"] == {"biddingStrategyType": "MANUAL_CPC"}
        opts = [{"budgetAmountMicros": m} for m in ("50000000", "67810000", "84760000", "101707090")]
        real = parse_generate({"recommendations": [{"campaignBudgetRecommendation": {"currentBudgetAmountMicros": "50000000",
                                                                                    "recommendedBudgetAmountMicros": "84760000", "budgetOptions": opts}}]})
        t7["d 剔掉当前预算"] = real == {"recommended": 84.76, "options": [67.81, 84.76, 101.71], "current": 50.0}
        norec = parse_generate({"recommendations": [{"campaignBudgetRecommendation": {"currentBudgetAmountMicros": "50000000",
                                                                                     "budgetOptions": [opts[0], opts[1], opts[3]]}}]})
        t7["d 没标推荐时几档里没有当前预算"] = norec["recommended"] is None and norec["options"] == [67.81, 101.71]
    except Exception as e:  # noqa: BLE001
        t7["error"] = "%s: %s" % (type(e).__name__, str(e)[:120])
    t7ok = bool(t7) and all(v is True for v in t7.values())
    print("T7-c/d %s -> %s" % (t7, "OK" if t7ok else "FAIL"))
    ok = ok and t7ok
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1) if argv[i].startswith("--") and not argv[i + 1].startswith("--")}
    apply = "--apply" in argv
    client = Client()
    if "new" in kv:
        brief = json.load(open(kv["new"], encoding="utf-8"))
        if not apply:
            body = generate_body(brief, new_customer="--new-customer" in argv)
            print(json.dumps({"dry_run": "POST customers/%s/recommendations:generate" % (client.cid[:3] + "***"), "body": body,
                              "note": "调接口时按国家查地区 ID 填 positiveLocationsIds"}, ensure_ascii=False)); return 0
        if client.missing:
            print(json.dumps({"error": "missing env: %s" % ", ".join(client.missing)})); return 4
        try:
            out = run_new(client, brief, new_customer="--new-customer" in argv)
        except GadsError as e:
            print(json.dumps({"error": client.error_summary(e)}, ensure_ascii=False)); return 3
        except ValueError as e:
            print(json.dumps({"error": str(e)}, ensure_ascii=False)); return 3
    elif "--campaigns" in argv:
        if not apply:
            print(json.dumps({"dry_run": "searchStream", "query": GAQL_EXISTING}, ensure_ascii=False)); return 0
        if client.missing:
            print(json.dumps({"error": "missing env: %s" % ", ".join(client.missing)})); return 4
        try:
            out = run_campaigns(client)
        except GadsError as e:
            print(json.dumps({"error": client.error_summary(e)}, ensure_ascii=False)); return 3
    else:
        print(__doc__); return 1
    if kv.get("out"):
        os.makedirs(os.path.dirname(os.path.abspath(kv["out"])), exist_ok=True)
        json.dump(out, open(kv["out"], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
