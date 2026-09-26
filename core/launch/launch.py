#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
开局：三把钥匙进，一个真域名上的落地页加一条真系列出，中间没有人。

七步，按顺序跑，每步幂等，状态记在 runs/launch/launch.json：
  deploy    建落地位（plugins/deploy 的 setup + 隐私条款页）
  offers    拉 offer、按 SOUL 判 offer.select、写 offer 表；--pick 指定
  page      按 core/lp 模板填内容、lp_check、判 lp.publish、推到落地位
  campaign  brief -> spec、判 campaign.launch、建系列（建好即暂停）
  verify    真点一次：页面 -> /go -> /export -> 账本
  go        启用系列，交给日常循环
  teardown  拆：删系列；--all 连落地位一起拆（测试收尾）

用法：
  python3 core/launch/launch.py deploy --host reviews.example.com --site-name "Widget Reviews" --contact you@example.com --apply
  python3 core/launch/launch.py offers [--pick cj:100001:12345] [--apply]
  python3 core/launch/launch.py page --content site/widget-x.content.json [--slug widget-x-review] --apply
  python3 core/launch/launch.py campaign --brief site/widget-x.brief.json --apply
  python3 core/launch/launch.py verify
  python3 core/launch/launch.py go --apply
  python3 core/launch/launch.py teardown [--all] --apply
  python3 core/launch/launch.py status
  python3 core/launch/launch.py --selftest
默认 dry-run（只算不写外部）；--apply 才真做。退出码：0 成功；2 判断不放行（M3 以上或 hold/fix）；3 外部失败；4 缺东西。
"""
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
for p in ("core/judge", "core/ledger", "core/selfcheck", "core/lp", "plugins/traffic/google-ads"):
    sys.path.insert(0, os.path.join(ROOT, p))
import judge as J  # noqa: E402
import subid  # noqa: E402
import lp_check  # noqa: E402
from validate import load_schema, validate  # noqa: E402

STATE = os.path.join(ROOT, "runs", "launch", "launch.json")
TEMPLATE = os.path.join(ROOT, "core", "lp", "templates", "landing.html")


# ------------------------------------------------------------------ 公用
def load_cfg(path=None):
    p = path or os.path.join(ROOT, "config", "adspilot.json")
    if not os.path.exists(p):
        p = os.path.join(ROOT, "config", "adspilot.example.json")
    return json.load(open(p, encoding="utf-8"))


def state():
    if os.path.exists(STATE):
        try:
            return json.load(open(STATE, encoding="utf-8"))
        except ValueError:
            return {}
    return {}


def save(st):
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    st["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    json.dump(st, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


def run(script, args, timeout=300):
    out = subprocess.run([sys.executable, os.path.join(ROOT, script)] + args, capture_output=True, text=True, timeout=timeout, cwd=ROOT)
    txt = out.stdout.strip()
    try:
        j = json.loads(txt) if txt.startswith("{") or txt.startswith("[") else {}
    except ValueError:
        j = {}
    return out.returncode, j, txt, out.stderr.strip()


def plugin(cfg, kind):
    name = (cfg.get(kind) or {}).get("plugin") or {"deploy": "cloudflare", "traffic": "google-ads", "affiliate": "cj", "keywords": "google-ads"}[kind]
    d = os.path.join("plugins", kind, name)
    m = json.load(open(os.path.join(ROOT, d, "manifest.json"), encoding="utf-8"))
    return d, m


def decide(cfg, soul, node, st_, choices, evidence, user=None):
    """user：用户明确说的选项。有就照做，判断照算，作为建议（advice）带出。"""
    choices = [{"id": c} if isinstance(c, str) else c for c in choices]
    if user:
        st_ = dict(st_ or {}, user_decision=user)
    resp = J.judge(node, st_, choices, cfg=cfg, soul=soul, evidence=evidence, req_id="launch-%s-%d" % (node, int(time.time())))
    return resp, J.executes(resp)


def judged(resp):
    """输出里的判断一栏：谁拿主意、做不做、判断自己的意见。"""
    j = {"choice": resp["choice"], "decided_by": resp.get("decided_by"), "executes": resp.get("executes"), "mode": resp["mode_local"], "reason": resp["judge"]["reason"]}
    if resp.get("advice"):
        j["advice"] = resp["advice"]
    if resp.get("boundary_hit"):
        j["boundary_hit"] = resp["boundary_hit"]
    return j


def fill(html, values):
    for k, v in values.items():
        html = html.replace("{{%s}}" % k, str(v))
    return html


def out(o, rc=0):
    print(json.dumps(o, ensure_ascii=False, indent=2))
    return rc


# ------------------------------------------------------------------ 步骤
def step_deploy(cfg, kv, apply):
    st = state()
    host = kv.get("host") or st.get("host") or (cfg.get("deploy") or {}).get("host")
    if not host:
        return out({"error": "--host 必填：自有域名下的一个主机名，例如 reviews.example.com"}, 4)
    d, m = plugin(cfg, "deploy")
    rc, j, txt, err = run(os.path.join(d, m["actions"]["setup"]), ["--host", host] + (["--apply"] if apply else []))
    res = {"step": "deploy", "mode": "apply" if apply else "dry", "setup": j or txt[-400:], "stderr": err[-200:]}
    if rc:
        return out(res, rc)
    if apply:
        rc2, j2, txt2, _ = run(os.path.join(d, m["actions"]["publish"]), ["--site", "--site-name", kv.get("site-name", host), "--contact", kv.get("contact", "contact@" + host)])
        res["site_pages"] = j2 or txt2[-300:]
        if rc2:
            return out(res, rc2)
        st.update({"host": host, "base_url": "https://" + host, "site_name": kv.get("site-name", host), "contact": kv.get("contact", "contact@" + host), "deployed_at": time.strftime("%Y-%m-%dT%H:%M:%S")})
        save(st)
    return out(res, 0)


def keyword_data(cfg, rows, kv):
    """给候选 offer 查词：种子是商家名（去掉 Affiliate Program 之类），加商家网址。返回 (currency, {offer_ref: rows}, errors)。"""
    sys.path.insert(0, os.path.join(ROOT, "plugins", "keywords", "google-ads"))
    import planner  # noqa: E402
    d, m = plugin(cfg, "keywords")
    batch = [{"id": r["offer_ref"], "seed": [planner.clean_brand(r.get("advertiser", ""))], "url": r.get("program_url") or None} for r in rows]
    bp = os.path.join(ROOT, "runs", "launch", "kw-seeds.json")
    op = os.path.join(ROOT, "runs", "launch", "keywords.json")
    json.dump(batch, open(bp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    rc, j, txt, err = run(os.path.join(d, m["actions"]["suggest"]), ["suggest", "--batch", bp, "--country", kv.get("country", "US"), "--language", kv.get("language", "en"),
                                                                     "--limit", kv.get("kw-limit", "100"), "--out", op], timeout=600)
    if rc:
        return None, {}, {"_": "keywords 动作退出码 %d: %s %s" % (rc, txt[-200:], err[-200:])}
    k = json.load(open(op, encoding="utf-8"))
    return k.get("currency"), k.get("results") or {}, k.get("errors") or {}


def step_offers(cfg, kv, apply):
    st = state()
    soul = J.load_soul(cfg.get("soul", "soul/default.soul.md"), cfg)
    p = soul["params"]
    os.makedirs(os.path.join(ROOT, "runs", "launch"), exist_ok=True)
    d, m = plugin(cfg, "affiliate")
    offers_path = os.path.join(ROOT, "runs", "launch", "offers.json")
    if kv.get("offers-json"):
        rows = json.load(open(kv["offers-json"], encoding="utf-8"))
    else:
        rc, _, txt, err = run(os.path.join(d, m["actions"]["offers"]), ["--with-links", "--out", offers_path])
        if rc:
            return out({"step": "offers", "error": "offers 动作退出码 %d: %s %s" % (rc, txt[-200:], err[-200:])}, 4 if rc == 4 else 3)
        rows = json.load(open(offers_path, encoding="utf-8"))
    rows = [r for r in rows if r.get("click_url")]
    user = kv.get("pick") or kv.get("user")
    # 查词有配额：只算 EPC 靠前的 N 家（--top，默认 10）；用户指定的那家不在前 N 也一起算
    top = sorted(rows, key=lambda r: max(float(r.get("epc") or 0), float(r.get("epc_3m") or 0)), reverse=True)[:int(kv.get("top", 10))]
    if user and user not in [r["offer_ref"] for r in top]:
        top += [r for r in rows if r["offer_ref"] == user]
    if user and user not in [r["offer_ref"] for r in top]:
        return out({"step": "offers", "error": "用户指定的 %s 不在联盟已加入且有点击链接的 offer 里" % user}, 4)
    rows = top
    kw_errors = {}
    if not all(r.get("keywords") for r in rows):
        cur, kw, kw_errors = keyword_data(cfg, rows, kv)
        if cur and cfg.get("currency") and cur != cfg["currency"]:
            return out({"step": "offers", "error": "config.currency=%s 与广告账户币种 %s 不一致，改 config.currency" % (cfg["currency"], cur)}, 4)
        fx_table = cfg.get("fx") or {}
        fx = fx_table.get(cur) if cur else None
        if cur and fx is None:
            return out({"step": "offers", "error": "config.fx 里没有 %s 的汇率（每 1 美元多少 %s）" % (cur, cur)}, 4)
        for r in rows:
            r["keywords"] = kw.get(r["offer_ref"]) or []
            r["fx"] = float(fx or 1.0) / float(fx_table.get(r.get("epc_currency", "USD"), 1.0) or 1.0)
            r["kw_currency"] = cur
    econ = []
    for r in rows:
        e = J.offer_economics(r, p)
        econ.append({"offer_ref": r["offer_ref"], "advertiser": r.get("advertiser"), "epc_7d": r.get("epc"), "epc_3m": r.get("epc_3m"),
                     "earn_per_click": e.get("epc_per_click"), "currency": r.get("kw_currency"), "bid_below_epc": e["ok"], "why": e["why"],
                     "passing_words": len(e.get("passing") or []), "best": e.get("best"), "ppc_allowed": r.get("ppc_allowed"),
                     "brand_bidding_allowed": r.get("brand_bidding_allowed")})
    choices = [{"id": r["offer_ref"], "data": r} for r in rows] + [{"id": "none"}]
    resp, ok = decide(cfg, soul, "offer.select", {"offers_total": len(rows), "market": kv.get("country", "US")}, choices,
                      ["runs/launch/offers.json", "runs/launch/keywords.json"], user=user)
    res = {"step": "offers", "checked": len(rows), "rule_1": "词的出价(%s) < 每次点击赚的钱(EPC÷100，%s)" % (p["offer"].get("bid_metric"), p["offer"].get("epc_basis")),
           "economics": econ, "keyword_errors": kw_errors, "judge": judged(resp)}
    pick = resp["choice"] if ok and resp["choice"] != "none" else ""
    if not pick:
        passed = [e["advertiser"] for e in econ if e["bid_below_epc"]]
        res["note"] = ("建议：账过了的有 %s；PPC 政策没核（ppc_allowed 为 null）。用户定一家就 --pick <offer_ref>，照做；或 Agent 读完 Program Terms 写进 data/inbox/cj-offer-policy.json 再跑，由判断选" % "、".join(passed)) \
            if passed else "建议：前 %d 家没有一家账算得过来（词的出价都不低于每次点击赚的钱）。用户要投哪家就 --pick <offer_ref>，照做" % len(rows)
        return out(res, 2)
    r = [x for x in rows if x["offer_ref"] == pick][0]
    e = J.offer_economics(r, p)
    table = {r["offer_ref"]: {"url": r["click_url"], "param": "sid"}}
    json.dump(table, open(os.path.join(ROOT, "runs", "launch", "offers-table.json"), "w", encoding="utf-8"), indent=2)
    # 能投的词：账过了带过线的词；用户硬选、账没过，就带出价最低的非品牌词，建系列时由用户或 Agent 定出价
    words = e["passing"][:20]
    if not words:
        metric = p["offer"].get("bid_metric", "cpc_low")
        cands = [k for k in (r.get("keywords") or []) if float(k.get(metric) or 0) > 0 and (r.get("brand_bidding_allowed") is True or not k.get("brand"))]
        words = [{"text": k["text"], "volume": k.get("volume"), metric: k.get(metric), "brand": k.get("brand", False)} for k in sorted(cands, key=lambda k: float(k[metric]))[:20]]
    res["picked"] = {"offer_ref": r["offer_ref"], "advertiser": r["advertiser"], "epc": r.get("epc"), "earn_per_click": e.get("epc_per_click"), "bid_cap": e.get("bid_cap"),
                     "currency": r.get("kw_currency"),
                     "keywords": words, "by": resp.get("decided_by")}
    warnings = []
    if not e["ok"]:
        warnings.append("账没过：%s" % e["why"])
    if r.get("ppc_allowed") is not True:
        warnings.append("PPC 政策没核：联盟不许 PPC 的话佣金可能被撤")
    if warnings:
        res["picked"]["warnings"] = warnings
    st.update({"offer": res["picked"], "offer_click_url_host": r["click_url"].split("/")[2] if "//" in r["click_url"] else ""})
    save(st)
    return out(res, 0)


def step_page(cfg, kv, apply):
    st = state()
    soul = J.load_soul(cfg.get("soul", "soul/default.soul.md"), cfg)
    if not kv.get("content"):
        return out({"error": "--content <json> 必填：模板占位符的值（TITLE、DESCRIPTION、H2_WHAT、P_WHAT …），tests/fixtures/lp-content.example.json 是样子"}, 4)
    content = json.load(open(kv["content"], encoding="utf-8"))
    content.setdefault("OFFER_REF", (st.get("offer") or {}).get("offer_ref", ""))
    content.setdefault("SITE_NAME", st.get("site_name", st.get("host", "")))
    content.setdefault("CONTACT_EMAIL", st.get("contact", ""))
    slug = kv.get("slug") or os.path.splitext(os.path.basename(kv["content"]))[0].replace(".content", "").lower()
    html = fill(open(TEMPLATE, encoding="utf-8").read(), content)
    site_dir = os.path.join(ROOT, "site")
    os.makedirs(site_dir, exist_ok=True)
    page_path = os.path.join(site_dir, slug + ".html")
    open(page_path, "w", encoding="utf-8").write(html)
    chk = lp_check.summarize(lp_check.check_html(html))
    resp, ok = decide(cfg, soul, "lp.publish", {"lp_check_passed": chk["verdict"] == "pass", "fails": chk["fail"], "slug": slug}, ["publish", "fix"],
                      ["site/%s.html" % slug], user=kv.get("user"))
    res = {"step": "page", "slug": slug, "file": os.path.relpath(page_path, ROOT), "lp_check": {"verdict": chk["verdict"], "fail": chk["fail"], "warn": chk["warn"],
           "fails": [r for r in chk["results"] if r["status"] == "fail"]}, "judge": judged(resp)}
    if not (ok and resp["choice"] == "publish"):
        return out(dict(res, note="建议先改：页面检查没过（Google 目的地要求可能拒登）。用户要照发就 --user publish"), 2)
    if apply:
        if not st.get("host"):
            return out(dict(res, error="先跑 deploy"), 4)
        d, m = plugin(cfg, "deploy")
        args = ["--page", page_path, "--slug", slug]
        tbl = os.path.join(ROOT, "runs", "launch", "offers-table.json")
        if os.path.exists(tbl):
            args += ["--offers", tbl]
        rc, j, txt, err = run(os.path.join(d, m["actions"]["publish"]), args)
        res["publish"] = j or txt[-300:]
        if rc:
            return out(dict(res, stderr=err[-200:]), 3)
        st.update({"slug": slug, "page_url": "%s/%s" % (st["base_url"], slug), "published_at": time.strftime("%Y-%m-%dT%H:%M:%S")})
        save(st)
    return out(res, 0)


def step_campaign(cfg, kv, apply, enable=False):
    st = state()
    soul = J.load_soul(cfg.get("soul", "soul/default.soul.md"), cfg)
    if not kv.get("brief"):
        return out({"error": "--brief <json> 必填（tests/fixtures/brief.example.json 是样子；final_url 与 offer_ref 不填就用开局状态里的）"}, 4)
    brief = json.load(open(kv["brief"], encoding="utf-8"))
    brief.setdefault("final_url", st.get("page_url", ""))
    brief.setdefault("offer_ref", (st.get("offer") or {}).get("offer_ref", ""))
    brief.setdefault("currency", cfg.get("currency", "USD"))
    # 出价上限从选中的 offer 带过来；没写出价就用第一个过线词的出价，且不超过出价上限（选品第一条与出价同一个数）
    offer = st.get("offer") or {}
    if offer.get("bid_cap") is not None:
        brief.setdefault("bid_cap", offer["bid_cap"])
    if brief.get("max_cpc") is None and offer.get("keywords"):
        metric = soul["params"]["offer"].get("bid_metric", "cpc_low")
        first = offer["keywords"][0].get(metric)
        if first is not None:
            brief.setdefault("google_bid", round(float(first), 2))   # 谷歌推荐出价：Keyword Planner 的首页出价
            brief["max_cpc"] = round(min(float(first), float(brief["bid_cap"])) if brief.get("bid_cap") is not None else float(first), 2)
    if not brief.get("final_url"):
        return out({"error": "brief 没有 final_url 且开局状态里没有已发布的页（先跑 page --apply）"}, 4)
    # 预算：用户写了就用；没写取谷歌推荐预算（新账号走新客户推荐）；谷歌没给就交给用户定，不编数
    budget_note = ""
    if brief.get("daily_budget") is None and brief.get("google_budget") is None:
        d_t, m_t = plugin(cfg, "traffic")
        if m_t["actions"].get("budget"):
            bp = os.path.join(ROOT, "runs", "launch", "budget-brief.json")
            os.makedirs(os.path.dirname(bp), exist_ok=True)
            json.dump(brief, open(bp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
            rc_b, j_b, _, _ = run(os.path.join(d_t, m_t["actions"]["budget"]), ["--new", bp, "--apply"] + (["--new-customer"] if brief.get("is_new_account") else []), timeout=120)
            if rc_b == 0 and isinstance(j_b, dict) and j_b.get("currency") and j_b["currency"] != cfg.get("currency", "USD"):
                budget_note = "谷歌推荐预算是 %s，config.currency 是 %s，不用；改 config.currency 后重跑" % (j_b["currency"], cfg.get("currency"))
            elif rc_b == 0 and isinstance(j_b, dict) and j_b.get("recommended") is not None:
                brief["google_budget"] = j_b["recommended"]
            elif rc_b == 0 and isinstance(j_b, dict) and j_b.get("options"):
                budget_note = "谷歌给了几档预算 %s，没标推荐哪一档，请你定（brief.daily_budget）" % j_b["options"]
            else:
                budget_note = "谷歌没给推荐预算（rc=%s），请你定（brief.daily_budget）" % rc_b
    import spec as S  # noqa: E402
    spec, problems = S.build(brief, soul["params"], cfg.get("caps") or {})
    errs = validate(load_schema("traffic-spec.schema.json"), spec)
    spec_path = os.path.join(ROOT, "runs", "launch", "spec.json")
    os.makedirs(os.path.dirname(spec_path), exist_ok=True)
    json.dump(spec, open(spec_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    acct = "ok"
    ap = os.path.join(ROOT, "data", "inbox", "account-status.json")
    if os.path.exists(ap):
        try:
            acct = (json.load(open(ap, encoding="utf-8")).get("status") or "ok")
        except ValueError:
            pass
    jst = {"spec_valid": not problems and not errs, "lp_published": bool(st.get("page_url")) or bool(kv.get("brief") and not apply), "account_status": acct,
           "max_cpc": spec["campaign"]["bidding"]["max_cpc"], "daily_budget": spec["campaign"]["daily_budget"], "is_new_account": bool(brief.get("is_new_account")),
           "bid_cap": brief.get("bid_cap"), "google_bid": brief.get("google_bid"), "google_budget": brief.get("google_budget")}
    resp, ok = decide(cfg, soul, "campaign.launch", jst, ["go", "hold"], ["runs/launch/spec.json"], user=kv.get("user"))
    res = {"step": "campaign", "spec": os.path.relpath(spec_path, ROOT), "problems": problems, "schema_errors": errs[:3], "state": jst, "judge": judged(resp)}
    if not (ok and resp["choice"] == "go"):
        return out(dict(res, note="建议先别建：%s。用户要照建就 --user go" % ("；".join(([budget_note] if budget_note else []) + problems) or resp["judge"]["reason"])), 2)
    if errs:
        return out(dict(res, error="spec 结构不对，Google 不收（这不是判断，是格式）：%s" % errs[:3]), 1)
    d, m = plugin(cfg, "traffic")
    args = ["--spec", spec_path] + (["--apply"] if apply else []) + (["--enable"] if enable else [])
    rc, j, txt, err = run(os.path.join(d, m["actions"]["deploy"]), args, timeout=600)
    res["deploy"] = {k: j.get(k) for k in ("mode", "applied", "campaign_id", "adgroup_ids", "error", "rolled_back") if k in j} if j else txt[-400:]
    if rc:
        return out(dict(res, stderr=err[-200:]), 3)
    if apply and j.get("campaign_id"):
        st.update({"campaign_id": j["campaign_id"], "campaign_name": spec["campaign"]["name"], "adgroup_ids": j.get("adgroup_ids"), "campaign_created_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "enabled": bool(enable)})
        save(st)
        # 日常循环读系列设置的地方：把出价上限一起记下，循环调价与选品用同一个数
        cp = os.path.join(ROOT, cfg.get("data_dir", "data"), "inbox", "campaigns.json")
        os.makedirs(os.path.dirname(cp), exist_ok=True)
        cc = {}
        if os.path.exists(cp):
            try:
                cc = json.load(open(cp, encoding="utf-8"))
            except ValueError:
                cc = {}
        row = cc.get(spec["campaign"]["name"]) or {}
        row.update({"daily_budget": spec["campaign"]["daily_budget"], "max_cpc": spec["campaign"]["bidding"]["max_cpc"], "bid_cap": brief.get("bid_cap"),
                    "offer_ref": brief.get("offer_ref"), "earn_per_click": offer.get("earn_per_click"), "google_bid": brief.get("google_bid"),
                    "currency": cfg.get("currency", "USD")})
        cc[spec["campaign"]["name"]] = row
        json.dump(cc, open(cp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        res["campaigns_json"] = os.path.relpath(cp, ROOT)
    return out(res, 0)


def step_verify(cfg, kv, apply):
    st = state()
    if not (st.get("host") and st.get("slug") and st.get("offer")):
        return out({"error": "要先有 deploy、offers、page 三步的结果"}, 4)
    d, m = plugin(cfg, "deploy")
    rc, j, txt, err = run(os.path.join(d, m["actions"]["status"]), ["--roundtrip", "--offer", st["offer"]["offer_ref"], "--slug", st["slug"]])
    res = {"step": "verify", "roundtrip": j.get("roundtrip") if j else txt[-400:], "health": j.get("health") if j else None}
    if rc or not (j.get("roundtrip") or {}).get("ok"):
        return out(dict(res, stderr=err[-200:]), 3)
    token = j["roundtrip"]["token"]
    con = subid.open_db(os.path.join(ROOT, cfg.get("data_dir", "data"), "ledger.db"))
    prc = subid.pull(con, "", (cfg.get("deploy") or {}).get("export_key_env", "ADSPILOT_EXPORT_KEY"))
    row = subid.lookup(con, token)
    res["ledger"] = {"pull_rc": prc, "token_in_ledger": bool(row), "gclid_matches": bool(row) and row.get("gclid") == j["roundtrip"]["test_gclid"]}
    ok = prc == 0 and res["ledger"]["gclid_matches"]
    if ok:
        st["verified_at"] = time.strftime("%Y-%m-%dT%H:%M:%S"); st["verify_token"] = token
        save(st)
    return out(res, 0 if ok else 3)


def step_go(cfg, kv, apply):
    st = state()
    if not st.get("campaign_id"):
        return out({"error": "没有已建的系列（先 campaign --apply）"}, 4)
    if not st.get("verified_at") and kv.get("user") != "go":
        return out({"step": "go", "note": "建议先 verify：还没真点过一次，点击能不能进账本没核。用户要直接启用就 --user go"}, 2)
    d, m = plugin(cfg, "traffic")
    rc, j, txt, err = run(os.path.join(d, m["actions"]["deploy"]), ["--enable-campaign", st["campaign_id"]] + (["--apply"] if apply else []))
    res = {"step": "go", "campaign_id": st["campaign_id"], "result": j or txt[-300:]}
    if rc:
        return out(dict(res, stderr=err[-200:]), 3)
    if apply:
        st["enabled"] = True; st["enabled_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        save(st)
        res["next"] = "装调度器，日常循环接管：core/loop/使用方法.md"
    return out(res, 0)


def step_teardown(cfg, kv, apply, all_=False):
    st = state()
    res = {"step": "teardown", "mode": "apply" if apply else "dry", "done": []}
    if st.get("campaign_id"):
        d, m = plugin(cfg, "traffic")
        rc, j, txt, err = run(os.path.join(d, m["actions"]["deploy"]), ["--remove-campaign", st["campaign_id"]] + (["--apply"] if apply else []))
        res["campaign"] = j or txt[-300:]
        if rc:
            return out(dict(res, stderr=err[-200:]), 3)
        if apply:
            for k in ("campaign_id", "campaign_name", "adgroup_ids", "campaign_created_at", "enabled", "enabled_at", "verified_at", "verify_token"):
                st.pop(k, None)
            res["done"].append("campaign removed")
    if all_ and st.get("host"):
        d, m = plugin(cfg, "deploy")
        rc, j, txt, err = run(os.path.join(d, m["actions"]["setup"]), ["--host", st["host"], "--teardown"] + (["--apply"] if apply else []))
        res["deploy"] = j or txt[-300:]
        if rc:
            return out(dict(res, stderr=err[-200:]), 3)
        if apply:
            st = {}
            res["done"].append("landing site removed")
    if apply:
        save(st)
    return out(res, 0)


def step_status(cfg, kv, apply):
    st = state()
    steps = [("deploy", bool(st.get("host"))), ("offers", bool(st.get("offer"))), ("page", bool(st.get("page_url"))),
             ("campaign", bool(st.get("campaign_id"))), ("verify", bool(st.get("verified_at"))), ("go", bool(st.get("enabled")))]
    nxt = next((n for n, done in steps if not done), "done: 日常循环接管")
    return out({"state": st, "steps": [{"step": n, "done": d} for n, d in steps], "next": nxt}, 0)


# ------------------------------------------------------------------ 自测（离线）
def selftest():
    cfg = load_cfg(os.path.join(ROOT, "config", "adspilot.example.json"))
    soul = J.load_soul("soul/default.soul.md", cfg)
    content = json.load(open(os.path.join(ROOT, "tests", "fixtures", "lp-content.example.json"), encoding="utf-8"))
    html = fill(open(TEMPLATE, encoding="utf-8").read(), content)
    chk = lp_check.summarize(lp_check.check_html(html))
    resp, ok = decide(cfg, soul, "lp.publish", {"lp_check_passed": chk["verdict"] == "pass"}, ["publish", "fix"], ["x"])
    t1 = chk["verdict"] == "pass" and ok and resp["choice"] == "publish"
    offers = [{"id": "cj:1:1", "data": {"epc": 12.0, "ppc_allowed": True, "category": "software", "reversal_rate": 0.05, "cookie_days": 45, "fx": 7.8,
                                        "keywords": [{"text": "x software review", "volume": 800, "cpc_low": 0.6, "cpc_high": 2.1}]}},
              {"id": "cj:2:2", "data": {"epc": 30.0, "ppc_allowed": None, "category": "software"}}, {"id": "none"}]
    r2, ok2 = decide(cfg, soul, "offer.select", {"offers_total": 2}, offers, ["x"])
    t2 = r2["choice"] == "cj:1:1"
    import spec as S  # noqa: E402
    brief = json.load(open(os.path.join(ROOT, "tests", "fixtures", "brief.example.json"), encoding="utf-8"))
    # 2.0.15 起 SOUL 没有出价常数：真实开局时状态里带着谷歌推荐出价（Keyword Planner），这里给 0.25，与 brief 的出价一致
    brief["google_bid"] = 0.25
    sp, problems = S.build(brief, soul["params"], cfg.get("caps") or {})
    st3 = {"spec_valid": not problems, "lp_published": True, "account_status": "ok", "max_cpc": sp["campaign"]["bidding"]["max_cpc"],
           "daily_budget": sp["campaign"]["daily_budget"], "is_new_account": True}
    r3, ok3 = decide(cfg, soul, "campaign.launch", dict(st3, google_bid=0.25), ["go", "hold"], ["x"])
    r3n, ok3n = decide(cfg, soul, "campaign.launch", st3, ["go", "hold"], ["x"])     # 没有任何出价参照 ⇒ 只提议不执行
    t3 = r3["choice"] == "go" and ok3 and r3n["mode_local"] == "M3" and not ok3n
    r4, _ = decide(cfg, soul, "campaign.launch", {"spec_valid": False, "lp_published": True, "account_status": "ok", "max_cpc": 0.2, "daily_budget": 5}, ["go", "hold"], ["x"])
    t4 = r4["choice"] == "hold"
    bad = [{"id": "cj:9:9", "data": {"epc": 90, "fx": 7.8, "ppc_allowed": None, "keywords": [{"text": "x", "volume": 900, "cpc_low": 30.0}]}}, {"id": "none"}]
    r5, ok5 = decide(cfg, soul, "offer.select", {}, bad, ["x"], user="cj:9:9")
    t5 = r5["choice"] == "cj:9:9" and ok5 and r5["decided_by"] == "user" and r5["advice"]["choice"] == "none"
    r6, ok6 = decide(cfg, soul, "lp.publish", {"lp_check_passed": False}, ["publish", "fix"], ["x"], user="publish")
    t6 = r6["choice"] == "publish" and ok6
    # T1：港币账户，选中 offer 的 bid_cap 带到系列；过线词出价 3.79 < bid_cap 4.56 ⇒ go
    hk = dict(cfg, currency="HKD")
    soul_hk = J.load_soul("soul/default.soul.md", hk)
    e = J.offer_economics({"epc": 117.34, "epc_3m": 58.43, "fx": 7.8, "keywords": [{"text": "vacuum mop", "volume": 14800, "cpc_low": 3.79}]}, soul_hk["params"])
    b7 = dict(brief, bid_cap=e["bid_cap"], max_cpc=round(min(3.79, e["bid_cap"]), 2), currency="HKD")
    sp7, p7 = S.build(b7, soul_hk["params"], hk.get("caps") or {})
    r7, ok7 = decide(hk, soul_hk, "campaign.launch", {"spec_valid": not p7, "lp_published": True, "account_status": "ok", "max_cpc": sp7["campaign"]["bidding"]["max_cpc"],
                                                      "daily_budget": sp7["campaign"]["daily_budget"], "is_new_account": True, "bid_cap": e["bid_cap"]}, ["go", "hold"], ["x"])
    t7 = e["ok"] and abs(e["bid_cap"] - 4.56) < 0.01 and not p7 and r7["choice"] == "go" and ok7
    print("hkd: bid_cap=%s spec_problems=%s launch=%s/%s" % (e["bid_cap"], p7, r7["choice"], r7["mode_local"]))
    good = t1 and t2 and t3 and t4 and t5 and t6 and t7
    print("lp=%s/%s offer=%s launch=%s hold=%s user_pick=%s/%s user_publish=%s -> %s" % (chk["verdict"], resp["mode_local"], r2["choice"], r3["mode_local"], r4["choice"],
          r5["choice"], r5["decided_by"], r6["choice"], "OK" if good else "FAIL"))
    if chk["fail"]:
        print([r for r in chk["results"] if r["status"] == "fail"])
    return 0 if good else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    if not argv or argv[0].startswith("--"):
        print(__doc__); return 1
    cmd = argv[0]
    kv = {argv[i][2:]: argv[i + 1] for i in range(1, len(argv) - 1) if argv[i].startswith("--") and not argv[i + 1].startswith("--")}
    apply = "--apply" in argv
    cfg = load_cfg(kv.get("config"))
    steps = {"deploy": step_deploy, "offers": step_offers, "page": step_page, "verify": step_verify, "go": step_go, "status": step_status}
    if cmd == "campaign":
        return step_campaign(cfg, kv, apply, enable=("--enable" in argv))
    if cmd == "teardown":
        return step_teardown(cfg, kv, apply, all_=("--all" in argv))
    if cmd not in steps:
        print(__doc__); return 1
    return steps[cmd](cfg, kv, apply)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
