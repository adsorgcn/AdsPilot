#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Ads 插件 · spec 动作（生成投放规格）

输入一个简短的 brief JSON（offer、落地页、关键词、文案），输出 schemas/traffic-spec.schema.json 形状的规格，
硬限从 SOUL 参数与 config.caps 取，逐条核对：只许词组或精确、Search Partners 与 Display 关、只投「位于」目标市场、Manual CPC、
Final URL 在自有域名下。不满足的直接列出并退出码 1。

brief 示例（tests/fixtures/brief.example.json）：
{
  "offer_ref": "cj:100001:12345", "name": "Widget X Review", "country": "US", "language": "en",
  "final_url": "https://example.com/widget-x-review", "keywords": [{"text": "widget x review", "match": "phrase"}],
  "headlines": ["Widget X Review 2026", "Is Widget X Worth It", "Widget X Pros And Cons"],
  "descriptions": ["Hands-on review of Widget X with pricing and alternatives.", "See who it fits and who should skip it."],
  "negatives": ["free", "download"], "daily_budget": 5, "max_cpc": 0.25, "is_new_account": true
}

用法：
  python3 spec.py --brief brief.json [--out spec.json] [--config config/adspilot.json] [--soul soul/default.soul.md]
  python3 spec.py --selftest
"""
import json
import os
import sys
import time
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "core", "judge"))
sys.path.insert(0, os.path.join(ROOT, "core", "selfcheck"))

VALUETRACK = "{lpurl}?c={campaignid}&a={adgroupid}&k={targetid}&n={network}"


def build(brief, soul_params, caps):
    caps = caps or {}
    cpc_cap = float(caps.get("max_cpc", soul_params["cpc"]["cap"]))
    budget_cap = float(caps.get("daily_budget", soul_params["budget"]["daily_cap"]))
    first_day = float(caps.get("first_day_budget", soul_params["budget"]["first_day"]))
    stop_loss = float(caps.get("stop_loss_spend", soul_params["stop_loss"]["test_spend_total"]))
    max_cpc = float(brief.get("max_cpc", soul_params["cpc"]["start"]))
    budget = float(brief.get("daily_budget", first_day))
    host = urlparse(brief["final_url"]).netloc
    spec = {
        "type": "adspilot.traffic_spec", "schema_version": 1, "platform": "google-ads",
        "campaign": {
            "name": brief.get("name") or "AP %s %s" % (brief.get("offer_ref", "offer"), time.strftime("%Y%m%d")),
            "objective": "search",
            "networks": {"search_partners": False, "display": False},
            "geo": {"countries": [brief.get("country", "US").upper()], "presence": "living_in"},
            "language": brief.get("language", "en").lower(),
            "bidding": {"strategy": "manual_cpc", "max_cpc": round(max_cpc, 2)},
            "daily_budget": round(budget, 2),
            "currency": brief.get("currency", "USD"),
            "final_url_domain": host,
            "start_date": brief.get("start_date", time.strftime("%Y-%m-%d")),
            "tracking_template": VALUETRACK,
            "negatives": list(brief.get("negatives", [])),
        },
        "adgroups": [{
            "name": brief.get("adgroup") or (brief.get("name") or "ag") + " AG1",
            "max_cpc": round(max_cpc, 2),
            "final_url": brief["final_url"],
            "keywords": [{"text": k["text"], "match": k.get("match", "phrase")} for k in brief["keywords"]],
            "ads": [{"headlines": brief["headlines"], "descriptions": brief["descriptions"],
                     "path1": brief.get("path1", "")[:15], "path2": brief.get("path2", "")[:15]}],
        }],
        "hard_limits": {"max_cpc_cap": cpc_cap, "daily_budget_cap": budget_cap, "stop_loss_spend": stop_loss},
        "offer_ref": brief.get("offer_ref", ""),
        "sub_id_form": "landing_first_party",
    }
    problems = []
    if max_cpc > cpc_cap:
        problems.append("max_cpc %.2f > cap %.2f" % (max_cpc, cpc_cap))
    if budget > budget_cap:
        problems.append("daily_budget %.2f > cap %.2f" % (budget, budget_cap))
    if brief.get("is_new_account") and budget > first_day:
        problems.append("new account: daily_budget %.2f > first_day %.2f" % (budget, first_day))
    if not brief["final_url"].startswith("https://"):
        problems.append("final_url must be https")
    for bad in ("anrdoezrs.net", "dpbolvw.net", "jdoqocy.com", "kqzyfj.com", "tkqlhce.com", "sjv.io", "awin1.com", "linksynergy.com", "shareasale.com"):
        if bad in host:
            problems.append("final_url is an affiliate link; must be your own landing page")
    for k in brief["keywords"]:
        if k.get("match", "phrase") not in ("phrase", "exact"):
            problems.append("keyword %r match must be phrase or exact" % k["text"])
    for h in brief["headlines"]:
        if len(h) > 30:
            problems.append("headline over 30 chars: %r" % h)
    for d in brief["descriptions"]:
        if len(d) > 90:
            problems.append("description over 90 chars: %r" % d)
    return spec, problems


def selftest():
    from judge import load_soul
    from validate import load_schema, validate
    soul = load_soul("soul/default.soul.md")
    brief = json.load(open(os.path.join(ROOT, "tests", "fixtures", "brief.example.json"), encoding="utf-8"))
    spec, problems = build(brief, soul["params"], {"max_cpc": 0.25, "daily_budget": 10, "first_day_budget": 5, "stop_loss_spend": 300})
    errs = validate(load_schema("traffic-spec.schema.json"), spec)
    bad = dict(brief); bad["max_cpc"] = 0.9; bad["keywords"] = [{"text": "x", "match": "broad"}]
    _, p2 = build(bad, soul["params"], {})
    ok = not problems and not errs and len(p2) >= 2
    print("spec problems=%d schema=%s bad_brief_problems=%d -> %s" % (len(problems), "ok" if not errs else errs[:2], len(p2), "OK" if ok else "FAIL"))
    if problems:
        print(problems)
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1, 2) if argv[i].startswith("--")}
    if "brief" not in kv:
        print(__doc__); return 1
    from judge import load_soul
    from validate import load_schema, validate
    cfg = {}
    cp = kv.get("config", os.path.join(ROOT, "config", "adspilot.json"))
    if os.path.exists(cp):
        cfg = json.load(open(cp, encoding="utf-8"))
    soul = load_soul(kv.get("soul", cfg.get("soul", "soul/default.soul.md")))
    brief = json.load(open(kv["brief"], encoding="utf-8"))
    spec, problems = build(brief, soul["params"], cfg.get("caps"))
    problems += validate(load_schema("traffic-spec.schema.json"), spec)
    if problems:
        print("spec REJECTED:")
        for p in problems:
            print("  - " + p)
        return 1
    if kv.get("out"):
        json.dump(spec, open(kv["out"], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("spec ok -> %s" % kv["out"])
    else:
        print(json.dumps(spec, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
