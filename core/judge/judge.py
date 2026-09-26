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
import copy
import inspect
import json
import os
import re
import shutil
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
# SOUL 里按 money_unit（美元）写的金额；读 SOUL 时按 config.fx 折成广告账户币种。
# offer.min_epc 不折算：它和联盟给的 EPC 同一币种（美元），offer_economics 里已经用 fx 换过。
MONEY_FIELDS = [("cpc", "start"), ("cpc", "cap"), ("cpc", "watch"), ("budget", "first_day"), ("budget", "daily_cap"),
                ("stop_loss", "spend_no_conversion"), ("stop_loss", "test_spend_total"), ("user_decision", "max_extra_spend")]


def load_soul(path, cfg=None):
    """读 *.soul.md：json soul-params 围栏 + ::BOUNDARY 行。
    cfg 为 None（或不带 currency）：金额原样，soul["currency"] = money_unit（兼容旧调用与单测）。
    否则按 cfg["fx"] 把 MONEY_FIELDS 从 money_unit 折成 cfg["currency"]；币种不在 fx 里就报错，不带着错的钱跑。"""
    p = path if os.path.isabs(path) else os.path.join(ROOT, path)
    txt = open(p, "r", encoding="utf-8").read()
    m = re.search(r"```json soul-params\s*\n(.*?)\n```", txt, re.S)
    if not m:
        raise ValueError("SOUL 缺 ```json soul-params 围栏: %s" % path)
    params_usd = json.loads(m.group(1))
    unit = params_usd.get("money_unit", "USD")
    boundaries = parse_boundaries(txt, path)
    if not cfg or not cfg.get("currency"):
        params, cur = params_usd, unit
    else:
        cur = cfg["currency"]
        fx = cfg.get("fx") or {}
        for c in (cur, unit):
            if not isinstance(fx.get(c), (int, float)) or float(fx[c]) <= 0:
                raise ValueError("config.fx 缺 %s" % c)
        rate = float(fx[cur]) / float(fx[unit])
        params = copy.deepcopy(params_usd)
        for sec, key in MONEY_FIELDS:
            if isinstance(params.get(sec), dict) and isinstance(params[sec].get(key), (int, float)):
                params[sec][key] = round(float(params[sec][key]) * rate, 2)
    return {"path": path, "params": params, "params_usd": params_usd, "currency": cur, "money_unit": unit,
            "boundaries": boundaries, "id": "%s@%s" % (params_usd.get("soul", "?"), params_usd.get("version", "?"))}


def cap(caps, key, fallback):
    """用户的绝对上限（广告账户币种）；没填（缺或 null）就用 fallback（SOUL 折算后的默认值）。"""
    v = (caps or {}).get(key)
    return float(v) if v is not None else float(fallback)


def bid_cap_for(state, caps, p):
    """出价上限 = min(本 offer 的 bid_cap, config.caps.max_cpc)；两个都没有时用 SOUL 的 cpc.cap（已折算）。"""
    cands = [float(x) for x in ((state or {}).get("bid_cap"), (caps or {}).get("max_cpc")) if x is not None]
    return min(cands) if cands else float(p["cpc"]["cap"])


# ------------------------------------------------------------------ 边界
# 合规姿态：用户说了也不做（怎么投）。其余是运营边界：Agent 自己拿主意时不越过，用户明确说了就照做。
# 五个内置边界写在代码里，不依赖 SOUL，删不掉；SOUL 的 ::BOUNDARY 行用 builtin:<名字> 对上它们，自定义行用 when 让代码执行。
BUILTIN_KIND = {"forbidden_action": "compliance", "account_suspended_or_limited": "compliance",
                "test_spend_total_exceeded_without_human_confirmation": "operational",
                "upload_unreconciled_conversions": "operational", "affiliate_link_as_final_url": "operational"}
KINDS = ("operational", "compliance")
_COND = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)(>=|<=|!=|==|>|<)(.+)$")
_NUM = re.compile(r"^-?[0-9]+(?:\.[0-9]+)?$")
_WORD = re.compile(r"^[A-Za-z0-9_.-]+$")
_ITEM = re.compile(r"^[A-Za-z0-9_.:-]+$")


def _split_fields(body):
    """按 | 切字段；双引号里的 | 不切。"""
    out, cur, quoted = [], [], False
    for ch in body:
        if ch == '"':
            quoted = not quoted
        if ch == "|" and not quoted:
            out.append("".join(cur)); cur = []
        else:
            cur.append(ch)
    if quoted:
        raise ValueError("引号没闭合")
    out.append("".join(cur))
    return out


def _parse_cond(text):
    m = _COND.match(text.strip())
    if not m:
        raise ValueError("条件写法不对: %r（写成 <state字段><op><字面量>，op 是 >= <= != == > <）" % text)
    field, op, lit = m.groups()
    if _NUM.match(lit):
        return {"field": field, "op": op, "value": float(lit)}
    if lit in ("true", "false") or _WORD.match(lit):
        if op not in ("==", "!="):
            raise ValueError("条件 %r：true、false 与文字只能配 == 或 !=" % text)
        return {"field": field, "op": op, "value": (lit == "true") if lit in ("true", "false") else lit}
    raise ValueError("条件 %r：字面量只能是数字、true、false 或 [A-Za-z0-9_.-]+" % text)


def _parse_list(text, what):
    items = [x.strip() for x in text.split(",")]
    for x in items:
        if not x or not _ITEM.match(x):
            raise ValueError("%s 里有写坏的项: %r" % (what, text))
        if what == "nodes" and x not in NODES:
            raise ValueError("nodes 里的 %r 不是决策节点（%s）" % (x, ", ".join(NODES)))
    return items


def parse_boundary(line):
    """一行 ::BOUNDARY{never:<名字>|when:<条件>[&<条件>...]|nodes:<n1,n2>|choices:<c1,c2>|kind:operational|compliance|builtin:<内置名>|scope:...}"""
    m = re.match(r"^::BOUNDARY\{(.*)\}\s*$", line.rstrip("\n"))
    if not m:
        raise ValueError("BOUNDARY 行要以 } 结尾")
    f = {}
    for part in _split_fields(m.group(1)):
        if ":" not in part:
            raise ValueError("字段 %r 没有冒号" % part)
        k, v = (x.strip() for x in part.split(":", 1))
        if len(v) >= 2 and v[0] == v[-1] == '"':
            v = v[1:-1]
        if k in f:
            raise ValueError("字段 %s 写了两次" % k)
        f[k] = v
    if not f.get("never"):
        raise ValueError("缺 never:<名字>")
    if "kind" in f and f["kind"] not in KINDS:
        raise ValueError("kind 只能是 operational 或 compliance，写的是 %r" % f["kind"])
    builtin = f.get("builtin") or None
    if "builtin" in f:
        if builtin not in BUILTIN_KIND:
            raise ValueError("builtin 只能是 %s，写的是 %r" % (", ".join(BUILTIN_KIND), f["builtin"]))
        if "kind" in f and f["kind"] != BUILTIN_KIND[builtin]:
            raise ValueError("builtin:%s 的 kind 是 %s，SOUL 里不能改" % (builtin, BUILTIN_KIND[builtin]))
    if "when" in f and not f["when"]:
        raise ValueError("when 是空的")
    conds = [_parse_cond(c) for c in f["when"].split("&")] if f.get("when") else []
    kind = BUILTIN_KIND[builtin] if builtin else f.get("kind", "operational")
    return {"name": f["never"], "conds": conds, "nodes": _parse_list(f["nodes"], "nodes") if "nodes" in f else [],
            "choices": _parse_list(f["choices"], "choices") if "choices" in f else [], "kind": kind, "builtin": builtin,
            "enforced": bool(conds) or bool(builtin)}


def parse_boundaries(txt, path=""):
    """SOUL 里行首的 ::BOUNDARY 行，按文件顺序；``` 围栏里的是示例，不算。写坏一行就抛 ValueError，坏 SOUL 不许静默跑。"""
    out, fence = [], False
    for i, line in enumerate(txt.splitlines(), 1):
        if line.startswith("```"):
            fence = not fence
            continue
        if fence or not line.startswith("::BOUNDARY{"):
            continue
        try:
            out.append(parse_boundary(line))
        except ValueError as e:
            raise ValueError("SOUL %s 第 %d 行 ::BOUNDARY 写坏了: %s" % (path, i, e))
    return out


def _cond_true(c, st):
    """字段缺失或类型对不上 ⇒ 这个条件为假（不命中）。不求值任何表达式。"""
    x = st.get(c["field"])
    if x is None:
        return False
    op, v = c["op"], c["value"]
    if isinstance(v, bool):
        return isinstance(x, bool) and ((x == v) if op == "==" else (x != v))
    if isinstance(v, float):
        if isinstance(x, bool):
            return False
        try:
            x = float(x)
        except (TypeError, ValueError):
            return False
        if op == ">=":
            return x >= v
        if op == "<=":
            return x <= v
        if op == ">":
            return x > v
        if op == "<":
            return x < v
        return (x == v) if op == "==" else (x != v)
    return (str(x) == v) if op == "==" else (str(x) != v)


def _builtin_hit(node, state, choice, soul):
    """五个内置边界（原逻辑不动）。"""
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


def boundary_hit(node, state, choice, soul):
    """命中边界返回 (名字, kind)，否则 None；命中则模式强制 M8。
    先查五个内置边界，再按文件顺序查 SOUL 里有 when、没有 builtin 的自定义行（nodes、choices 不写 = 全部）。"""
    b = _builtin_hit(node, state, choice, soul)
    if b:
        return b, BUILTIN_KIND[b]
    st = state or {}
    for row in soul.get("boundaries") or []:
        if not isinstance(row, dict) or not row.get("enforced") or row.get("builtin"):
            continue
        if (row["nodes"] and node not in row["nodes"]) or (row["choices"] and choice not in row["choices"]):
            continue
        if all(_cond_true(c, st) for c in row["conds"]):
            return row["name"], row["kind"]
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
        return float(state.get("daily_budget", 0)) <= cap(caps, "daily_budget", p["budget"]["daily_cap"]) and \
            float(state.get("max_cpc", 0)) <= bid_cap_for(state, caps, p)
    if choice == "budget_up":
        nb = float(state.get("daily_budget", 0)) * (1 + p["budget"]["step_pct"] / 100.0)
        return nb <= cap(caps, "daily_budget", p["budget"]["daily_cap"])
    return True


def offer_economics(d, p):
    """offer.select 第一条：词的出价 < 每次点击赚的钱。
    d：offer 的 data，含 epc、epc_3m（联盟给的每百次点击收益，联盟币种）、fx（广告账户币种每 1 联盟币种）、
       keywords（关键词插件的行：text、volume、cpc_low、cpc_high，广告账户币种）。
    返回 {epc_per_click, bid_cap, passing:[词], checked, best, ok, why}。
    过线条件：词的出价 < bid_cap = 每次点击赚的钱 × max_bid_ratio。bid_cap 也是这个 offer 的系列出价上限，两处同一个数。"""
    o = p["offer"]
    e7, e3 = d.get("epc"), d.get("epc_3m")
    vals = [float(x) for x in (e7, e3) if x is not None]
    if not vals:
        return {"ok": False, "why": "no_epc", "passing": [], "checked": 0}
    basis = o.get("epc_basis", "min_7d_3m")
    epc = min(vals) if basis == "min_7d_3m" else (float(e3) if basis == "3m" and e3 is not None else float(vals[0]))
    epc_per_click = epc / 100.0 * float(d.get("fx") or 1.0)
    bid_cap = epc_per_click * float(o.get("max_bid_ratio", 1.0))
    kws = d.get("keywords")
    if not kws:
        return {"ok": False, "why": "no_keyword_data", "epc_per_click": round(epc_per_click, 2), "bid_cap": round(bid_cap, 2), "passing": [], "checked": 0}
    metric = o.get("bid_metric", "cpc_low")
    min_vol = int(o.get("min_keyword_searches", 50))
    brand_ok = d.get("brand_bidding_allowed") is True
    checked = [k for k in kws if float(k.get(metric) or 0) > 0 and int(k.get("volume") or 0) >= min_vol and (brand_ok or not k.get("brand"))]
    passing = sorted([k for k in checked if float(k[metric]) < bid_cap], key=lambda k: (-int(k.get("volume") or 0), float(k[metric])))
    best = passing[0] if passing else (min(checked, key=lambda k: float(k[metric])) if checked else None)
    why = "bid_below_epc_%d_of_%d" % (len(passing), len(checked)) if passing else ("cheapest_bid_%.2f_over_epc_%.2f" % (float(best[metric]), bid_cap) if best else "no_keyword_with_bid_and_volume")
    return {"ok": bool(passing), "why": why, "epc_per_click": round(epc_per_click, 2), "bid_cap": round(bid_cap, 2), "metric": metric, "checked": len(checked),
            "passing": [{"text": k["text"], "volume": k.get("volume"), metric: k[metric], "brand": k.get("brand", False)} for k in passing],
            "best": {"text": best["text"], metric: best[metric], "volume": best.get("volume")} if best else None}


def local_choice(node, state, choices, soul, caps=None):
    """默认 SOUL 的规则，按 soul/default.soul.md 节点一节的顺序。返回 (choice_id, reason)。金额都是广告账户币种（load_soul 已折算）。"""
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
        if float(st.get("max_cpc", 0)) > bid_cap_for(st, caps, p):
            return pick("hold", "max_cpc_over_cap")
        if st.get("is_new_account") and float(st.get("daily_budget", 0)) > cap(caps, "first_day_budget", p["budget"]["first_day"]):
            return pick("hold", "new_account_budget_over_first_day")
        return pick("go", "spec_valid_lp_published_within_caps")

    if node == "campaign.adjust":
        if float(st.get("spend_total", 0)) >= p["stop_loss"]["test_spend_total"]:
            return pick("pause", "test_spend_total_reached_escalate")
        if float(st.get("avg_cpc", 0)) > bid_cap_for(st, caps, p):
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
        if float(st.get("avg_cpc", 0)) > bid_cap_for(st, caps, p):
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
    choice, reason = local_choice(node, state, choices, soul, caps)
    v = local_vector(node, state, choice, caps, evidence, cfg, soul)
    return {"v": v, "choice": choice, "conf": 0.70, "reason": reason[:120]}


# ------------------------------------------------------------------ 插件提供者
def call_provider(provider, request, cfg, timeout_s, soul_path=None):
    """调判断插件：stdin 进 request，argv 带 --config <judgment 配置> 和 --soul <这次用的 SOUL 路径>（契约 RULE）。"""
    d = os.path.join(ROOT, "plugins", "judgment", provider)
    m = json.load(open(os.path.join(d, "manifest.json"), encoding="utf-8"))
    script = os.path.join(d, m["actions"]["judge"])
    t0 = time.time()
    argv = [sys.executable, script, "--config", json.dumps(cfg.get("judgment", {}))]
    if soul_path:
        argv += ["--soul", soul_path]
    out = subprocess.run(argv,
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
    soul = soul or load_soul(cfg.get("soul", "soul/default.soul.md"), cfg)
    if cfg.get("currency") and soul.get("currency") and soul["currency"] != cfg["currency"]:
        raise ValueError("SOUL 金额是 %s，config.currency 是 %s：load_soul 要带上 cfg" % (soul["currency"], cfg["currency"]))
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
            res = call_provider(provider, request, cfg, timeout_s, soul.get("path"))
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
    hit = boundary_hit(node, state, perc["choice"], soul)
    if hit:
        mode_local = "M8"
    judge_block = {"judge": "v5.0", "v": perc["v"], "mode": mode_local, "conf": perc["conf"], "reason": perc["reason"]}
    resp = {"type": "judgment.response", "schema_version": 1, "id": request["id"], "node": node,
            "choice": perc["choice"], "confidence": perc["conf"], "judge": judge_block, "mode_local": mode_local,
            "provider": used, "fallback": fallback}
    if hit:
        resp["boundary_hit"], resp["boundary_kind"] = hit
    # 谁拿主意：用户明确说了就照做，判断照算作为建议；合规姿态例外
    user = (state or {}).get("user_decision")
    ids = [c["id"] for c in choices]
    if user:
        resp["user_choice"] = str(user)[:64]
        uh = boundary_hit(node, state, user, soul) if user in ids else None
        if user not in ids:
            resp.update({"decided_by": "judge", "executes": acts(mode_local)})
            resp["advice"] = {"choice": perc["choice"], "mode": mode_local, "reason": "user_choice_not_in_choices"}
        elif uh and uh[1] == "compliance":
            resp.update({"decided_by": "compliance", "executes": False})
            resp["advice"] = {"choice": perc["choice"], "mode": "M8", "reason": "compliance_boundary", "boundary_hit": uh[0]}
        else:
            adv = {"choice": perc["choice"], "mode": mode_local, "reason": perc["reason"]}
            if uh or hit:
                adv["boundary_hit"] = (uh or hit)[0]
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


# ------------------------------------------------------------------ 顺序守卫
# campaign.adjust 的规则第一条命中即停；SOUL 文档写的顺序与 local_choice 的代码顺序必须一致。
ADJUST_ORDER_DOC = ("test_spend_total", "出价上限", "spend_no_conversion", "roi_floor", "budget_up")
ADJUST_ORDER_CODE = ("test_spend_total", "bid_cap_for", "spend_no_conversion", "roi_floor", "budget_up")


def adjust_order_guard(soul_text):
    """SOUL 的 ### campaign.adjust 一节里，五个关键词第一次出现的位置严格递增。"""
    m = re.search(r"^### campaign\.adjust.*?(?=^### |^## |\Z)", soul_text, re.S | re.M)
    if not m:
        return False, "no ### campaign.adjust section"
    pos = [m.group(0).find(k) for k in ADJUST_ORDER_DOC]
    return all(x >= 0 for x in pos) and all(a < b for a, b in zip(pos, pos[1:])), pos


def adjust_order_guard_code():
    """local_choice 里 campaign.adjust 分支的五条规则按同一顺序出现。"""
    src = inspect.getsource(local_choice)
    seg = src[src.index('if node == "campaign.adjust"'):src.index('if node == "keyword.action"')]
    pos = [seg.find(k) for k in ADJUST_ORDER_CODE]
    return all(x >= 0 for x in pos) and all(a < b for a, b in zip(pos, pos[1:])), pos


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
    seen = []   # (choice, mode, decided_by, executes) 逐条，给 T1-d 对照
    for node, st, ch, want_choice, want_modes in cases:
        choices = [c if isinstance(c, dict) else {"id": c} for c in ch]
        evidence = ev if len(st) > 2 or node == "offer.select" else []
        r = judge(node, st, choices, cfg=cfg, soul=soul, evidence=evidence, provider="local")
        seen.append((r["choice"], r["mode_local"], r.get("decided_by"), r.get("executes")))
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
        seen.append((r["choice"], r["mode_local"], r.get("decided_by"), r.get("executes")))
        ok = r["choice"] == wc and r["decided_by"] == wby and (wex is None or r["executes"] is wex) and (wadv is None or (r.get("advice") or {}).get("choice") == wadv)
        if not ok:
            fails += 1
        print("%s %-40s choice=%-10s by=%-10s executes=%s advice=%s" % ("ok  " if ok else "FAIL", name, r["choice"], r["decided_by"], r["executes"], (r.get("advice") or {}).get("choice")))
    # ---- T1：钱有单位，出价只有一条规则 ----
    def t(name, ok, detail=""):
        nonlocal fails
        if not ok:
            fails += 1
        print("%s %-44s %s" % ("ok  " if ok else "FAIL", name, detail))
    base_cfg = json.load(open(os.path.join(ROOT, "config", "adspilot.example.json"), encoding="utf-8"))
    hk = dict(base_cfg, currency="HKD")
    soul_hk = load_soul(soul_path, hk)
    C = lambda *x: [{"id": i} for i in x]  # noqa: E731
    r1_state = {"days_running": 7, "spend_total": 140, "spend_window": 140, "clicks": 40, "avg_cpc": 3.5, "conversions": 3, "commission": 400,
                "last_change_days": 3, "bid_cap": 4.56}
    r1 = judge("campaign.adjust", r1_state, C("keep", "bid_down", "budget_up", "budget_down", "pause"), cfg=hk, soul=soul_hk, evidence=["r"], provider="local")
    t("T1-a HKD 赚钱的系列 ⇒ budget_up", r1["choice"] == "budget_up" and r1["mode_local"] in ("M1", "M2"), "%s %s %s" % (r1["choice"], r1["mode_local"], r1["judge"]["reason"]))
    r2_ = judge("campaign.launch", {"spec_valid": True, "lp_published": True, "account_status": "ok", "daily_budget": 5, "max_cpc": 3.79, "is_new_account": True,
                                    "bid_cap": 4.56}, C("go", "hold"), cfg=hk, soul=soul_hk, evidence=["r"], provider="local")
    t("T1-b HKD 过线词出价建系列 ⇒ go", r2_["choice"] == "go" and r2_["mode_local"] in ("M1", "M2"), "%s %s %s" % (r2_["choice"], r2_["mode_local"], r2_["judge"]["reason"]))
    r1c = judge("campaign.adjust", {k: v for k, v in r1_state.items() if k != "bid_cap"}, C("keep", "bid_down", "budget_up", "budget_down", "pause"),
                cfg=hk, soul=soul_hk, evidence=["r"], provider="local")
    t("T1-c HKD 无 bid_cap ⇒ 兜底 cpc.cap 折算后 bid_down", r1c["choice"] == "bid_down" and r1c["judge"]["reason"] == "avg_cpc_over_cap" and abs(soul_hk["params"]["cpc"]["cap"] - 1.95) < 0.001,
      "%s %s cap=%s" % (r1c["choice"], r1c["judge"]["reason"], soul_hk["params"]["cpc"]["cap"]))
    # T1-d：USD 配置（fx.USD=1.0）重跑上面 12 个判断用例与 5 个用户用例，逐条与无配置时一致
    usd = {"currency": "USD", "fx": {"USD": 1.0}, "caps": cfg["caps"], "judgment": cfg["judgment"]}
    soul_usd = load_soul(soul_path, usd)
    again = []
    for node, st, ch, _, _ in cases:
        choices = [c if isinstance(c, dict) else {"id": c} for c in ch]
        evidence = ev if len(st) > 2 or node == "offer.select" else []
        r_ = judge(node, st, choices, cfg=usd, soul=soul_usd, evidence=evidence, provider="local")
        again.append((r_["choice"], r_["mode_local"], r_.get("decided_by"), r_.get("executes")))
    for _, node, st, ch, _ in u_cases:
        choices = [c if isinstance(c, dict) else {"id": c} for c in ch]
        r_ = judge(node, st, choices, cfg=usd, soul=soul_usd, evidence=ev, provider="local")
        again.append((r_["choice"], r_["mode_local"], r_.get("decided_by"), r_.get("executes")))
    diff = [i for i, (a, b) in enumerate(zip(seen, again)) if a != b]
    t("T1-d USD 配置下 %d+%d 个用例逐条不变" % (len(cases), len(u_cases)), len(seen) == len(again) == len(cases) + len(u_cases) and not diff, "diff=%s" % diff)
    try:
        load_soul(soul_path, {"currency": "EUR", "fx": {"USD": 1.0, "HKD": 7.8}})
        t("T1-e currency 不在 fx ⇒ ValueError", False, "没有抛")
    except ValueError as e:
        t("T1-e currency 不在 fx ⇒ ValueError", "EUR" in str(e), str(e))
    offer = {"epc": 117.34, "epc_3m": 58.43, "fx": 7.8, "keywords": [{"text": "a", "volume": 900, "cpc_low": 3.5}, {"text": "b", "volume": 900, "cpc_low": 3.79},
                                                                   {"text": "c", "volume": 900, "cpc_low": 4.0}]}
    e10 = offer_economics(offer, soul_hk["params"])
    p08 = copy.deepcopy(soul_hk["params"]); p08["offer"]["max_bid_ratio"] = 0.8
    e08 = offer_economics(offer, p08)
    t("T1-f max_bid_ratio 0.8 ⇒ 过线词与 bid_cap 一起收紧", len(e10["passing"]) == 3 and abs(e10["bid_cap"] - 4.56) < 0.01 and len(e08["passing"]) == 1 and abs(e08["bid_cap"] - 3.65) < 0.01,
      "1.0: %d 词 cap %s | 0.8: %d 词 cap %s" % (len(e10["passing"]), e10["bid_cap"], len(e08["passing"]), e08["bid_cap"]))
    # ---- T3：SOUL 是变量，换了就要生效 ----
    import tempfile
    tmpd = tempfile.mkdtemp(prefix="adspilot-soul-")
    sp_abs = soul_path if os.path.isabs(soul_path) else os.path.join(ROOT, soul_path)
    base_txt = open(sp_abs, encoding="utf-8").read()

    def tmp_soul(name, txt):
        p = os.path.join(tmpd, name + ".soul.md")
        with open(p, "w", encoding="utf-8") as f:
            f.write(txt)
        return p

    def t3(name, fn):
        try:
            ok, detail = fn()
        except Exception as e:  # noqa: BLE001
            ok, detail = False, "%s: %s" % (type(e).__name__, str(e)[:160])
        t(name, ok, detail)

    ADJ = C("keep", "bid_down", "budget_up", "budget_down", "pause")
    st_a = {"days_running": 3, "spend_total": 30, "spend_window": 30, "clicks": 10, "avg_cpc": 3, "conversions": 0, "commission": 0,
            "last_change_days": 3, "bid_cap": 5}
    custom = "::BOUNDARY{never:cpc_hard_stop|when:avg_cpc>2&conversions==0|nodes:campaign.adjust|choices:keep,budget_up|kind:%s}\n"
    lcfg = {"judgment": {"provider": "local"}}

    def t3a():
        s = load_soul(tmp_soul("op", base_txt + "\n" + custom % "operational"))
        r = judge("campaign.adjust", st_a, ADJ, cfg=lcfg, soul=s, evidence=["r"], provider="local")
        low = judge("campaign.adjust", dict(st_a, avg_cpc=1.5), ADJ, cfg=lcfg, soul=s, evidence=["r"], provider="local")   # 条件不成立
        kw = boundary_hit("keyword.action", {"avg_cpc": 3, "conversions": 0}, "keep", s)                                      # 节点不在 nodes 里
        miss = boundary_hit("campaign.adjust", {"avg_cpc": 3}, "keep", s)                                                     # 字段缺失 ⇒ 条件为假
        ok = (r["choice"] == "keep" and r.get("boundary_hit") == "cpc_hard_stop" and r.get("boundary_kind") == "operational" and r["mode_local"] == "M8"
              and not low.get("boundary_hit") and kw is None and miss is None)
        return ok, "choice=%s hit=%s kind=%s mode=%s | 条件假=%s 别的节点=%s 缺字段=%s" % (
            r["choice"], r.get("boundary_hit"), r.get("boundary_kind"), r["mode_local"], low.get("boundary_hit"), kw, miss)
    t3("T3-a 自定义边界命中 ⇒ M8", t3a)

    def t3b():
        s = load_soul(tmp_soul("op", base_txt + "\n" + custom % "operational"))
        r = judge("campaign.adjust", dict(st_a, user_decision="keep"), ADJ, cfg=lcfg, soul=s, evidence=["r"], provider="local")
        adv = r.get("advice") or {}
        return (r["choice"] == "keep" and r.get("decided_by") == "user" and r.get("executes") is True and adv.get("boundary_hit") == "cpc_hard_stop",
                "choice=%s by=%s executes=%s advice.boundary_hit=%s" % (r["choice"], r.get("decided_by"), r.get("executes"), adv.get("boundary_hit")))
    t3("T3-b operational 用户说了 ⇒ 照做 边界记进建议", t3b)

    def t3c():
        s = load_soul(tmp_soul("cp", base_txt + "\n" + custom % "compliance"))
        r = judge("campaign.adjust", dict(st_a, user_decision="keep"), ADJ, cfg=lcfg, soul=s, evidence=["r"], provider="local")
        return (r.get("decided_by") == "compliance" and r.get("executes") is False and r.get("boundary_kind") == "compliance",
                "by=%s executes=%s kind=%s" % (r.get("decided_by"), r.get("executes"), r.get("boundary_kind")))
    t3("T3-c compliance 用户说了也不放行", t3c)

    def t3d():
        stripped = "".join(l for l in base_txt.splitlines(True) if not l.startswith("::BOUNDARY{"))
        s = load_soul(tmp_soul("nob", stripped))
        want = [("anomaly.escalate", {"account_status": "suspended"}, "continue", "account_suspended_or_limited", "compliance"),
                ("campaign.adjust", {"spend_total": 400}, "keep", "test_spend_total_exceeded_without_human_confirmation", "operational"),
                ("conversion.upload", {"reconciled": False}, "upload", "upload_unreconciled_conversions", "operational"),
                ("campaign.launch", {"final_url_is_affiliate": True}, "go", "affiliate_link_as_final_url", "operational"),
                ("campaign.launch", {"requested_action": "cloaking"}, "go", "forbidden_action", "compliance")]
        got = [boundary_hit(n, st, ch, s) for n, st, ch, _, _ in want]
        ok = len(s["boundaries"]) == 0 and all(g == (w[3], w[4]) for g, w in zip(got, want))
        return ok, "SOUL 边界行=%d 命中=%s" % (len(s["boundaries"]), [g[0] if isinstance(g, tuple) else g for g in got])
    t3("T3-d SOUL 删光边界行 ⇒ 五个内置照样命中", t3d)

    def t3e():
        bad = {"avg_cpc>>2": "::BOUNDARY{never:bad|when:avg_cpc>>2|kind:operational}",
               "kind:foo": "::BOUNDARY{never:bad|when:avg_cpc>2|kind:foo}",
               "nodes 拼错": "::BOUNDARY{never:bad|when:avg_cpc>2|nodes:campaign.adjst}",
               "布尔配 >": "::BOUNDARY{never:bad|when:disapproved>true}",
               "builtin 名字不存在": "::BOUNDARY{never:bad|builtin:no_such}",
               "builtin 改 kind": "::BOUNDARY{never:bad|builtin:forbidden_action|kind:operational}"}
        raised = {}
        for k, line in bad.items():
            try:
                load_soul(tmp_soul("bad", base_txt + "\n" + line + "\n"))
                raised[k] = False
            except ValueError:
                raised[k] = True
        return all(raised.values()), " ".join("%s=%s" % (k, "ValueError" if v else "没抛") for k, v in raised.items())
    t3("T3-e 写坏的 when ⇒ load_soul 抛 ValueError", t3e)

    def t3f():
        # 整条链：judge → call_provider 带 --soul → 插件 → 本机假端点（127.0.0.1，不出网）
        import http.server
        import threading
        marker = "T3F_MARKER_7c1e"
        mtxt = base_txt.replace("### campaign.adjust（每日）\n", "### campaign.adjust（每日）\n\n::RULE{%s}\n" % marker, 1)
        mp = tmp_soul("marker", mtxt)
        seen = {}
        vec = "V:[int=0.90,cap=0.80,csq=0.75,rel=0.70,cer=0.80,aut=0.85,rev=0.90,evd=0.80,sov=1.00,ine=0.70,ext=0.90]"

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))).decode("utf-8"))
                seen[self.path] = body
                if self.path.endswith("/chat/completions"):
                    out = {"choices": [{"message": {"content": "::JUDGE{v5.0}\n%s\nM:M1|conf:0.80\nR:fake_endpoint\nCHOICE:keep\n" % vec}}]}
                elif self.path.endswith("/decide"):
                    out = {"choice": "keep", "distribution": {"keep": 0.9, "pause": 0.1}, "confidence": 0.8}
                else:
                    out = {"choice": "keep", "confidence": 0.8, "judge": {"reason": "fake_endpoint"}}
                b = json.dumps(out).encode("utf-8")
                self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b)))
                self.end_headers(); self.wfile.write(b)
        srv = http.server.HTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        url = "http://127.0.0.1:%d" % srv.server_address[1]
        env = {"LLM_BASE_URL": url, "LLM_API_KEY": "selftest-dummy", "LLM_MODEL": "selftest", "JEV_ENDPOINT": url, "JEV_API_KEY": "selftest-dummy",
               "SOUL_API_ENDPOINT": url, "SOUL_API_KEY": "selftest-dummy", "NO_PROXY": "127.0.0.1,localhost", "no_proxy": "127.0.0.1,localhost"}
        old = {k: os.environ.get(k) for k in env}
        os.environ.update(env)
        try:
            s = load_soul(mp)
            res = {}
            for prov in ("llm", "jev", "soul-api"):
                r = judge("campaign.adjust", st_a, ADJ, cfg={"soul": mp, "judgment": {"provider": prov, "timeout_s": 8}}, soul=s, evidence=["r"], provider=prov)
                res[prov] = (r["provider"], r["fallback"], r["choice"])
        finally:
            srv.shutdown(); srv.server_close()
            for k, v in old.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v
        prompt = ((seen.get("/chat/completions") or {}).get("messages") or [{}])[0].get("content", "")
        ok = all(res[p] == (p, False, "keep") for p in res) and marker in prompt
        return ok, "providers=%s llm 提示词含标记=%s" % (res, marker in prompt)
    t3("T3-f 判断插件读配置里的 SOUL（整条链）", t3f)

    def t3g():
        ok_doc, pos = adjust_order_guard(base_txt)
        ok_code, cpos = adjust_order_guard_code()
        m = re.search(r"^### campaign\.adjust.*?(?=^### |^## |\Z)", base_txt, re.S | re.M)
        sec = m.group(0)
        rules = [l for l in sec.splitlines(True) if l.startswith("::RULE{")]
        swapped_sec = sec.replace(rules[0] + rules[1], rules[1] + rules[0], 1)
        ok_sw, pos_sw = adjust_order_guard(base_txt.replace(sec, swapped_sec, 1))
        return ok_doc and ok_code and swapped_sec != sec and not ok_sw, "文档=%s %s 代码=%s %s | 1与2对调后=%s %s" % (ok_doc, pos, ok_code, cpos, ok_sw, pos_sw)
    t3("T3-g campaign.adjust 文档与代码同序", t3g)
    shutil.rmtree(tmpd, ignore_errors=True)
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
