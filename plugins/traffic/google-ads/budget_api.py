#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
流量插件 Google Ads · 谷歌推荐预算（只读）

预算照谷歌推荐。谷歌的推荐是权威；用户要改自己改（brief.daily_budget、config.caps、user-decisions）；
谷歌没给推荐，主干不编数，交给用户定。

  --new <brief.json> [--new-customer]   建系列前：RecommendationService.GenerateRecommendations，类型 CAMPAIGN_BUDGET，
                                         渠道 SEARCH，带关键词、国家、语言、出价方式与最终网址；新账号带 isNewCustomer
  --campaigns                            已有系列：GAQL FROM recommendation WHERE recommendation.type = 'CAMPAIGN_BUDGET'
  --out <file>                           结果写这里；不写就打到 stdout
  默认 dry-run 只打印请求；--apply 才调接口（只读，不改账号）。

输出：
  --new        {"type":"adspilot.budget_recommendation","recommended": 金额或 null,"options":[金额...],"currency":...}
  --campaigns  {"type":"adspilot.budget_recommendations","campaigns":{"<campaign_id>":{"recommended":金额,"current":金额}}}
  金额是广告账户币种。谷歌数据不够时不会报错，只是不返回推荐：recommended 为 null，退出码仍是 0。
  只给了几档、没标推荐的那一档时，recommended 为 null，options 列出几档，由用户定。

退出码：0 成功；3 调用失败；4 凭据缺失。只用标准库。
2026-09-26 加，还没在真实账号上核过请求形状（接口：POST customers/{id}/recommendations:generate）。
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
GAQL_EXISTING = ("SELECT recommendation.resource_name, recommendation.campaign, "
                 "recommendation.campaign_budget_recommendation.current_budget_amount_micros, "
                 "recommendation.campaign_budget_recommendation.recommended_budget_amount_micros "
                 "FROM recommendation WHERE recommendation.type = 'CAMPAIGN_BUDGET'")


def _money(micros):
    try:
        v = int(micros)
    except (TypeError, ValueError):
        return None
    return round(v / 1e6, 2) if v > 0 else None


def generate_body(brief, new_customer=False):
    """建系列前的预算推荐请求：搜索系列要带关键词与国家；语言、出价方式、最终网址一并带上。"""
    body = {"recommendationTypes": ["CAMPAIGN_BUDGET"], "advertisingChannelType": "SEARCH",
            "countryCodes": [str(brief.get("country", "US")).upper()], "languageCodes": [str(brief.get("language", "en")).lower()],
            "adGroupInfo": [{"keywords": [{"text": k["text"], "matchType": MATCH.get(k.get("match", "phrase"), "PHRASE")} for k in brief.get("keywords", [])]}],
            "biddingInfo": {"biddingStrategyType": "MANUAL_CPC"}}
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
        options = [x for x in (_money(o.get("budgetAmountMicros")) for o in cb.get("budgetOptions") or []) if x is not None]
        rec = _money(cb.get("recommendedBudgetAmountMicros"))
        if rec is None and len(options) == 1:
            rec = options[0]
        return {"recommended": rec, "options": options, "current": _money(cb.get("currentBudgetAmountMicros"))}
    return {"recommended": None, "options": [], "current": None}


def parse_existing(rows):
    """已有系列的推荐预算，按 campaign id。"""
    out = {}
    for row in rows or []:
        rec = row.get("recommendation") or {}
        cid = str(rec.get("campaign", "")).rsplit("/", 1)[-1]
        cb = rec.get("campaignBudgetRecommendation") or {}
        amt = _money(cb.get("recommendedBudgetAmountMicros"))
        if cid and amt is not None:
            out[cid] = {"recommended": amt, "current": _money(cb.get("currentBudgetAmountMicros"))}
    return out


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
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1) if argv[i].startswith("--") and not argv[i + 1].startswith("--")}
    apply = "--apply" in argv
    client = Client()
    if "new" in kv:
        brief = json.load(open(kv["new"], encoding="utf-8"))
        body = generate_body(brief, new_customer="--new-customer" in argv)
        if not apply:
            print(json.dumps({"dry_run": "POST customers/%s/recommendations:generate" % (client.cid[:3] + "***"), "body": body}, ensure_ascii=False)); return 0
        if client.missing:
            print(json.dumps({"error": "missing env: %s" % ", ".join(client.missing)})); return 4
        try:
            res = parse_generate(client.call("/recommendations:generate", body))
        except GadsError as e:
            print(json.dumps({"error": client.error_summary(e)}, ensure_ascii=False)); return 3
        out = dict({"type": "adspilot.budget_recommendation", "currency": brief.get("currency"), "pulled_at": time.strftime("%Y-%m-%dT%H:%M:%S")}, **res)
    elif "--campaigns" in argv:
        if not apply:
            print(json.dumps({"dry_run": "searchStream", "query": GAQL_EXISTING}, ensure_ascii=False)); return 0
        if client.missing:
            print(json.dumps({"error": "missing env: %s" % ", ".join(client.missing)})); return 4
        try:
            camps = parse_existing(client.search(GAQL_EXISTING))
        except GadsError as e:
            print(json.dumps({"error": client.error_summary(e)}, ensure_ascii=False)); return 3
        out = {"type": "adspilot.budget_recommendations", "pulled_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "campaigns": camps}
    else:
        print(__doc__); return 1
    if kv.get("out"):
        os.makedirs(os.path.dirname(os.path.abspath(kv["out"])), exist_ok=True)
        json.dump(out, open(kv["out"], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
