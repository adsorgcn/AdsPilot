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


def _cap(caps, key, fallback):
    v = (caps or {}).get(key)
    return float(v) if v is not None else float(fallback)


def _r2(x):
    return round(float(x), 2) if x is not None else None


def build(brief, soul_params, caps):
    """soul_params 是 load_soul(path, cfg) 折算后的（广告账户币种）；caps 是 config.caps（广告账户币种，null=用 SOUL 默认）。
    出价上限 = min(brief.bid_cap（开局从选中 offer 带来）, caps.max_cpc)；两个都没有用谷歌推荐出价 brief.google_bid；
    出价 = brief.max_cpc，没写用 brief.google_bid。都没有就报问题、出价留空（spec 结构不合格，建不了），不拿常数顶。"""
    caps = caps or {}
    cands = [float(x) for x in (brief.get("bid_cap"), caps.get("max_cpc")) if x is not None]
    gb = float(brief["google_bid"]) if brief.get("google_bid") is not None else None
    cpc_cap = min(cands) if cands else gb
    # 预算：用户写的 brief.daily_budget；没写用谷歌推荐 brief.google_budget，用户在 caps 里设的上限封顶；都没有就交给用户定
    budget_cap = float(caps["daily_budget"]) if caps.get("daily_budget") is not None else None
    first_day = float(caps["first_day_budget"]) if caps.get("first_day_budget") is not None else None
    stop_loss = _cap(caps, "stop_loss_spend", soul_params["stop_loss"]["test_spend_total"])
    max_cpc = float(brief["max_cpc"]) if brief.get("max_cpc") is not None else gb
    if cpc_cap is None:
        cpc_cap = max_cpc   # 没有 offer 上限、用户上限与谷歌出价：上限就是用户自己写的出价，不往上加
    if brief.get("daily_budget") is not None:
        budget = float(brief["daily_budget"])
    elif brief.get("google_budget") is not None:
        lims = [x for x in (budget_cap, first_day if brief.get("is_new_account") else None) if x is not None]
        budget = min([float(brief["google_budget"])] + lims)
    else:
        budget = None
    host = urlparse(brief["final_url"]).netloc
    spec = {
        "type": "adspilot.traffic_spec", "schema_version": 1, "platform": "google-ads",
        "campaign": {
            "name": brief.get("name") or "AP %s %s" % (brief.get("offer_ref", "offer"), time.strftime("%Y%m%d")),
            "objective": "search",
            "networks": {"search_partners": False, "display": False},
            "geo": {"countries": [brief.get("country", "US").upper()], "presence": "living_in"},
            "language": brief.get("language", "en").lower(),
            "bidding": {"strategy": "manual_cpc", "max_cpc": _r2(max_cpc)},
            "daily_budget": _r2(budget),
            "currency": brief.get("currency", "USD"),
            "final_url_domain": host,
            "start_date": brief.get("start_date", time.strftime("%Y-%m-%d")),
            "tracking_template": VALUETRACK,
            "negatives": list(brief.get("negatives", [])),
        },
        "adgroups": [{
            "name": brief.get("adgroup") or (brief.get("name") or "ag") + " AG1",
            "max_cpc": _r2(max_cpc),
            "final_url": brief["final_url"],
            "keywords": [{"text": k["text"], "match": k.get("match", "phrase")} for k in brief["keywords"]],
            "ads": [{"headlines": brief["headlines"], "descriptions": brief["descriptions"],
                     "path1": brief.get("path1", "")[:15], "path2": brief.get("path2", "")[:15]}],
        }],
        "hard_limits": {"max_cpc_cap": _r2(cpc_cap), "daily_budget_cap": _r2(budget_cap if budget_cap is not None else budget), "stop_loss_spend": stop_loss},
        "offer_ref": brief.get("offer_ref", ""),
        "sub_id_form": "landing_first_party",
    }
    problems = []
    if max_cpc is None:
        problems.append("缺出价：brief 没有 max_cpc，也没有谷歌推荐出价 google_bid（关键词插件的首页出价）；不拿常数顶")
    elif max_cpc > cpc_cap:
        problems.append("max_cpc %.2f > cap %.2f" % (max_cpc, cpc_cap))
    if budget is None:
        problems.append("缺预算：brief 没写 daily_budget，谷歌也没给推荐预算；请你定")
    elif budget_cap is not None and budget > budget_cap:
        problems.append("daily_budget %.2f > cap %.2f" % (budget, budget_cap))
    if budget is not None and brief.get("is_new_account") and first_day is not None and budget > first_day:
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
    # 2.0.15 起 SOUL 没有出价常数：坏 brief 显式带上 offer 的出价上限 0.25，仍然要报「出价超上限」
    bad = dict(brief); bad["max_cpc"] = 0.9; bad["bid_cap"] = 0.25; bad["keywords"] = [{"text": "x", "match": "broad"}]
    _, p2 = build(bad, soul["params"], {})
    # 港币账户：出价上限来自 offer 的 bid_cap（4.56），3.79 的词能建；caps 全 null 时预算上限走 SOUL 折算值
    hk = {"currency": "HKD", "fx": {"USD": 1.0, "HKD": 7.8}}
    soul_hk = load_soul("soul/default.soul.md", hk)
    b3 = dict(brief); b3.update({"max_cpc": 3.79, "bid_cap": 4.56, "daily_budget": 5})
    _, p3 = build(b3, soul_hk["params"], {"max_cpc": None, "daily_budget": None, "first_day_budget": None, "stop_loss_spend": None})
    b4 = dict(b3); b4["max_cpc"] = 4.8
    _, p4 = build(b4, soul_hk["params"], {"max_cpc": None})
    # T4-f：没写出价 ⇒ 用谷歌推荐出价（brief.google_bid）；也没有 ⇒ 报问题，不拿常数顶；只有谷歌出价时它就是出价上限
    b5 = {k: v for k, v in brief.items() if k not in ("max_cpc", "bid_cap")}
    s5, p5 = build(b5, soul["params"], {})
    b6 = dict(b5, google_bid=1.2)
    s6, p6 = build(b6, soul["params"], {})
    b7 = dict(b6, max_cpc=1.5)
    _, p7 = build(b7, soul["params"], {})
    t4f = (any("出价" in x for x in p5) and not p6 and s6["campaign"]["bidding"]["max_cpc"] == 1.2 and s6["hard_limits"]["max_cpc_cap"] == 1.2
           and any("max_cpc" in x for x in p7) and "cpc" not in soul["params"])
    print("T4-f 无出价参照=%s 谷歌1.2⇒出价%s上限%s 出价1.5超谷歌=%s -> %s" % (p5, s6["campaign"]["bidding"]["max_cpc"], s6["hard_limits"]["max_cpc_cap"],
                                                                     any("max_cpc" in x for x in p7), "OK" if t4f else "FAIL"))
    # T5-d：预算 = 用户写的 brief.daily_budget；没写用谷歌推荐 brief.google_budget（用户上限封顶）；都没有 ⇒ 报问题，交给用户定
    base5 = {k: v for k, v in brief.items() if k not in ("daily_budget", "is_new_account")}
    s8, p8 = build(dict(base5, google_budget=12), soul["params"], {})
    s9, p9 = build(dict(base5, google_budget=12), soul["params"], {"daily_budget": 10})
    _, p10 = build(base5, soul["params"], {})
    _, p11 = build(dict(base5, daily_budget=15), soul["params"], {"daily_budget": 10})
    s12, p12 = build(dict(base5, google_budget=60, is_new_account=True), soul["params"], {})
    t5d = (not p8 and s8["campaign"]["daily_budget"] == 12 and not p9 and s9["campaign"]["daily_budget"] == 10 and any("预算" in x for x in p10)
           and any("daily_budget" in x for x in p11) and not p12 and s12["campaign"]["daily_budget"] == 60 and "budget" not in soul["params"])
    print("T5-d 谷歌推荐12⇒%s 用户上限10⇒%s 都没有=%s 用户写15超上限=%s 新账号推荐60⇒%s %s -> %s" % (
        s8["campaign"]["daily_budget"], s9["campaign"]["daily_budget"], p10, bool(p11), s12["campaign"]["daily_budget"], p12, "OK" if t5d else "FAIL"))
    ok = not problems and not errs and len(p2) >= 2 and not p3 and any("max_cpc" in x for x in p4) and t4f and t5d
    print("spec problems=%d schema=%s bad_brief_problems=%d hkd_bidcap_ok=%s hkd_over_bidcap=%s -> %s" % (
        len(problems), "ok" if not errs else errs[:2], len(p2), not p3, any("max_cpc" in x for x in p4), "OK" if ok else "FAIL"))
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
    soul = load_soul(kv.get("soul", cfg.get("soul", "soul/default.soul.md")), cfg)
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
