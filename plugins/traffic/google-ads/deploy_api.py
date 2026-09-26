#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Ads 插件 · deploy 动作的 API 路（用户自有凭据）

三件事，都默认 dry-run，都支持 --validate-only（Google 只校验不落库；建系列时整条系列一批校验），只有 --apply 才真写：
  --spec spec.json            按 schemas/traffic-spec 建搜索系列：预算 → 系列（建好即 PAUSED）→ 地理与语言 → 否定词 → 广告组 → 关键词 → 响应式搜索广告
                              --enable 才把系列置为 ENABLED；不带就留在 PAUSED，让本人在后台看一眼再开
  --actions actions-todo.json 执行主干判断出的动作：campaign.adjust 的 pause / bid_down / budget_up / budget_down，keyword.action 的 pause / bid_down / negative
                              bid_down 看系列真实的出价方式：尽可能多点击 ⇒ 每次点击上限设成动作带的出价上限；手动 CPC ⇒ 广告组出价降 bid_down_pct；
                              尽可能多点击的系列上词级出价不生效，词的 bid_down 跳过
  --enable-campaign <id>      把系列置为 ENABLED（开局 verify 通过后启用）；--pause-campaign <id> 反之
  --remove-campaign <id>      删掉系列（含它独占的预算），测试收尾用
输出：JSON 到 stdout，含 campaign_id、adgroup_ids、applied、mode。
退出码：0 成功；1 输入错误；3 API 失败；4 凭据缺失。
"""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "core", "selfcheck"))
from gads_api import Client, GadsError, redact_id  # noqa: E402

MATCH = {"phrase": "PHRASE", "exact": "EXACT"}


# ------------------------------------------------------------------ 建系列
def build_operations(spec, client, geo_rn, lang_rn, enable=False):
    """把 spec 变成按顺序执行的 mutate 步骤。返回 [(service, op, tag)]，后面的步骤引用前面的 resourceName（用占位符）。"""
    c = spec["campaign"]
    manual = c["bidding"].get("strategy") == "manual_cpc"
    steps = []
    steps.append(("campaignBudgets", {"create": {"name": "%s budget %s" % (c["name"], time.strftime("%Y%m%d%H%M%S")),
                                                 "amountMicros": client.micros(c["daily_budget"]), "deliveryMethod": "STANDARD", "explicitlyShared": False}}, "budget"))
    camp = {"name": c["name"], "status": "ENABLED" if enable else "PAUSED", "advertisingChannelType": "SEARCH",
            "campaignBudget": "{budget}",
            "networkSettings": {"targetGoogleSearch": True, "targetSearchNetwork": False, "targetContentNetwork": False, "targetPartnerSearchNetwork": False},
            "geoTargetTypeSetting": {"positiveGeoTargetType": "PRESENCE", "negativeGeoTargetType": "PRESENCE"},
            "containsEuPoliticalAdvertising": "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING"}
    if manual:
        camp["manualCpc"] = {"enhancedCpcEnabled": False}
    else:   # 尽可能多点击（TARGET_SPEND）：谷歌在预算内自动出价，每次点击上限 = spec 的 max_cpc（出价上限）
        camp["targetSpend"] = {"cpcBidCeilingMicros": client.micros(c["bidding"]["max_cpc"])}
    if c.get("tracking_template"):
        camp["trackingUrlTemplate"] = c["tracking_template"]
    # 不发 start_date：系列建好即 PAUSED，何时开跑由 --enable 或本人在后台决定（v25 REST 已不认 startDate 字段）
    steps.append(("campaigns", {"create": camp}, "campaign"))
    crit = [{"create": {"campaign": "{campaign}", "location": {"geoTargetConstant": geo_rn}}},
            {"create": {"campaign": "{campaign}", "language": {"languageConstant": lang_rn}}}]
    for n in c.get("negatives", []):
        crit.append({"create": {"campaign": "{campaign}", "negative": True, "keyword": {"text": n, "matchType": "BROAD"}}})
    steps.append(("campaignCriteria", crit, "criteria"))
    for i, ag in enumerate(spec["adgroups"]):
        tag = "adgroup%d" % i
        agc = {"name": ag["name"], "campaign": "{campaign}", "status": "ENABLED", "type": "SEARCH_STANDARD"}
        if manual:   # 尽可能多点击时广告组与词的出价不生效，不发
            agc["cpcBidMicros"] = client.micros(ag.get("max_cpc", c["bidding"]["max_cpc"]))
        steps.append(("adGroups", {"create": agc}, tag))
        kws = [{"create": {"adGroup": "{%s}" % tag, "status": "ENABLED", "keyword": {"text": k["text"], "matchType": MATCH[k["match"]]},
                           **({"cpcBidMicros": client.micros(k["max_cpc"])} if manual and k.get("max_cpc") else {})}} for k in ag["keywords"]]
        steps.append(("adGroupCriteria", kws, tag + ".keywords"))
        ads = []
        for ad in ag["ads"]:
            rsa = {"headlines": [{"text": h} for h in ad["headlines"]], "descriptions": [{"text": d} for d in ad["descriptions"]]}
            if ad.get("path1"):
                rsa["path1"] = ad["path1"]
            if ad.get("path2"):
                rsa["path2"] = ad["path2"]
            ads.append({"create": {"adGroup": "{%s}" % tag, "status": "ENABLED", "ad": {"finalUrls": [ag["final_url"]], "responsiveSearchAd": rsa}}})
        steps.append(("adGroupAds", ads, tag + ".ads"))
    return steps


def rollback(client, names):
    """建到一半失败：把已建的系列（连带广告组等）和预算删掉，不留半成品。"""
    done = {}
    for tag, service in (("campaign", "campaigns"), ("budget", "campaignBudgets")):
        rn = names.get(tag)
        if not rn:
            continue
        try:
            client.mutate(service, [{"remove": rn}])
            done[tag] = "removed"
        except GadsError as e:
            done[tag] = client.error_summary(e)
    return done


def _fill(obj, names):
    if isinstance(obj, dict):
        return {k: _fill(v, names) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_fill(x, names) for x in obj]
    if isinstance(obj, str) and obj.startswith("{") and obj.endswith("}") and obj[1:-1] in names:
        return names[obj[1:-1]]
    return obj


OP_KEY = {"campaignBudgets": "campaignBudgetOperation", "campaigns": "campaignOperation", "campaignCriteria": "campaignCriterionOperation",
          "adGroups": "adGroupOperation", "adGroupCriteria": "adGroupCriterionOperation", "adGroupAds": "adGroupAdOperation"}
TEMP_PATH = {"budget": "campaignBudgets", "campaign": "campaigns"}


def validate_steps(client, steps):
    """整条系列放进一个 googleAds:mutate（validateOnly），预算、系列、广告组用临时 ID（负数）互相引用，谷歌连引用一起校验，不落库。
    2026-09-26 真实账号核出：原来逐步校验、给系列填占位预算 campaignBudgets/1，谷歌在引用上就退回 RESOURCE_NOT_FOUND，出价等字段根本没校验到。"""
    names, n = {}, 0
    for _, _, tag in steps:
        if tag in TEMP_PATH or (tag.startswith("adgroup") and "." not in tag):
            n += 1
            names[tag] = "customers/%s/%s/-%d" % (client.cid, TEMP_PATH.get(tag, "adGroups"), n)
    mops = []
    for service, ops, tag in steps:
        for op in (ops if isinstance(ops, list) else [ops]):
            op = _fill(op, names)
            if tag in names and "create" in op:
                op = {"create": dict(op["create"], resourceName=names[tag])}
            mops.append({OP_KEY[service]: op})
    out = {"created": {}, "note": "validate 模式把整条系列放进一批，临时 ID 互相引用，谷歌只校验不落库"}
    try:
        client.call("/googleAds:mutate", {"mutateOperations": mops, "validateOnly": True})
        out["created"] = {tag: "validated(%d)" % len(ops if isinstance(ops, list) else [ops]) for _, ops, tag in steps}
    except GadsError as e:
        out["error"] = {"step": "whole_campaign", "service": "googleAds:mutate", "detail": client.error_summary(e)}
    return out


def run_steps(client, steps, mode):
    """mode: dry | validate | apply。validate 模式整条系列一批校验（见 validate_steps）。"""
    if mode == "validate":
        return validate_steps(client, steps)
    names, out = {}, {"created": {}}
    for service, ops, tag in steps:
        ops = ops if isinstance(ops, list) else [ops]
        filled = _fill(ops, names)
        if mode == "dry":
            out.setdefault("plan", []).append({"service": service, "ops": len(filled), "tag": tag})
            continue
        try:
            res = client.mutate(service, filled)
        except GadsError as e:
            out["error"] = {"step": tag, "service": service, "detail": client.error_summary(e)}
            if mode == "apply":
                out["rollback"] = rollback(client, names)
            return out
        rns = [r.get("resourceName") for r in res.get("results", [])]
        if mode == "apply" and rns and rns[0] and (tag in ("budget", "campaign") or (tag.startswith("adgroup") and "." not in tag)):
            names[tag] = rns[0]
        out["created"][tag] = rns
    return out


# ------------------------------------------------------------------ 执行动作
def campaign_by_name(client, name):
    rows = client.search("SELECT campaign.id, campaign.resource_name, campaign.campaign_budget, campaign.status, campaign.bidding_strategy_type, "
                         "campaign.target_spend.cpc_bid_ceiling_micros FROM campaign WHERE campaign.name = '%s'" % name.replace("'", "\\'"))
    return rows[0]["campaign"] if rows else None


def campaign_by_id(client, cid):
    rows = client.search("SELECT campaign.id, campaign.resource_name, campaign.campaign_budget, campaign.status, campaign.name FROM campaign WHERE campaign.id = %s" % int(cid))
    return rows[0]["campaign"] if rows else None


def keyword_criteria(client, campaign_name, adgroup_name, text):
    q = ("SELECT ad_group_criterion.resource_name, ad_group_criterion.cpc_bid_micros, ad_group_criterion.status, ad_group.resource_name, ad_group.cpc_bid_micros, "
         "campaign.bidding_strategy_type "
         "FROM ad_group_criterion WHERE campaign.name = '%s' AND ad_group.name = '%s' AND ad_group_criterion.type = 'KEYWORD' "
         "AND ad_group_criterion.keyword.text = '%s' AND ad_group_criterion.status != 'REMOVED'") % (
        campaign_name.replace("'", "\\'"), adgroup_name.replace("'", "\\'"), text.replace("'", "\\'"))
    return client.search(q)


def _dig(d, path, value=None):
    """取或设嵌套字段，path 形如 targetSpend.cpcBidCeilingMicros。"""
    ks = path.split(".")
    for k in ks[:-1]:
        d = d[k]
    if value is not None:
        d[ks[-1]] = value
    return d[ks[-1]]


def mutate_bid_retry(client, svc, ops, mode, field="cpcBidMicros"):
    """出价类改动：Google 要求金额是计费单位的整数倍，币种不同单位不同；从 1 万微起，报错就升一档重试。field 可以是嵌套路径。"""
    last = None
    for unit in (10_000, 100_000, 1_000_000):
        fixed = []
        for op in ops:
            u = json.loads(json.dumps(op["update"])); _dig(u, field, client.round_unit(_dig(u, field), unit))
            fixed.append({"update": u, "updateMask": op["updateMask"]})
        try:
            client.mutate(svc, fixed, validate_only=(mode == "validate"))
            return fixed, unit
        except GadsError as e:
            last = e
            if "VALUE_NOT_MULTIPLE_OF_BILLABLE_UNIT" not in e.body:
                raise
    raise last


def apply_actions(client, todo, mode, step_pct=20, bid_down_pct=10, daily_cap=None):
    results = []
    for a in todo.get("actions", []):
        node, target, choice = a["node"], a["target"], a["choice"]
        r = {"node": node, "target": target, "choice": choice, "applied": False}
        try:
            if node == "campaign.adjust":
                camp = campaign_by_name(client, target)
                if not camp:
                    r["error"] = "campaign not found"; results.append(r); continue
                if choice == "pause":
                    ops = [{"update": {"resourceName": camp["resourceName"], "status": "PAUSED"}, "updateMask": "status"}]
                    svc = "campaigns"
                elif choice in ("budget_up", "budget_down"):
                    b = client.search("SELECT campaign_budget.resource_name, campaign_budget.amount_micros FROM campaign_budget WHERE campaign_budget.resource_name = '%s'" % camp["campaignBudget"])
                    cur = int(b[0]["campaignBudget"]["amountMicros"])
                    if a.get("new_budget") is not None:   # 谷歌推荐预算（主干已按用户上限封顶）
                        new = client.micros(a["new_budget"])
                    else:
                        new = int(cur * (1 + step_pct / 100.0)) if choice == "budget_up" else int(cur * (1 - step_pct / 100.0))
                    if daily_cap and new > client.micros(daily_cap):
                        new = client.micros(daily_cap)
                    ops = [{"update": {"resourceName": camp["campaignBudget"], "amountMicros": new}, "updateMask": "amount_micros"}]
                    svc = "campaignBudgets"; r["budget_micros"] = {"from": cur, "to": new}
                elif choice == "bid_down" and camp.get("biddingStrategyType") == "TARGET_SPEND":
                    # 尽可能多点击：降价就是把每次点击上限设成出价上限（动作带的 bid_cap）；已经不高于它就不动。
                    # 报表窗口是 7 天，改完几天里平均点击费用还会高于上限，设成同一个数是幂等的，不会一天天往下砍
                    cur = int((camp.get("targetSpend") or {}).get("cpcBidCeilingMicros") or 0) or None
                    if a.get("bid_cap") is not None:
                        want = client.micros(a["bid_cap"])
                    elif cur:
                        want = int(cur * (1 - bid_down_pct / 100.0))
                    else:
                        r["skipped"] = "尽可能多点击的系列没设每次点击上限，动作也没带出价上限，没法降"; results.append(r); continue
                    ops = [] if (cur and want >= cur) else [{"update": {"resourceName": camp["resourceName"], "targetSpend": {"cpcBidCeilingMicros": want}},
                                                             "updateMask": "target_spend.cpc_bid_ceiling_micros"}]
                    svc = "campaigns"; r["ceiling_micros"] = {"from": cur, "to": want}
                elif choice == "bid_down" and camp.get("biddingStrategyType") not in (None, "MANUAL_CPC"):
                    r["skipped"] = "出价方式是 %s，降价不在这里做" % camp.get("biddingStrategyType"); results.append(r); continue
                elif choice == "bid_down":
                    ags = client.search("SELECT ad_group.resource_name, ad_group.cpc_bid_micros FROM ad_group WHERE campaign.name = '%s' AND ad_group.status = 'ENABLED'" % target.replace("'", "\\'"))
                    ops = [{"update": {"resourceName": g["adGroup"]["resourceName"], "cpcBidMicros": int(int(g["adGroup"]["cpcBidMicros"]) * (1 - bid_down_pct / 100.0))}, "updateMask": "cpc_bid_micros"} for g in ags]
                    svc = "adGroups"
                else:
                    r["skipped"] = "no api mapping for %s" % choice; results.append(r); continue
            elif node == "keyword.action":
                cname, agname, text = (target.split("/", 2) + ["", ""])[:3]
                rows = keyword_criteria(client, cname, agname, text)
                if not rows and choice != "negative":
                    r["error"] = "keyword not found"; results.append(r); continue
                if choice == "pause":
                    ops = [{"update": {"resourceName": rows[0]["adGroupCriterion"]["resourceName"], "status": "PAUSED"}, "updateMask": "status"}]
                    svc = "adGroupCriteria"
                elif choice == "bid_down" and (rows[0].get("campaign") or {}).get("biddingStrategyType") == "TARGET_SPEND":
                    r["skipped"] = "系列是尽可能多点击：词级出价不生效，由系列的每次点击上限管"; results.append(r); continue
                elif choice == "bid_down":
                    crit = rows[0]["adGroupCriterion"]
                    cur = int(crit.get("cpcBidMicros") or rows[0]["adGroup"]["cpcBidMicros"])
                    ops = [{"update": {"resourceName": crit["resourceName"], "cpcBidMicros": int(cur * (1 - bid_down_pct / 100.0))}, "updateMask": "cpc_bid_micros"}]
                    svc = "adGroupCriteria"
                elif choice == "negative":
                    camp = campaign_by_name(client, cname)
                    ops = [{"create": {"campaign": camp["resourceName"], "negative": True, "keyword": {"text": text, "matchType": "PHRASE"}}}]
                    svc = "campaignCriteria"
                else:
                    r["skipped"] = "no api mapping for %s" % choice; results.append(r); continue
            else:
                r["skipped"] = "node not handled by traffic plugin"; results.append(r); continue
            if not ops:
                r["skipped"] = "nothing to change"; results.append(r); continue
            if mode == "dry":
                r["plan"] = {"service": svc, "ops": len(ops)}
            else:
                if choice in ("bid_down", "budget_up", "budget_down"):
                    field = {"campaignBudgets": "amountMicros", "campaigns": "targetSpend.cpcBidCeilingMicros"}.get(svc, "cpcBidMicros")
                    ops, unit = mutate_bid_retry(client, svc, ops, mode, field)
                    r["billable_unit_micros"] = unit
                    if field == "amountMicros":
                        r["budget_micros"]["to"] = ops[0]["update"]["amountMicros"]
                    elif svc == "campaigns":
                        r["ceiling_micros"]["to"] = ops[0]["update"]["targetSpend"]["cpcBidCeilingMicros"]
                else:
                    client.mutate(svc, ops, validate_only=(mode == "validate"))
                r["applied"] = (mode == "apply")
                r["validated"] = (mode == "validate")
        except GadsError as e:
            r["error"] = client.error_summary(e)
        except (KeyError, IndexError, ValueError) as e:
            r["error"] = "%s: %s" % (type(e).__name__, e)
        results.append(r)
    return results


# ------------------------------------------------------------------ 删除
def remove_campaign(client, campaign_id, mode):
    camp = campaign_by_id(client, campaign_id)
    if not camp:
        return {"error": "campaign not found"}
    out = {"campaign": redact_id(campaign_id), "name": camp.get("name")}
    if mode == "dry":
        out["plan"] = "remove campaign then its budget"; return out
    try:
        client.mutate("campaigns", [{"remove": camp["resourceName"]}], validate_only=(mode == "validate"))
        out["campaign_removed"] = (mode == "apply")
        if mode == "apply" and camp.get("campaignBudget"):
            try:
                client.mutate("campaignBudgets", [{"remove": camp["campaignBudget"]}])
                out["budget_removed"] = True
            except GadsError as e:
                out["budget_removed"] = client.error_summary(e)
    except GadsError as e:
        out["error"] = client.error_summary(e)
    return out


def set_campaign_status(client, campaign_id, status, mode):
    camp = campaign_by_id(client, campaign_id)
    if not camp:
        return {"error": "campaign not found"}
    out = {"campaign": redact_id(campaign_id), "name": camp.get("name"), "from": camp.get("status"), "to": status}
    if mode == "dry":
        out["plan"] = "update campaign status"; return out
    try:
        client.mutate("campaigns", [{"update": {"resourceName": camp["resourceName"], "status": status}, "updateMask": "status"}], validate_only=(mode == "validate"))
        out["applied"] = (mode == "apply")
    except GadsError as e:
        out["error"] = client.error_summary(e)
    return out


# ------------------------------------------------------------------ selftest（离线）
def selftest():
    from validate import load_schema, validate
    spec = json.load(open(os.path.join(ROOT, "tests", "fixtures", "spec.example.json"), encoding="utf-8"))
    assert not validate(load_schema("traffic-spec.schema.json"), spec)
    c = Client(env={"GOOGLE_ADS_CUSTOMER_ID": "1234567890"})
    steps = build_operations(spec, c, "geoTargetConstants/2840", "languageConstants/1000")
    tags = [t for _, _, t in steps]
    ok = tags == ["budget", "campaign", "criteria", "adgroup0", "adgroup0.keywords", "adgroup0.ads"]
    camp = steps[1][1]["create"]
    ok = ok and camp["status"] == "PAUSED" and camp["networkSettings"]["targetSearchNetwork"] is False and camp["geoTargetTypeSetting"]["positiveGeoTargetType"] == "PRESENCE"
    ok = ok and steps[0][1]["create"]["amountMicros"] == 5_000_000 and steps[4][1][1]["create"]["keyword"]["matchType"] == "EXACT"
    filled = _fill(steps[3][1], {"campaign": "customers/1/campaigns/9"})
    ok = ok and filled["create"]["campaign"] == "customers/1/campaigns/9"
    out = run_steps(c, steps, "dry")
    ok = ok and len(out["plan"]) == 6
    todo = {"actions": [{"node": "campaign.adjust", "target": "X", "choice": "pause"}]}

    # T5-g：预算动作带 new_budget（谷歌推荐预算，用户上限已封顶）就设成这个数；没带（止损的 budget_down）才按 budget_step_pct
    class Fake:
        micros = staticmethod(Client.micros)

        def search(self, q):
            if "FROM campaign_budget" in q:
                return [{"campaignBudget": {"resourceName": "customers/1/campaignBudgets/7", "amountMicros": "10000000"}}]
            return [{"campaign": {"resourceName": "customers/1/campaigns/9", "campaignBudget": "customers/1/campaignBudgets/7"}}]
    acts = {"actions": [{"node": "campaign.adjust", "target": "C1", "choice": "budget_up", "new_budget": 20.0},
                        {"node": "campaign.adjust", "target": "C2", "choice": "budget_down", "new_budget": 6.0},
                        {"node": "campaign.adjust", "target": "C3", "choice": "budget_down"}]}
    res = apply_actions(Fake(), acts, "dry", step_pct=20, daily_cap=None)
    to = [r_.get("budget_micros", {}).get("to") for r_ in res]
    t5g = to == [20_000_000, 6_000_000, 8_000_000]
    print("T5-g 预算动作 目标=%s -> %s" % (to, "OK" if t5g else "FAIL"))
    ok = ok and t5g
    # T7-b（2.0.18）：尽可能多点击 ⇒ 系列 targetSpend 带每次点击上限，广告组与词不带出价；manual_cpc 照旧
    t7 = {}
    try:
        ts = json.loads(json.dumps(spec)); ts["campaign"]["bidding"] = {"strategy": "maximize_clicks", "max_cpc": 4.56}; ts["adgroups"][0].pop("max_cpc", None)
        st_ts = build_operations(ts, c, "geoTargetConstants/2840", "languageConstants/1000")
        camp_ts, ag_ts = st_ts[1][1]["create"], st_ts[3][1]["create"]
        mc = json.loads(json.dumps(spec)); mc["campaign"]["bidding"] = {"strategy": "manual_cpc", "max_cpc": 0.25}; mc["adgroups"][0]["max_cpc"] = 0.25
        st_mc = build_operations(mc, c, "geoTargetConstants/2840", "languageConstants/1000")
        t7["b 尽可能多点击建法"] = (camp_ts.get("targetSpend") == {"cpcBidCeilingMicros": 4_560_000} and "manualCpc" not in camp_ts and "cpcBidMicros" not in ag_ts
                             and all("cpcBidMicros" not in k["create"] for k in st_ts[4][1]))
        t7["b 手动出价照旧"] = (st_mc[1][1]["create"].get("manualCpc") == {"enhancedCpcEnabled": False} and "targetSpend" not in st_mc[1][1]["create"]
                          and st_mc[3][1]["create"].get("cpcBidMicros") == 250_000)
        # T7-e：降价看系列真实的出价方式。尽可能多点击 ⇒ 每次点击上限设成出价上限（已不高于它就不动，报表窗口滞后几天也不会一天天往下砍）；
        # 手动出价 ⇒ 广告组出价降 bid_down_pct（照旧）；尽可能多点击的系列上词级降价不生效 ⇒ 跳过并写明原因，不算错
        CAMPS = {"TS1": {"biddingStrategyType": "TARGET_SPEND", "targetSpend": {"cpcBidCeilingMicros": "6000000"}},
                 "TS2": {"biddingStrategyType": "TARGET_SPEND", "targetSpend": {"cpcBidCeilingMicros": "4000000"}},
                 "TS3": {"biddingStrategyType": "TARGET_SPEND", "targetSpend": {}},
                 "MC1": {"biddingStrategyType": "MANUAL_CPC"}}

        class FakeBid:
            micros = staticmethod(Client.micros)
            round_unit = staticmethod(Client.round_unit)
            error_summary = staticmethod(Client.error_summary)

            def __init__(self):
                self.sent = []

            def search(self, q):
                name = q.split("campaign.name = '")[1].split("'")[0] if "campaign.name = '" in q else ""
                if "FROM ad_group_criterion" in q:
                    return [{"adGroupCriterion": {"resourceName": "customers/1/adGroupCriteria/5~9", "cpcBidMicros": "3000000"},
                             "adGroup": {"resourceName": "customers/1/adGroups/5", "cpcBidMicros": "2000000"}, "campaign": dict(CAMPS[name])}]
                if "FROM ad_group " in q:
                    return [{"adGroup": {"resourceName": "customers/1/adGroups/5", "cpcBidMicros": "2000000"}}]
                if "FROM campaign " in q:
                    return [{"campaign": dict({"resourceName": "customers/1/campaigns/%s" % name, "campaignBudget": "customers/1/campaignBudgets/7"}, **CAMPS[name])}]
                return []

            def mutate(self, svc, ops, validate_only=False, partial_failure=False):
                self.sent.append((svc, ops))
                return {"results": [{}]}
        acts7 = {"actions": [{"node": "campaign.adjust", "target": t_, "choice": "bid_down", "bid_cap": 4.56} for t_ in ("TS1", "TS2", "TS3", "MC1")]
                 + [{"node": "keyword.action", "target": "TS1/A/k1", "choice": "bid_down"}]}
        fb = FakeBid()
        res7 = {r_["target"]: r_ for r_ in apply_actions(fb, acts7, "validate", bid_down_pct=10)}
        sent = {ops[0]["update"]["resourceName"]: (svc, ops[0]) for svc, ops in fb.sent}
        ceil = lambda n: (sent.get("customers/1/campaigns/%s" % n) or (None, {}))[1]  # noqa: E731
        t7["e 上限高了设成出价上限"] = ceil("TS1").get("update", {}).get("targetSpend") == {"cpcBidCeilingMicros": 4_560_000} and ceil("TS1").get("updateMask") == "target_spend.cpc_bid_ceiling_micros"
        t7["e 上限不高不动"] = "customers/1/campaigns/TS2" not in sent and res7["TS2"].get("skipped") == "nothing to change" and "error" not in res7["TS2"]
        t7["e 没设上限就设上"] = ceil("TS3").get("update", {}).get("targetSpend") == {"cpcBidCeilingMicros": 4_560_000}
        t7["e 手动出价降广告组"] = (sent.get("customers/1/adGroups/5") or (None, {}))[1].get("update", {}).get("cpcBidMicros") == 1_800_000
        kw = res7["TS1/A/k1"]
        t7["e 词级降价跳过"] = "error" not in kw and "尽可能多点击" in str(kw.get("skipped", "")) and not kw.get("validated")
    except Exception as e:  # noqa: BLE001
        t7["error"] = "%s: %s" % (type(e).__name__, str(e)[:160])
    # T7-i：--validate-only 把整条系列放进一个 googleAds:mutate，用临时 ID 互相引用，谷歌连引用一起校验。
    # 之前给系列填的占位预算 campaignBudgets/1 不存在，谷歌在引用上就退回，出价等字段根本没校验到（2026-09-26 真实账号核出）
    try:
        class FakeCall:
            cid = "1234567890"
            micros = staticmethod(Client.micros)
            error_summary = staticmethod(Client.error_summary)

            def __init__(self):
                self.calls = []

            def call(self, path, body=None, method="POST", customer=None):
                self.calls.append((path, body))
                return {}
        fc = FakeCall()
        ts_steps = build_operations(ts, fc, "geoTargetConstants/2840", "languageConstants/1000")
        vo = run_steps(fc, ts_steps, "validate")
        path_, body_ = fc.calls[0] if len(fc.calls) == 1 else (None, {})
        mo = body_.get("mutateOperations") or []
        kinds = [list(o.keys())[0] for o in mo]
        bud_rn = "customers/1234567890/campaignBudgets/-1"
        camp_op = next((o["campaignOperation"]["create"] for o in mo if "campaignOperation" in o), {})
        ag_op = next((o["adGroupOperation"]["create"] for o in mo if "adGroupOperation" in o), {})
        kw_ops = [o["adGroupCriterionOperation"]["create"] for o in mo if "adGroupCriterionOperation" in o]
        t7["i 一批临时ID校验整条系列"] = (path_ == "/googleAds:mutate" and body_.get("validateOnly") is True and kinds[:2] == ["campaignBudgetOperation", "campaignOperation"]
                                    and camp_op.get("campaignBudget") == bud_rn and camp_op.get("targetSpend") == {"cpcBidCeilingMicros": 4_560_000}
                                    and kw_ops and all(k["adGroup"] == ag_op.get("resourceName") for k in kw_ops) and not any(ph in json.dumps(body_) for ph in ('"{budget}"', '"{campaign}"', '"{adgroup'))
                                    and "adGroupAdOperation" in kinds and "error" not in vo)
    except Exception as e:  # noqa: BLE001
        t7["i error"] = "%s: %s" % (type(e).__name__, str(e)[:160])
    t7ok = bool(t7) and all(v is True for v in t7.values())
    print("T7-b/e/i %s -> %s" % (t7, "OK" if t7ok else "FAIL"))
    ok = ok and t7ok
    print("steps=%s dry_plan=%d -> %s" % (tags, len(out["plan"]), "OK" if ok else "FAIL"))
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1) if argv[i].startswith("--") and not argv[i + 1].startswith("--")}
    mode = "apply" if "--apply" in argv else ("validate" if "--validate-only" in argv else "dry")
    client = Client()
    if client.missing and mode != "dry":
        print(json.dumps({"error": "missing env: %s" % ", ".join(client.missing), "mode": mode})); return 4
    if "spec" in kv:
        from validate import load_schema, validate
        spec = json.load(open(kv["spec"], encoding="utf-8"))
        errs = validate(load_schema("traffic-spec.schema.json"), spec)
        if errs:
            print(json.dumps({"error": "spec invalid", "detail": errs[:5]})); return 1
        if mode == "dry":
            geo, lang = "geoTargetConstants/<lookup>", "languageConstants/<lookup>"
        else:
            try:
                geo = client.geo_constant(spec["campaign"]["geo"]["countries"][0]); lang = client.language_constant(spec["campaign"]["language"])
            except (GadsError, ValueError) as e:
                print(json.dumps({"error": "constant lookup failed", "detail": str(e)[:300]})); return 3
        steps = build_operations(spec, client, geo, lang, enable=("--enable" in argv))
        out = run_steps(client, steps, mode)
        out.update({"mode": mode, "applied": mode == "apply" and "error" not in out, "customer": redact_id(client.cid)})
        if mode == "apply" and "campaign" in out["created"]:
            out["campaign_id"] = out["created"]["campaign"][0].split("/")[-1]
            out["adgroup_ids"] = [v[0].split("/")[-1] for k, v in out["created"].items() if k.startswith("adgroup") and "." not in k and v]
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 3 if "error" in out else 0
    if "actions" in kv:
        todo = json.load(open(kv["actions"], encoding="utf-8"))
        cfg = {}
        cp = kv.get("config", os.path.join(ROOT, "config", "adspilot.json"))
        if os.path.exists(cp):
            cfg = json.load(open(cp, encoding="utf-8"))
        caps = cfg.get("caps") or {}
        # 日预算上限：主干算好的有效值（config.caps 为 null 时是 SOUL 默认值折算后）优先；caps 里是 null 就不能当成「没有上限」
        daily_cap = (todo.get("caps_effective") or {}).get("daily_budget")
        if daily_cap is None:
            daily_cap = caps.get("daily_budget")
        res = apply_actions(client, todo, mode, step_pct=float(caps.get("budget_step_pct") or 20), daily_cap=daily_cap)
        print(json.dumps({"mode": mode, "results": res}, ensure_ascii=False, indent=2))
        return 3 if any("error" in r for r in res) else 0
    if "remove-campaign" in kv:
        out = remove_campaign(client, kv["remove-campaign"], mode)
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 3 if "error" in out else 0
    for flag, status in (("enable-campaign", "ENABLED"), ("pause-campaign", "PAUSED")):
        if flag in kv:
            out = set_campaign_status(client, kv[flag], status, mode)
            print(json.dumps(out, ensure_ascii=False, indent=2))
            return 3 if "error" in out else 0
    print(__doc__); return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
