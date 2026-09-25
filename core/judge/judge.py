#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AdsPilot 判断接口（主干，判断部件）

两层：
  感知层  场景 -> 11 维向量 + 选项。由 SOUL 的本地规则（本文件）或判断插件（llm / jev / soul-api）给出。
  决策层  向量 -> 模式 M1..M8。按 iLang v5 f_v5 在本地算，常数与结构冻结，任何提供者报的模式只作对照。

用法：
  python3 core/judge/judge.py --node campaign.adjust --state s.json --choices c.json [--provider local] [--config config/adspilot.json]
  python3 core/judge/judge.py --selftest
输出：schemas/judgment.schema.json 的 response（stdout，JSON）。
退出码：0 出了判断；1 输入错误。判断本身的模式不影响退出码。

只用标准库。f_v5 的常数抄自 ilang-spec 的 ilang_judge_validator.py（MIT），不得改动。
"""
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "core", "selfcheck"))

DIMS = ["int", "cap", "csq", "rel", "cer", "aut", "rev", "evd", "sov", "ine", "ext"]
MODES = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"]
NODES = ["offer.select", "lp.publish", "campaign.launch", "campaign.adjust", "keyword.action", "conversion.upload", "anomaly.escalate"]

# ---- iLang v5 f_v5：冻结。改这里等于改协议。----
WEIGHTS = {"int": 0.15, "cap": 0.10, "csq": 0.20, "rel": 0.05, "cer": 0.03, "rev": 0.15, "evd": 0.02, "sov": 0.15, "ine": 0.05, "ext": 0.10}
TH = {"sov_survival": 0.15, "ext_survival": 0.10, "csq_survival": 0.10, "rev_survival": 0.20,
      "cer_gate": 0.30, "evd_gate": 0.25, "aut_gate": 0.30, "aut_cap": 0.55,
      "b_m1": 0.85, "b_m2": 0.70, "b_m3": 0.55, "b_m4": 0.40, "b_m7": 0.25}


def f_v5(v):
    try:
        x = {d: float(v[d]) for d in DIMS}
    except (KeyError, TypeError, ValueError):
        return "M5"
    if any(not (0.0 <= x[d] <= 1.0) for d in DIMS):
        return "M5"
    if x["sov"] < TH["sov_survival"] or x["ext"] < TH["ext_survival"]:
        return "M8"
    if x["csq"] < TH["csq_survival"] and x["rev"] < TH["rev_survival"]:
        return "M8"
    if x["cer"] < TH["cer_gate"] or x["evd"] < TH["evd_gate"]:
        return "M5"
    if x["aut"] < TH["aut_gate"]:
        return "M6"
    s = round(sum(WEIGHTS[d] * x[d] for d in WEIGHTS), 4)
    if s > TH["b_m1"]: mode = "M1"
    elif s > TH["b_m2"]: mode = "M2"
    elif s > TH["b_m3"]: mode = "M3"
    elif s > TH["b_m4"]: mode = "M4"
    elif s > TH["b_m7"]: mode = "M7"
    else: mode = "M8"
    if x["aut"] < TH["aut_cap"] and mode in ("M1", "M2"):
        mode = "M3"
    return mode
# ---- 冻结区结束 ----


def r2(x):
    return round(max(0.0, min(1.0, float(x))) + 1e-9, 2)


# ------------------------------------------------------------------ SOUL
def load_soul(path):
    """读 *.soul.md：json soul-params 围栏 + ::BOUNDARY 行。"""
    p = path if os.path.isabs(path) else os.path.join(ROOT, path)
    txt = open(p, "r", encoding="utf-8").read()
    m = re.search(r"```json soul-params\s*\n(.*?)\n```", txt, re.S)
    if not m:
        raise ValueError("SOUL 缺 ```json soul-params 围栏: %s" % path)
    params = json.loads(m.group(1))
    boundaries = re.findall(r"^::BOUNDARY\{never:([^|}]+)", txt, re.M)
    return {"path": path, "params": params, "boundaries": [b.strip() for b in boundaries],
            "id": "%s@%s" % (params.get("soul", "?"), params.get("version", "?"))}


# ------------------------------------------------------------------ 边界
# 合规姿态：用户说了也不做（怎么投）。其余是运营边界：Agent 自己拿主意时不越过，用户明确说了就照做。
COMPLIANCE_BOUNDARIES = ("forbidden_action", "account_suspended_or_limited")


def boundary_hit(node, state, choice, soul):
    """状态或选项命中 SOUL 边界即返回边界名；命中则模式强制 M8。"""
    st = state or {}
    p = soul["params"]
    acct = str(st.get("account_status", "ok")).lower()
    if acct in ("suspended", "limited", "disabled") and choice not in ("pause_all", "escalate", "hold", "none"):
        return "account_suspended_or_limited"
    total = float(st.get("spend_total", 0) or 0)
    if total >= p["stop_loss"]["test_spend_total"] and choice in ("go", "budget_up", "keep", "continue", "upload") and not st.get("human_confirmed_continue"):
        return "test_spend_total_exceeded_without_human_confirmation"
    if node == "conversion.upload" and choice == "upload" and st.get("reconciled") is False:
        return "upload_unreconciled_conversions"
    if node in ("campaign.launch", "lp.publish") and st.get("final_url_is_affiliate"):
        return "affiliate_link_as_final_url"
    if st.get("requested_action") in ("fake_traffic", "click_simulation", "cloaking", "bypass", "multi_account", "impersonation"):
        return "forbidden_action"
    return None


# ------------------------------------------------------------------ 本地感知层
REQUIRED_FIELDS = {
    "offer.select": [],
    "lp.publish": ["lp_check_passed"],
    "campaign.launch": ["spec_valid", "lp_published", "account_status", "daily_budget", "max_cpc", "is_new_account"],
    "campaign.adjust": ["days_running", "spend_total", "spend_window", "clicks", "avg_cpc", "conversions", "commission", "last_change_days"],
    "keyword.action": ["clicks", "conversions", "avg_cpc"],
    "conversion.upload": ["rows_in_window", "rows_out_of_window", "gclid_all_valid", "reconciled"],
    "anomaly.escalate": ["account_status", "disapprovals", "spend_today", "spend_avg_7d"],
}


def _within_caps(node, state, choice, caps, p):
    caps = caps or {}
    if choice in ("go",):
        return float(state.get("daily_budget", 0)) <= float(caps.get("daily_budget", p["budget"]["daily_cap"])) and \
            float(state.get("max_cpc", 0)) <= float(caps.get("max_cpc", p["cpc"]["cap"]))
    if choice == "budget_up":
        nb = float(state.get("daily_budget", 0)) * (1 + p["budget"]["step_pct"] / 100.0)
        return nb <= float(caps.get("daily_budget", p["budget"]["daily_cap"]))
    return True


def offer_economics(d, p):
    """offer.select 第一条：词的出价 < 每次点击赚的钱。
    d：offer 的 data，含 epc、epc_3m（联盟给的每百次点击收益，联盟币种）、fx（广告账户币种每 1 联盟币种）、
       keywords（关键词插件的行：text、volume、cpc_low、cpc_high，广告账户币种）。
    返回 {epc_per_click, passing:[词], checked, best, ok, why}。"""
    o = p["offer"]
    e7, e3 = d.get("epc"), d.get("epc_3m")
    vals = [float(x) for x in (e7, e3) if x is not None]
    if not vals:
        return {"ok": False, "why": "no_epc", "passing": [], "checked": 0}
    basis = o.get("epc_basis", "min_7d_3m")
    epc = min(vals) if basis == "min_7d_3m" else (float(e3) if basis == "3m" and e3 is not None else float(vals[0]))
    epc_per_click = epc / 100.0 * float(d.get("fx") or 1.0)
    kws = d.get("keywords")
    if not kws:
        return {"ok": False, "why": "no_keyword_data", "epc_per_click": round(epc_per_click, 2), "passing": [], "checked": 0}
    metric = o.get("bid_metric", "cpc_low")
    min_vol = int(o.get("min_keyword_searches", 50))
    brand_ok = d.get("brand_bidding_allowed") is True
    checked = [k for k in kws if float(k.get(metric) or 0) > 0 and int(k.get("volume") or 0) >= min_vol and (brand_ok or not k.get("brand"))]
    passing = sorted([k for k in checked if float(k[metric]) < epc_per_click], key=lambda k: (-int(k.get("volume") or 0), float(k[metric])))
    best = passing[0] if passing else (min(checked, key=lambda k: float(k[metric])) if checked else None)
    why = "bid_below_epc_%d_of_%d" % (len(passing), len(checked)) if passing else ("cheapest_bid_%.2f_over_epc_%.2f" % (float(best[metric]), epc_per_click) if best else "no_keyword_with_bid_and_volume")
    return {"ok": bool(passing), "why": why, "epc_per_click": round(epc_per_click, 2), "metric": metric, "checked": len(checked),
            "passing": [{"text": k["text"], "volume": k.get("volume"), metric: k[metric], "brand": k.get("brand", False)} for k in passing],
            "best": {"text": best["text"], metric: best[metric], "volume": best.get("volume")} if best else None}


def local_choice(node, state, choices, soul):
    """默认 SOUL 的规则，按 soul/default.soul.md 节点一节的顺序。返回 (choice_id, reason)。"""
    p = soul["params"]
    ids = [c["id"] for c in choices]
    st = state or {}

    def pick(x, why):
        return (x if x in ids else ids[0]), why

    if node == "offer.select":
        best, best_score = None, -1.0
        for c in choices:
            d = c.get("data") or {}
            if c["id"] == "none":
                continue
            if not offer_economics(d, p)["ok"]:
                continue
            if p["offer"]["require_ppc_allowed"] and not d.get("ppc_allowed"):
                continue
            if (d.get("category") or "").lower() in p["offer"]["blocked_categories"]:
                continue
            rr = float(d.get("reversal_rate") or 0)
            if rr > p["offer"]["max_reversal_rate"]:
                continue
            epc = d.get("epc")
            epc = float(epc) if epc is not None else p["offer"]["min_epc"] / 2.0
            cookie = float(d.get("cookie_days") or 0)
            score = epc * (1 - rr) + (0.5 if cookie >= p["offer"]["min_cookie_days"] else 0.0)
            if score > best_score:
                best, best_score = c["id"], score
        if best is None:
            return pick("none", "no_offer_passes_filters_fetch_more")
        return best, "best_epc_after_reversal_and_cookie_%.2f" % best_score

    if node == "lp.publish":
        return pick("publish" if st.get("lp_check_passed") else "fix", "lp_check_%s" % ("pass" if st.get("lp_check_passed") else "fail"))

    if node == "campaign.launch":
        ok = st.get("spec_valid") and st.get("lp_published") and str(st.get("account_status", "")).lower() == "ok"
        if not ok:
            return pick("hold", "spec_or_lp_or_account_not_ready")
        if float(st.get("max_cpc", 0)) > p["cpc"]["cap"]:
            return pick("hold", "max_cpc_over_cap")
        if st.get("is_new_account") and float(st.get("daily_budget", 0)) > p["budget"]["first_day"]:
            return pick("hold", "new_account_budget_over_first_day")
        return pick("go", "spec_valid_lp_published_within_caps")

    if node == "campaign.adjust":
        if float(st.get("spend_total", 0)) >= p["stop_loss"]["test_spend_total"]:
            return pick("pause", "test_spend_total_reached_escalate")
        if float(st.get("avg_cpc", 0)) > p["cpc"]["cap"]:
            return pick("bid_down", "avg_cpc_over_cap")
        if float(st.get("spend_total", 0)) >= p["stop_loss"]["spend_no_conversion"] and float(st.get("conversions", 0)) == 0:
            return pick("pause", "stop_loss_no_conversion")
        sw = float(st.get("spend_window", 0)); com = float(st.get("commission", 0))
        if int(st.get("days_running", 0)) >= p["stop_loss"]["days_before_budget_down"] and com < sw * p["stop_loss"]["roi_floor"]:
            return pick("budget_down", "commission_below_roi_floor")
        if float(st.get("conversions", 0)) > 0 and com >= sw and int(st.get("days_running", 0)) >= p["budget"]["ramp_min_days"] \
                and int(st.get("last_change_days", 0)) >= p["budget"]["min_days_between_changes"]:
            return pick("budget_up", "profitable_ramp_step")
        return pick("keep", "no_rule_hit")

    if node == "keyword.action":
        if float(st.get("avg_cpc", 0)) > p["cpc"]["cap"]:
            return pick("bid_down", "avg_cpc_over_cap")
        if int(st.get("clicks", 0)) >= p["keyword"]["pause_after_clicks_no_conv"] and float(st.get("conversions", 0)) == 0:
            return pick("pause", "clicks_without_conversion")
        return pick("keep", "no_rule_hit_relevance_needs_provider")

    if node == "conversion.upload":
        if int(st.get("rows_in_window", 0)) >= p["conversion"]["min_rows"] and st.get("gclid_all_valid") and st.get("reconciled"):
            return pick("upload", "rows_in_window_reconciled")
        return pick("hold", "nothing_valid_to_upload")

    if node == "anomaly.escalate":
        acct = str(st.get("account_status", "ok")).lower()
        if acct in ("suspended", "limited", "disabled"):
            return pick("pause_all", "account_%s" % acct)
        if st.get("identity_or_payment_verification_requested"):
            return pick("escalate", "platform_requests_human_verification")
        if int(st.get("disapprovals", 0)) > 0:
            return pick("escalate", "ad_disapproved_human_appeal_once")
        avg = float(st.get("spend_avg_7d", 0) or 0)
        if avg > 0 and float(st.get("spend_today", 0)) >= avg * p["anomaly"]["spend_spike_x"]:
            return pick("pause_all", "spend_spike")
        return pick("continue", "no_anomaly")

    return ids[0], "unknown_node"


def local_vector(node, state, choice, caps, evidence, cfg, soul):
    p = soul["params"]
    st = state or {}
    base = dict(p["vector_base"])
    req = REQUIRED_FIELDS.get(node, [])
    have = sum(1 for k in req if k in st)
    cer = 0.85 if not req else max(0.10, 0.85 * have / len(req))
    evd = 0.85 if evidence else 0.20
    autonomy = (cfg.get("caps") or {}).get("autonomy", "within_caps") if cfg else "within_caps"
    if autonomy == "propose_only":
        aut = p["authority"]["propose_only"]
    else:
        aut = p["authority"]["within_caps"] if _within_caps(node, st, choice, caps, p) else p["authority"]["over_caps"]
    rev = p["reversibility"].get(choice, 0.60)
    money = float(st.get("money_at_stake", st.get("spend_window", st.get("daily_budget", 0))) or 0)
    csq = max(0.30, 1.0 - 0.6 * min(1.0, money / p["stop_loss"]["test_spend_total"]))
    if choice in ("keep", "continue", "hold", "none"):
        ine = 0.90
    elif choice in ("go", "publish", "select") or node == "offer.select":
        ine = 0.50
    else:
        ine = 0.70
    sov = base["sov"] if st.get("in_declared_scope", True) else 0.10
    v = {"int": base["int"], "cap": base["cap"], "csq": csq, "rel": base["rel"], "cer": cer, "aut": aut,
         "rev": rev, "evd": evd, "sov": sov, "ine": ine, "ext": base["ext"]}
    return {d: r2(v[d]) for d in DIMS}


def judge_local(node, state, choices, caps, evidence, cfg, soul):
    choice, reason = local_choice(node, state, choices, soul)
    v = local_vector(node, state, choice, caps, evidence, cfg, soul)
    return {"v": v, "choice": choice, "conf": 0.70, "reason": reason[:120]}


# ------------------------------------------------------------------ 插件提供者
def call_provider(provider, request, cfg, timeout_s):
    d = os.path.join(ROOT, "plugins", "judgment", provider)
    m = json.load(open(os.path.join(d, "manifest.json"), encoding="utf-8"))
    script = os.path.join(d, m["actions"]["judge"])
    t0 = time.time()
    out = subprocess.run([sys.executable, script, "--config", json.dumps(cfg.get("judgment", {}))],
                         input=json.dumps(request, ensure_ascii=False), capture_output=True, text=True, timeout=timeout_s)
    if out.returncode != 0:
        raise RuntimeError("provider %s rc=%d: %s" % (provider, out.returncode, (out.stderr or "").strip()[-300:]))
    res = json.loads(out.stdout)
    res["latency_ms"] = int((time.time() - t0) * 1000)
    return res


def normalize_vector(v):
    if not isinstance(v, dict):
        raise ValueError("v not object")
    out = {}
    for d in DIMS:
        if d not in v:
            raise ValueError("missing dim %s" % d)
        x = float(v[d])
        if not 0.0 <= x <= 1.0:
            raise ValueError("dim %s out of range" % d)
        out[d] = round(x, 2)
    return out


# ------------------------------------------------------------------ 主入口
def judge(node, state, choices, cfg=None, soul=None, caps=None, evidence=None, provider=None, req_id=None):
    cfg = cfg or {}
    soul = soul or load_soul(cfg.get("soul", "soul/default.soul.md"))
    if node not in NODES:
        raise ValueError("unknown node %s" % node)
    if not choices or len(choices) > 255:
        raise ValueError("choices must have 1..255 items")
    caps = caps if caps is not None else cfg.get("caps")
    evidence = evidence or []
    provider = provider or (cfg.get("judgment") or {}).get("provider", "local")
    timeout_s = float((cfg.get("judgment") or {}).get("timeout_s", 8))
    request = {"type": "judgment.request", "schema_version": 1, "id": req_id or "%s-%d" % (node, int(time.time())),
               "node": node, "state": state or {}, "choices": choices, "caps": caps or {}, "evidence": evidence, "soul": soul["id"]}
    used, fallback, perc, distribution, latency = provider, False, None, None, None
    if provider != "local":
        try:
            res = call_provider(provider, request, cfg, timeout_s)
            ch = res.get("choice")
            if ch not in [c["id"] for c in choices]:
                raise ValueError("choice %r not in choices" % ch)
            if res.get("v") is None:
                # Jev 类提供者只给选项与分布，不给 11 维向量：向量按本地规则为该选项打分
                v = local_vector(node, state, ch, caps, evidence, cfg, soul)
            else:
                v = normalize_vector(res.get("v"))
            perc = {"v": v, "choice": ch, "conf": r2(res.get("conf", 0.5)), "reason": str(res.get("reason", ""))[:120] or "provider_reason_missing"}
            distribution, latency = res.get("distribution"), res.get("latency_ms")
        except Exception as e:  # noqa: BLE001
            sys.stderr.write("[judge] provider %s failed, fallback to local: %s\n" % (provider, e))
            used, fallback = "local", True
    if perc is None:
        perc = judge_local(node, state, choices, caps, evidence, cfg, soul)
    mode_local = f_v5(perc["v"])
    b = boundary_hit(node, state, perc["choice"], soul)
    if b:
        mode_local = "M8"
    judge_block = {"judge": "v5.0", "v": perc["v"], "mode": mode_local, "conf": perc["conf"], "reason": perc["reason"]}
    resp = {"type": "judgment.response", "schema_version": 1, "id": request["id"], "node": node,
            "choice": perc["choice"], "confidence": perc["conf"], "judge": judge_block, "mode_local": mode_local,
            "provider": used, "fallback": fallback}
    if b:
        resp["boundary_hit"] = b
    # 谁拿主意：用户明确说了就照做，判断照算作为建议；合规姿态例外
    user = (state or {}).get("user_decision")
    ids = [c["id"] for c in choices]
    if user:
        resp["user_choice"] = str(user)[:64]
        ub = boundary_hit(node, state, user, soul) if user in ids else None
        if user not in ids:
            resp.update({"decided_by": "judge", "executes": acts(mode_local)})
            resp["advice"] = {"choice": perc["choice"], "mode": mode_local, "reason": "user_choice_not_in_choices"}
        elif ub in COMPLIANCE_BOUNDARIES:
            resp.update({"decided_by": "compliance", "executes": False})
            resp["advice"] = {"choice": perc["choice"], "mode": "M8", "reason": "compliance_boundary", "boundary_hit": ub}
        else:
            adv = {"choice": perc["choice"], "mode": mode_local, "reason": perc["reason"]}
            if ub or b:
                adv["boundary_hit"] = ub or b
            resp.update({"choice": user, "decided_by": "user", "executes": True, "advice": adv})
    else:
        resp.update({"decided_by": "judge", "executes": acts(mode_local)})
    if distribution:
        resp["distribution"] = {k: r2(x) for k, x in distribution.items()}
    if latency is not None:
        resp["latency_ms"] = int(latency)
    return resp


def to_judge_text(resp):
    j = resp["judge"]
    return "::JUDGE{v5.0}\nV:[%s]\nM:%s|conf:%.2f\nR:%s" % (
        ",".join("%s=%.2f" % (d, j["v"][d]) for d in DIMS), j["mode"], j["conf"], j["reason"])


def executes(resp):
    """这一步做不做：用户明确说了（且不是合规姿态）就做；否则 M1、M2 做。"""
    return bool(resp.get("executes", acts(resp.get("mode_local", "M8"))))


def acts(mode):
    """M1、M2 执行；其余不执行（M3 提议，M4 建议，M5 要信息，M6 交人，M7 换路，M8 停）。"""
    return mode in ("M1", "M2")


# ------------------------------------------------------------------ selftest
def selftest(soul_path="soul/default.soul.md"):
    soul = load_soul(soul_path)
    cfg = {"caps": {"max_cpc": 0.25, "daily_budget": 10.0, "stop_loss_spend": 300.0}, "judgment": {"provider": "local"}}
    ev = ["runs/x/report.json"]
    cases = [
        ("campaign.adjust", {"days_running": 4, "spend_total": 40, "spend_window": 20, "clicks": 80, "avg_cpc": 0.24, "conversions": 2,
                             "commission": 30, "last_change_days": 3}, ["keep", "bid_down", "budget_up", "budget_down", "pause"], "budget_up", ("M1", "M2")),
        ("campaign.adjust", {"days_running": 4, "spend_total": 40, "spend_window": 20, "clicks": 80, "avg_cpc": 0.31, "conversions": 2,
                             "commission": 30, "last_change_days": 3}, ["keep", "bid_down", "budget_up", "budget_down", "pause"], "bid_down", ("M1", "M2")),
        ("campaign.adjust", {"days_running": 9, "spend_total": 120, "spend_window": 60, "clicks": 300, "avg_cpc": 0.2, "conversions": 0,
                             "commission": 0, "last_change_days": 3}, ["keep", "bid_down", "budget_up", "budget_down", "pause"], "pause", ("M1", "M2")),
        ("campaign.adjust", {"days_running": 4, "spend_total": 40}, ["keep", "pause"], None, ("M5",)),
        ("campaign.launch", {"spec_valid": True, "lp_published": True, "account_status": "ok", "daily_budget": 5, "max_cpc": 0.25, "is_new_account": True},
         ["go", "hold"], "go", ("M1", "M2")),
        ("campaign.launch", {"spec_valid": True, "lp_published": True, "account_status": "ok", "daily_budget": 50, "max_cpc": 0.25, "is_new_account": False},
         ["go", "hold"], "go", ("M3",)),
        ("campaign.launch", {"spec_valid": True, "lp_published": True, "account_status": "ok", "daily_budget": 5, "max_cpc": 0.25, "is_new_account": False,
                             "final_url_is_affiliate": True}, ["go", "hold"], "go", ("M8",)),
        ("anomaly.escalate", {"account_status": "suspended", "disapprovals": 0, "spend_today": 1, "spend_avg_7d": 1}, ["continue", "pause_all", "escalate"], "pause_all", ("M1", "M2", "M8")),
        ("anomaly.escalate", {"account_status": "ok", "disapprovals": 1, "spend_today": 1, "spend_avg_7d": 1}, ["continue", "pause_all", "escalate"], "escalate", ("M1", "M2")),
        ("conversion.upload", {"rows_in_window": 3, "rows_out_of_window": 0, "gclid_all_valid": True, "reconciled": True}, ["upload", "hold"], "upload", ("M1", "M2")),
        ("conversion.upload", {"rows_in_window": 3, "rows_out_of_window": 0, "gclid_all_valid": True, "reconciled": False}, ["upload", "hold"], "hold", ("M1", "M2")),
        ("offer.select", {}, [{"id": "none"}, {"id": "a", "data": {"epc": 8, "ppc_allowed": True, "category": "software", "reversal_rate": 0.1, "cookie_days": 30,
                                                                  "keywords": [{"text": "a review", "volume": 500, "cpc_low": 0.05, "cpc_high": 0.2}]}},
                             {"id": "d", "data": {"epc": 90, "epc_3m": 60, "ppc_allowed": True, "category": "software", "fx": 7.8,
                                                  "keywords": [{"text": "d brand", "volume": 9000, "cpc_low": 7.84, "cpc_high": 20.9}]}},
                             {"id": "b", "data": {"epc": 20, "ppc_allowed": False, "category": "software"}},
                             {"id": "c", "data": {"epc": 50, "ppc_allowed": True, "category": "gambling"}}], "a", ("M1", "M2")),
    ]
    fails = 0
    for node, st, ch, want_choice, want_modes in cases:
        choices = [c if isinstance(c, dict) else {"id": c} for c in ch]
        evidence = ev if len(st) > 2 or node == "offer.select" else []
        r = judge(node, st, choices, cfg=cfg, soul=soul, evidence=evidence, provider="local")
        ok = (want_choice is None or r["choice"] == want_choice) and r["mode_local"] in want_modes
        if not ok:
            fails += 1
        print("%s %-18s choice=%-10s mode=%s%s  %s" % ("ok  " if ok else "FAIL", node, r["choice"], r["mode_local"],
                                                       " boundary=" + r["boundary_hit"] if r.get("boundary_hit") else "", r["judge"]["reason"]))
    # 谁拿主意：用户说了照做（判断当建议），合规姿态例外
    u_cases = [
        ("user overrides hold", "campaign.launch", {"spec_valid": False, "lp_published": True, "account_status": "ok", "daily_budget": 5, "max_cpc": 0.25,
                                                    "is_new_account": False, "user_decision": "go"}, ["go", "hold"], ("go", "user", True, "hold")),
        ("user picks offer that fails economics", "offer.select", {"user_decision": "d"},
         [{"id": "none"}, {"id": "d", "data": {"epc": 90, "fx": 7.8, "keywords": [{"text": "d x", "volume": 900, "cpc_low": 9.0}]}}], ("d", "user", True, "none")),
        ("user overrides operational boundary", "campaign.launch", {"spec_valid": True, "lp_published": True, "account_status": "ok", "daily_budget": 5, "max_cpc": 0.25,
                                                                    "is_new_account": False, "final_url_is_affiliate": True, "user_decision": "go"}, ["go", "hold"], ("go", "user", True, None)),
        ("compliance holds even if user says", "anomaly.escalate", {"account_status": "suspended", "disapprovals": 0, "spend_today": 1, "spend_avg_7d": 1,
                                                                    "user_decision": "continue"}, ["continue", "pause_all", "escalate"], ("pause_all", "compliance", False, None)),
        ("no user: judge decides", "campaign.launch", {"spec_valid": False, "lp_published": True, "account_status": "ok", "daily_budget": 5, "max_cpc": 0.25,
                                                       "is_new_account": False}, ["go", "hold"], ("hold", "judge", None, None)),
    ]
    for name, node, st, ch, (wc, wby, wex, wadv) in u_cases:
        choices = [c if isinstance(c, dict) else {"id": c} for c in ch]
        r = judge(node, st, choices, cfg=cfg, soul=soul, evidence=ev, provider="local")
        ok = r["choice"] == wc and r["decided_by"] == wby and (wex is None or r["executes"] is wex) and (wadv is None or (r.get("advice") or {}).get("choice") == wadv)
        if not ok:
            fails += 1
        print("%s %-40s choice=%-10s by=%-10s executes=%s advice=%s" % ("ok  " if ok else "FAIL", name, r["choice"], r["decided_by"], r["executes"], (r.get("advice") or {}).get("choice")))
    # schema 校验
    try:
        from validate import load_schema, validate as _validate
        errs = _validate(load_schema("judgment.schema.json"), r)
        if errs:
            fails += 1
            print("FAIL response schema: %s" % errs[:3])
        else:
            print("ok   response schema")
    except ImportError:
        print("skip schema (validate.py not importable)")
    # f_v5 抽查：与规范 §4 示例一致
    ex = {"int": 0.80, "cap": 0.60, "csq": 0.70, "rel": 0.55, "cer": 0.90, "aut": 0.75, "rev": 0.85, "evd": 0.80, "sov": 0.95, "ine": 0.60, "ext": 0.90}
    if f_v5(ex) != "M2":
        fails += 1; print("FAIL f_v5 spec example expected M2 got %s" % f_v5(ex))
    else:
        print("ok   f_v5 spec example -> M2")
    print("selftest: %d failed" % fails)
    return 1 if fails else 0


def main(argv):
    if "--selftest" in argv:
        sp = argv[argv.index("--soul") + 1] if "--soul" in argv else "soul/default.soul.md"
        return selftest(sp)
    args = {}
    i = 0
    while i < len(argv):
        if argv[i].startswith("--") and i + 1 < len(argv):
            args[argv[i][2:]] = argv[i + 1]; i += 2
        else:
            i += 1
    if "node" not in args or "state" not in args or "choices" not in args:
        print(__doc__); return 1
    cfg = {}
    cp = args.get("config", os.path.join(ROOT, "config", "adspilot.json"))
    if os.path.exists(cp):
        cfg = json.load(open(cp, encoding="utf-8"))
    state = json.load(open(args["state"], encoding="utf-8"))
    choices = json.load(open(args["choices"], encoding="utf-8"))
    evidence = args.get("evidence", "").split(",") if args.get("evidence") else []
    resp = judge(args["node"], state, choices, cfg=cfg, evidence=evidence, provider=args.get("provider"))
    print(json.dumps(resp, ensure_ascii=False, indent=2))
    sys.stderr.write(to_judge_text(resp) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
