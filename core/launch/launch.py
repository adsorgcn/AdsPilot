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


def decide(cfg, soul, node, st_, choices, evidence):
    choices = [{"id": c} if isinstance(c, str) else c for c in choices]
    resp = J.judge(node, st_, choices, cfg=cfg, soul=soul, evidence=evidence, req_id="launch-%s-%d" % (node, int(time.time())))
    return resp, J.acts(resp["mode_local"])


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
    soul = J.load_soul(cfg.get("soul", "soul/default.soul.md"))
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
    # 第一条要查词：只查 EPC 靠前的 N 家（--top，默认 10），查词有配额
    rows = sorted(rows, key=lambda r: max(float(r.get("epc") or 0), float(r.get("epc_3m") or 0)), reverse=True)[:int(kv.get("top", 10))]
    kw_errors = {}
    if not all(r.get("keywords") for r in rows):
        cur, kw, kw_errors = keyword_data(cfg, rows, kv)
        fx_table = cfg.get("fx") or {}
        fx = fx_table.get(cur) if cur else None
        if cur and fx is None:
            return out({"step": "offers", "error": "config.fx 里没有 %s 的汇率（每 1 美元多少 %s）" % (cur, cur)}, 4)
        for r in rows:
            r["keywords"] = kw.get(r["offer_ref"]) or []
            r["fx"] = float(fx or 1.0) / float(fx_table.get(r.get("epc_currency", "USD"), 1.0) or 1.0)
            r["kw_currency"] = cur
    if kv.get("pick"):
        # --pick：Agent 已在联盟后台读过这家的 Program Terms，确认许 PPC；账（第一条）照样要算得过来
        for r in rows:
            if r["offer_ref"] == kv["pick"]:
                r["ppc_allowed"] = True
    econ = []
    for r in rows:
        e = J.offer_economics(r, p)
        econ.append({"offer_ref": r["offer_ref"], "advertiser": r.get("advertiser"), "epc_7d": r.get("epc"), "epc_3m": r.get("epc_3m"),
                     "earn_per_click": e.get("epc_per_click"), "currency": r.get("kw_currency"), "bid_below_epc": e["ok"], "why": e["why"],
                     "passing_words": len(e.get("passing") or []), "best": e.get("best"), "ppc_allowed": r.get("ppc_allowed"),
                     "brand_bidding_allowed": r.get("brand_bidding_allowed")})
    choices = [{"id": r["offer_ref"], "data": r} for r in rows] + [{"id": "none"}]
    resp, ok = decide(cfg, soul, "offer.select", {"offers_total": len(rows), "market": kv.get("country", "US")}, choices, ["runs/launch/offers.json", "runs/launch/keywords.json"])
    res = {"step": "offers", "checked": len(rows), "rule_1": "词的出价(%s) < 每次点击赚的钱(EPC÷100，%s)" % (p["offer"].get("bid_metric"), p["offer"].get("epc_basis")),
           "economics": econ, "keyword_errors": kw_errors,
           "judge": {"choice": resp["choice"], "mode": resp["mode_local"], "reason": resp["judge"]["reason"]}}
    pick = resp["choice"] if ok and resp["choice"] != "none" else ""
    if not pick:
        passed = [e["advertiser"] for e in econ if e["bid_below_epc"]]
        res["note"] = ("第一条（账）过了的：%s；但 PPC 政策没核（ppc_allowed 为 null）。Agent 去联盟后台读这几家的 Program Terms，写进 data/inbox/cj-offer-policy.json 再跑，或读完后 --pick <offer_ref>" % "、".join(passed)) \
            if passed else "没有一家的账算得过来：词的出价都不低于每次点击赚的钱。换一批 offer（--top 加大）或换市场"
        if kv.get("pick"):
            res["note"] = "--pick %s 没过第一条：%s" % (kv["pick"], next((e["why"] for e in econ if e["offer_ref"] == kv["pick"]), "不在前 %s 家里" % kv.get("top", 10)))
        return out(res, 2)
    r = [x for x in rows if x["offer_ref"] == pick][0]
    e = J.offer_economics(r, p)
    table = {r["offer_ref"]: {"url": r["click_url"], "param": "sid"}}
    json.dump(table, open(os.path.join(ROOT, "runs", "launch", "offers-table.json"), "w", encoding="utf-8"), indent=2)
    res["picked"] = {"offer_ref": r["offer_ref"], "advertiser": r["advertiser"], "epc": r.get("epc"), "earn_per_click": e["epc_per_click"], "currency": r.get("kw_currency"),
                     "keywords": e["passing"][:20], "by": "pick" if kv.get("pick") else "soul"}
    st.update({"offer": res["picked"], "offer_click_url_host": r["click_url"].split("/")[2] if "//" in r["click_url"] else ""})
    save(st)
    return out(res, 0)


def step_page(cfg, kv, apply):
    st = state()
    soul = J.load_soul(cfg.get("soul", "soul/default.soul.md"))
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
    resp, ok = decide(cfg, soul, "lp.publish", {"lp_check_passed": chk["verdict"] == "pass", "fails": chk["fail"], "slug": slug}, ["publish", "fix"], ["site/%s.html" % slug])
    res = {"step": "page", "slug": slug, "file": os.path.relpath(page_path, ROOT), "lp_check": {"verdict": chk["verdict"], "fail": chk["fail"], "warn": chk["warn"],
           "fails": [r for r in chk["results"] if r["status"] == "fail"]}, "judge": {"choice": resp["choice"], "mode": resp["mode_local"], "reason": resp["judge"]["reason"]}}
    if not (ok and resp["choice"] == "publish"):
        return out(dict(res, note="页面没过，不发布；改内容再跑"), 2)
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
    soul = J.load_soul(cfg.get("soul", "soul/default.soul.md"))
    if not kv.get("brief"):
        return out({"error": "--brief <json> 必填（tests/fixtures/brief.example.json 是样子；final_url 与 offer_ref 不填就用开局状态里的）"}, 4)
    brief = json.load(open(kv["brief"], encoding="utf-8"))
    brief.setdefault("final_url", st.get("page_url", ""))
    brief.setdefault("offer_ref", (st.get("offer") or {}).get("offer_ref", ""))
    if not brief.get("final_url"):
        return out({"error": "brief 没有 final_url 且开局状态里没有已发布的页（先跑 page --apply）"}, 4)
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
           "max_cpc": spec["campaign"]["bidding"]["max_cpc"], "daily_budget": spec["campaign"]["daily_budget"], "is_new_account": bool(brief.get("is_new_account"))}
    resp, ok = decide(cfg, soul, "campaign.launch", jst, ["go", "hold"], ["runs/launch/spec.json"])
    res = {"step": "campaign", "spec": os.path.relpath(spec_path, ROOT), "problems": problems, "schema_errors": errs[:3], "state": jst,
           "judge": {"choice": resp["choice"], "mode": resp["mode_local"], "reason": resp["judge"]["reason"]}}
    if not (ok and resp["choice"] == "go"):
        return out(dict(res, note="不放行，不建"), 2)
    d, m = plugin(cfg, "traffic")
    args = ["--spec", spec_path] + (["--apply"] if apply else []) + (["--enable"] if enable else [])
    rc, j, txt, err = run(os.path.join(d, m["actions"]["deploy"]), args, timeout=600)
    res["deploy"] = {k: j.get(k) for k in ("mode", "applied", "campaign_id", "adgroup_ids", "error", "rolled_back") if k in j} if j else txt[-400:]
    if rc:
        return out(dict(res, stderr=err[-200:]), 3)
    if apply and j.get("campaign_id"):
        st.update({"campaign_id": j["campaign_id"], "campaign_name": spec["campaign"]["name"], "adgroup_ids": j.get("adgroup_ids"), "campaign_created_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "enabled": bool(enable)})
        save(st)
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
    if not st.get("verified_at"):
        return out({"error": "先 verify 通过再启用"}, 2)
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
    soul = J.load_soul("soul/default.soul.md")
    cfg = load_cfg(os.path.join(ROOT, "config", "adspilot.example.json"))
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
    sp, problems = S.build(brief, soul["params"], cfg.get("caps") or {})
    r3, ok3 = decide(cfg, soul, "campaign.launch", {"spec_valid": not problems, "lp_published": True, "account_status": "ok", "max_cpc": sp["campaign"]["bidding"]["max_cpc"],
                                                    "daily_budget": sp["campaign"]["daily_budget"], "is_new_account": True}, ["go", "hold"], ["x"])
    t3 = r3["choice"] == "go" and ok3
    r4, _ = decide(cfg, soul, "campaign.launch", {"spec_valid": False, "lp_published": True, "account_status": "ok", "max_cpc": 0.2, "daily_budget": 5}, ["go", "hold"], ["x"])
    t4 = r4["choice"] == "hold"
    good = t1 and t2 and t3 and t4
    print("lp=%s/%s offer=%s launch=%s hold=%s -> %s" % (chk["verdict"], resp["mode_local"], r2["choice"], r3["mode_local"], r4["choice"], "OK" if good else "FAIL"))
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
