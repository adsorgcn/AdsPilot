#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Ads 插件 · deploy 动作的 API 路（用户自有凭据）

三件事，都默认 dry-run，都支持 --validate-only（Google 只校验不落库），只有 --apply 才真写：
  --spec spec.json            按 schemas/traffic-spec 建搜索系列：预算 → 系列（建好即 PAUSED）→ 地理与语言 → 否定词 → 广告组 → 关键词 → 响应式搜索广告
                              --enable 才把系列置为 ENABLED；不带就留在 PAUSED，让本人在后台看一眼再开
  --actions actions-todo.json 执行主干判断出的动作：campaign.adjust 的 pause / bid_down / budget_up / budget_down，keyword.action 的 pause / bid_down / negative
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
    steps = []
    steps.append(("campaignBudgets", {"create": {"name": "%s budget %s" % (c["name"], time.strftime("%Y%m%d%H%M%S")),
                                                 "amountMicros": client.micros(c["daily_budget"]), "deliveryMethod": "STANDARD", "explicitlyShared": False}}, "budget"))
    camp = {"name": c["name"], "status": "ENABLED" if enable else "PAUSED", "advertisingChannelType": "SEARCH",
            "manualCpc": {"enhancedCpcEnabled": False}, "campaignBudget": "{budget}",
            "networkSettings": {"targetGoogleSearch": True, "targetSearchNetwork": False, "targetContentNetwork": False, "targetPartnerSearchNetwork": False},
            "geoTargetTypeSetting": {"positiveGeoTargetType": "PRESENCE", "negativeGeoTargetType": "PRESENCE"},
            "containsEuPoliticalAdvertising": "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING"}
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
        steps.append(("adGroups", {"create": {"name": ag["name"], "campaign": "{campaign}", "status": "ENABLED", "type": "SEARCH_STANDARD",
                                              "cpcBidMicros": client.micros(ag.get("max_cpc", c["bidding"]["max_cpc"]))}}, tag))
        kws = [{"create": {"adGroup": "{%s}" % tag, "status": "ENABLED", "keyword": {"text": k["text"], "matchType": MATCH[k["match"]]},
                           **({"cpcBidMicros": client.micros(k["max_cpc"])} if k.get("max_cpc") else {})}} for k in ag["keywords"]]
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


def run_steps(client, steps, mode):
    """mode: dry | validate | apply。validate 模式只校验预算与系列两步（后面的步骤要引用真实 resourceName）。"""
    names, out = {}, {"created": {}}
    for service, ops, tag in steps:
        ops = ops if isinstance(ops, list) else [ops]
        if mode == "validate":
            ph = {"budget": "customers/%s/campaignBudgets/1" % client.cid, "campaign": "customers/%s/campaigns/1" % client.cid}
            for i in range(20):
                ph["adgroup%d" % i] = "customers/%s/adGroups/1" % client.cid
            filled = _fill(ops, {**ph, **names})
        else:
            filled = _fill(ops, names)
        if mode == "dry":
            out.setdefault("plan", []).append({"service": service, "ops": len(filled), "tag": tag})
            continue
        try:
            res = client.mutate(service, filled, validate_only=(mode == "validate"))
        except GadsError as e:
            out["error"] = {"step": tag, "service": service, "detail": client.error_summary(e)}
            if mode == "apply":
                out["rollback"] = rollback(client, names)
            return out
        rns = [r.get("resourceName") for r in res.get("results", [])]
        if mode == "apply" and rns and rns[0] and (tag in ("budget", "campaign") or (tag.startswith("adgroup") and "." not in tag)):
            names[tag] = rns[0]
        out["created"][tag] = rns if mode == "apply" else "validated(%d)" % len(filled)
        if mode == "validate" and tag == "campaign":
            out["note"] = "validate 模式只校验预算与系列两步；后面的步骤要引用真实的系列 resourceName，只能在 apply 时校验"
            break
    return out


# ------------------------------------------------------------------ 执行动作
def campaign_by_name(client, name):
    rows = client.search("SELECT campaign.id, campaign.resource_name, campaign.campaign_budget, campaign.status FROM campaign WHERE campaign.name = '%s'" % name.replace("'", "\\'"))
    return rows[0]["campaign"] if rows else None


def campaign_by_id(client, cid):
    rows = client.search("SELECT campaign.id, campaign.resource_name, campaign.campaign_budget, campaign.status, campaign.name FROM campaign WHERE campaign.id = %s" % int(cid))
    return rows[0]["campaign"] if rows else None


def keyword_criteria(client, campaign_name, adgroup_name, text):
    q = ("SELECT ad_group_criterion.resource_name, ad_group_criterion.cpc_bid_micros, ad_group_criterion.status, ad_group.resource_name, ad_group.cpc_bid_micros "
         "FROM ad_group_criterion WHERE campaign.name = '%s' AND ad_group.name = '%s' AND ad_group_criterion.type = 'KEYWORD' "
         "AND ad_group_criterion.keyword.text = '%s' AND ad_group_criterion.status != 'REMOVED'") % (
        campaign_name.replace("'", "\\'"), adgroup_name.replace("'", "\\'"), text.replace("'", "\\'"))
    return client.search(q)


def mutate_bid_retry(client, svc, ops, mode, field="cpcBidMicros"):
    """出价类改动：Google 要求金额是计费单位的整数倍，币种不同单位不同；从 1 万微起，报错就升一档重试。"""
    last = None
    for unit in (10_000, 100_000, 1_000_000):
        fixed = []
        for op in ops:
            u = dict(op["update"]); u[field] = client.round_unit(u[field], unit)
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
                    new = int(cur * (1 + step_pct / 100.0)) if choice == "budget_up" else int(cur * (1 - step_pct / 100.0))
                    if daily_cap and new > client.micros(daily_cap):
                        new = client.micros(daily_cap)
                    ops = [{"update": {"resourceName": camp["campaignBudget"], "amountMicros": new}, "updateMask": "amount_micros"}]
                    svc = "campaignBudgets"; r["budget_micros"] = {"from": cur, "to": new}
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
                    field = "amountMicros" if svc == "campaignBudgets" else "cpcBidMicros"
                    ops, unit = mutate_bid_retry(client, svc, ops, mode, field)
                    r["billable_unit_micros"] = unit
                    if field == "amountMicros":
                        r["budget_micros"]["to"] = ops[0]["update"]["amountMicros"]
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
        res = apply_actions(client, todo, mode, step_pct=float(caps.get("budget_step_pct", 20)), daily_cap=caps.get("daily_budget"))
        print(json.dumps({"mode": mode, "results": res}, ensure_ascii=False, indent=2))
        return 3 if any("error" in r for r in res) else 0
    if "remove-campaign" in kv:
        out = remove_campaign(client, kv["remove-campaign"], mode)
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 3 if "error" in out else 0
    print(__doc__); return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
