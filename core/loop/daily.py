#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
无人值守日常循环（主干，循环部件）

一轮做八件事：自检 → 拉映射 → 拉投放报表 → 拉佣金明细 → 对账 → 逐节点判断 → 生成动作与上传文件 → 写本轮报告与记账。
每一步都幂等，都有日志；默认 dry-run，只有 config.apply 为 true 或 --apply 才对外部产生写操作。
执行 Agent 按 core/loop/使用方法.md 装到调度器里，每天跑一次。

用法：
  python3 core/loop/daily.py [--dry-run | --apply] [--config config/adspilot.json] [--run-id ID]
  python3 core/loop/daily.py --ack <run_id>          # Agent 手动做完 actions-todo 后回填 applied
  python3 core/loop/daily.py --selftest              # 用 tests/fixtures 跑一轮 dry-run

退出码：0 正常；2 需要本人出手（有 M6/M8 或 needs_human）；3 自检或外部步骤失败；4 配置缺失；1 其他。
只用标准库。
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from collections import defaultdict
from datetime import datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
for p in ("core/judge", "core/ledger", "core/selfcheck"):
    sys.path.insert(0, os.path.join(ROOT, p))
import judge as J  # noqa: E402
import subid  # noqa: E402
import reconcile as R  # noqa: E402
from validate import load_schema, validate  # noqa: E402

VERSION = open(os.path.join(ROOT, "VERSION"), encoding="utf-8").read().strip()


def anchor_key(entry):
    """用户决定的锚点键：这条决定的 node、target、choice、until、created 一样，就是同一条。"""
    return hashlib.sha1(json.dumps({k: entry.get(k) for k in ("node", "target", "choice", "until", "created")},
                                   sort_keys=True).encode("utf-8")).hexdigest()


def google_bid_of(rows):
    """一组报表行的谷歌推荐出价（首页出价估计 top_of_page_bid）：按点击加权；都没点击就平均；没有就 None。"""
    xs = [(float(r["top_of_page_bid"]), float(r.get("clicks") or 0)) for r in rows if r.get("top_of_page_bid") is not None]
    if not xs:
        return None
    w = sum(c for _, c in xs)
    return round(sum(b * c for b, c in xs) / w, 2) if w else round(sum(b for b, _ in xs) / len(xs), 2)


def latest_google_bid(rows):
    """一个词最近一天的首页出价估计；没有就 None（词只用自己的，不借别的词的）。"""
    xs = sorted((r["date"], float(r["top_of_page_bid"])) for r in rows if r.get("top_of_page_bid") is not None)
    return round(xs[-1][1], 2) if xs else None


def _date(s):
    return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()


class Run:
    def __init__(self, cfg, run_id, apply):
        self.cfg, self.run_id, self.apply = cfg, run_id, apply
        self.runs_dir = self._abs(cfg.get("runs_dir", "runs"))
        self.data_dir = self._abs(cfg.get("data_dir", "data"))
        self.dir = os.path.join(self.runs_dir, run_id)
        os.makedirs(self.dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "inbox"), exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "outbox"), exist_ok=True)
        self.log_fp = open(os.path.join(self.dir, "run.log"), "a", encoding="utf-8")
        self.con = subid.open_db(os.path.join(self.data_dir, "ledger.db"))
        self.soul = J.load_soul(cfg.get("soul", "soul/default.soul.md"), cfg)   # 金额折成 config.currency
        self.judgments, self.actions, self.evidence, self.plugins_used = [], [], [], set()
        self.needs_human = []
        self.ud_report, self._ud_seen = {"applied": [], "expired": [], "ignored": []}, set()
        self.started = subid.now_iso()

    def _abs(self, p):
        return p if os.path.isabs(p) else os.path.join(ROOT, p)

    def log(self, msg):
        line = "%s %s" % (time.strftime("%H:%M:%S"), msg)
        self.log_fp.write(line + "\n"); self.log_fp.flush()
        print(line)

    def path(self, name):
        return os.path.join(self.dir, name)

    # ---------------------------------------------------------------- 插件调用
    def plugin(self, kind, name):
        d = os.path.join(ROOT, "plugins", kind, name)
        m = json.load(open(os.path.join(d, "manifest.json"), encoding="utf-8"))
        self.plugins_used.add("%s@%s" % (m["id"], m["version"]))
        return d, m

    def run_script(self, script, args, timeout=120):
        cmd = [sys.executable, script] + args
        self.log("run: %s" % " ".join(os.path.relpath(c, ROOT) if os.path.isabs(c) else c for c in cmd[1:]))
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=ROOT)
        if out.stderr.strip():
            for l in out.stderr.strip().splitlines()[-5:]:
                self.log("  stderr: " + l)
        return out.returncode, out.stdout

    # ---------------------------------------------------------------- 步骤
    def step_selfcheck(self):
        rc, out = self.run_script(os.path.join(ROOT, "core", "agent", "selfcheck.py"), ["--quick", "--json"])
        try:
            rep = json.loads(out)
        except Exception:  # noqa: BLE001
            rep = {"verdict": "fail", "results": []}
        json.dump(rep, open(self.path("selfcheck.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        fails = [r["check"] for r in rep.get("results", []) if r["status"] == "fail"]
        self.log("selfcheck: %s %s" % (rep.get("verdict"), fails))
        return not fails

    def step_pull_mappings(self):
        dep = self.cfg.get("deploy") or {}
        url = dep.get("export_url") or subid.deploy_info().get("export_url")
        if not url:
            self.log("mappings: no export_url, skip (映射由本地 record 或 import 进账本)")
            return
        rc = subid.pull(self.con, url, dep.get("export_key_env", "ADSPILOT_EXPORT_KEY"))
        self.log("mappings pull rc=%d" % rc)

    def step_traffic_report(self):
        t = self.cfg.get("traffic") or {}
        d, m = self.plugin("traffic", t.get("plugin", "google-ads"))
        out = self.path("traffic-report.json")
        if t.get("report_source", "csv_export") == "api" and m["actions"].get("report_api"):
            rc, _ = self.run_script(os.path.join(d, m["actions"]["report_api"]), ["--out", out, "--days", "30"] + (["--apply"] if self.apply else []))
        else:
            csv = self._abs(t.get("report_csv", "data/inbox/google-ads-report.csv"))
            if not os.path.exists(csv):
                self.log("traffic report: %s 不存在，本轮无投放数据（Agent 需从后台导出）" % os.path.relpath(csv, ROOT))
                self.needs_human_note("other", "缺投放报表导出文件 %s" % os.path.relpath(csv, ROOT), soft=True)
                return None
            rc, _ = self.run_script(os.path.join(d, m["actions"]["report"]), ["--csv", csv, "--out", out])
        if rc != 0 or not os.path.exists(out):
            self.log("traffic report failed rc=%s" % rc)
            return None
        rep = json.load(open(out, encoding="utf-8"))
        errs = validate(load_schema("traffic-report.schema.json"), rep)
        if errs:
            self.log("traffic report schema errors: %s" % errs[:3]); return None
        self.evidence.append({"id": "e-traffic", "deliverable": "traffic_report", "kind": "report", "ref": os.path.relpath(out, ROOT), "result": "pass"})
        self.log("traffic report: %d rows" % len(rep["rows"]))
        return rep

    def step_commissions(self):
        a = self.cfg.get("affiliate") or {}
        d, m = self.plugin("affiliate", a.get("plugin", "cj"))
        out = self.path("commissions.json")
        src = a.get("commissions_source", "api")
        if src == "api":
            rc, _ = self.run_script(os.path.join(d, m["actions"]["commissions"]), ["--days", str(a.get("window_days", 7)), "--out", out])
            if rc == 4:
                self.log("commissions: 凭据缺失，退回 json 文件")
                src = "json"
        if src != "api":
            p = self._abs(a.get("commissions_json", "data/inbox/cj-commissions.json"))
            if not os.path.exists(p):
                self.log("commissions: %s 不存在，本轮无佣金数据" % os.path.relpath(p, ROOT))
                return None
            shutil.copyfile(p, out)
        if not os.path.exists(out):
            return None
        com = json.load(open(out, encoding="utf-8"))
        errs = validate(load_schema("commissions.schema.json"), com)
        if errs:
            self.log("commissions schema errors: %s" % errs[:3]); return None
        self.evidence.append({"id": "e-commissions", "deliverable": "commissions", "kind": "report", "ref": os.path.relpath(out, ROOT), "result": "pass"})
        self.log("commissions: %d rows" % len(com["rows"]))
        return com

    def step_reconcile(self, com):
        if not com:
            return None
        t = self.cfg.get("traffic") or {}
        out = R.reconcile(self.con, com, t.get("conversion_name", "affiliate_commission"), int(t.get("conversion_window_days", 90)), batch=self.run_id)
        json.dump(out, open(self.path("conversions.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        self.evidence.append({"id": "e-ledger", "deliverable": "reconcile", "kind": "ledger", "ref": os.path.relpath(self.path("conversions.json"), ROOT), "result": "pass"})
        self.log("reconcile: %s" % json.dumps(out["summary"]))
        return out

    # ---------------------------------------------------------------- 用户决定
    def _user_decision_params(self):
        """SOUL.user_decision：默认天数、多花多少即失效（已按 config.fx 折成账户币种）、不许写 * 的花钱节点。
        自定义 SOUL 没写这一段时用默认值：7 天、100 美元、campaign.adjust 与 keyword.action。"""
        ud = self.soul["params"].get("user_decision") or {}
        extra = ud.get("max_extra_spend")
        if not isinstance(extra, (int, float)):
            fx = self.cfg.get("fx") or {}
            cur, unit = self.soul.get("currency"), self.soul.get("money_unit", "USD")
            rate = float(fx[cur]) / float(fx[unit]) if fx.get(cur) and fx.get(unit) else 1.0
            extra = round(100.0 * rate, 2)
        return (int(ud.get("default_days", 7)), float(extra),
                set(ud.get("no_wildcard_nodes") or ["campaign.adjust", "keyword.action"]))

    def _ud_note(self, kind, node, target, choice, why=None):
        rec = {"node": node, "target": target, "choice": choice}
        if why:
            rec["why"] = why
        k = (kind, node, target, choice, why)
        if k in self._ud_seen:
            return
        self._ud_seen.add(k)
        self.ud_report[kind].append(rec)
        if kind != "applied":
            self.log("user_decision %s %s %s %s %s" % (node, target, choice, kind, why))

    def user_decision(self, node, target, state=None):
        """用户明确说过的：data/inbox/user-decisions.json（只读，循环不回写）
        {"decisions":[{"node":"campaign.adjust","target":"AP X","choice":"keep","created":"2026-09-26","until":"2026-10-31","note":"先别停"}]}
        用户回答的是说话那一刻的情况；情况变了这条就失效，交回判断：
          花钱节点（SOUL.user_decision.no_wildcard_nodes）上 target 写 * ⇒ 忽略
          过了 until（没写 until 就是 created 或第一次看到那天 + default_days）⇒ 失效
          campaign.adjust：从第一次看到起多花 max_extra_spend，或越过 stop_loss.test_spend_total ⇒ 失效
        锚点（第一次看到的日子与当时的 spend_total）只进 ledger 的 user_decision_anchor。"""
        if not hasattr(self, "_user_decisions"):
            self._user_decisions = []
            p = os.path.join(self.data_dir, "inbox", "user-decisions.json")
            if os.path.exists(p):
                try:
                    with open(p, encoding="utf-8") as f:
                        self._user_decisions = [d for d in (json.load(f).get("decisions") or []) if isinstance(d, dict)]
                except (ValueError, AttributeError):
                    self.log("user-decisions.json 读不了，忽略")
        days, max_extra, no_wild = self._user_decision_params()
        test_total = float(self.soul["params"]["stop_loss"]["test_spend_total"])
        today = datetime.now().date()
        st = state or {}
        for d in self._user_decisions:
            if d.get("node") != node or d.get("target") not in (target, "*"):
                continue
            choice = d.get("choice")
            if not choice:
                continue
            if d.get("target") == "*" and node in no_wild:
                self._ud_note("ignored", node, "*", choice, "wildcard_not_allowed_on_money_node")
                continue
            key = anchor_key(d)
            row = self.con.execute("SELECT first_seen, spend_at FROM user_decision_anchor WHERE key=?", (key,)).fetchone()
            if not row:
                spend = st.get("spend_total")
                row = (today.strftime("%Y-%m-%d"), float(spend) if isinstance(spend, (int, float)) and not isinstance(spend, bool) else None)
                self.con.execute("INSERT INTO user_decision_anchor(key, first_seen, spend_at) VALUES(?,?,?)", (key,) + row)
                self.con.commit()
            first_seen, spend_at = row
            try:
                if d.get("until"):
                    until_eff = _date(d["until"])
                else:
                    until_eff = _date(d.get("created") or first_seen) + timedelta(days=days)
            except ValueError:
                self._ud_note("ignored", node, target, choice, "bad_date")
                continue
            if today > until_eff:
                self._ud_note("expired", node, target, choice, "until_passed")
                continue
            total = st.get("spend_total")
            if node == "campaign.adjust" and spend_at is not None and isinstance(total, (int, float)):
                total = float(total)
                if total - spend_at + 1e-9 >= max_extra:
                    self._ud_note("expired", node, target, choice, "extra_spend_%.2f" % (total - spend_at))
                    continue
                if spend_at < test_total <= total:
                    self._ud_note("expired", node, target, choice, "crossed_test_spend_total")
                    continue
            self._ud_note("applied", node, target, choice)
            return choice
        return None

    # ---------------------------------------------------------------- 判断
    def decide(self, node, state, choices, target="", evidence=None):
        user = self.user_decision(node, target, state)
        if user:
            state = dict(state or {}, user_decision=user)
        resp = J.judge(node, state, [{"id": c} if isinstance(c, str) else c for c in choices], cfg=self.cfg, soul=self.soul,
                       evidence=evidence if evidence is not None else [e["ref"] for e in self.evidence], req_id="%s-%s-%s" % (self.run_id, node, target or "x"))
        self.judgments.append({"node": node, "mode": resp["mode_local"], "conf": resp["confidence"], "provider": resp["provider"],
                               "v": resp["judge"]["v"], "reason": resp["judge"]["reason"], "decided_by": resp.get("decided_by"),
                               "advice": resp.get("advice")})
        by = "" if resp.get("decided_by") == "judge" else " [%s%s]" % (resp.get("decided_by"), (" advice=%s" % resp["advice"]["choice"]) if resp.get("advice") else "")
        self.log("judge %-18s %-14s -> %-10s %s %s%s%s" % (node, target[:14], resp["choice"], resp["mode_local"], resp["judge"]["reason"],
                                                          " [fallback]" if resp.get("fallback") else "", by))
        if resp.get("decided_by") == "compliance" or (resp.get("decided_by") == "judge" and resp["mode_local"] in ("M6", "M8")):
            self.needs_human_note("appeal" if node == "anomaly.escalate" else "other", "%s %s -> %s (%s)" % (node, target, resp["choice"], resp["mode_local"]))
        return resp

    def needs_human_note(self, reason, note, soft=False):
        self.needs_human.append({"reason": reason, "note": note, "soft": soft})

    def last_change_days(self, target):
        # 只数真正的改动：keep、continue、hold 记成 applied 但不是改动，不重置计时（否则 keep 过的系列永远加不了预算）
        r = self.con.execute("SELECT MAX(applied_at) FROM actions WHERE target=? AND applied=1 AND choice NOT IN ('keep','continue','hold')",
                             (target,)).fetchone()[0]
        if not r:
            return 99
        try:
            return (datetime.now() - datetime.strptime(r[:19], "%Y-%m-%dT%H:%M:%S")).days
        except ValueError:
            return 99

    def record_action(self, node, target, resp, applied, note=""):
        aid = "%s:%s:%s" % (self.run_id, node, target)
        if resp.get("decided_by") == "user" and resp.get("advice"):
            a = resp["advice"]
            note = "用户定的；判断建议 %s（%s %s）；%s" % (a.get("choice"), a.get("mode"), a.get("boundary_hit") or a.get("reason", ""), note)
        self.con.execute("INSERT OR REPLACE INTO actions(action_id,run_id,node,target,choice,mode,provider,applied,applied_at,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                         (aid, self.run_id, node, target, resp["choice"], resp["mode_local"], resp["provider"], 1 if applied else 0,
                          subid.now_iso() if applied else None, note, subid.now_iso()))
        self.actions.append({"node": node, "target": target, "choice": resp["choice"], "applied": applied, "note": note[:200]})

    def step_judgments(self, rep, rec):
        acct = {}
        sp = os.path.join(self.data_dir, "inbox", "account-status.json")
        if os.path.exists(sp):
            acct = json.load(open(sp, encoding="utf-8"))
        rows = (rep or {}).get("rows", [])
        today = max((r["date"] for r in rows), default=time.strftime("%Y-%m-%d"))
        d0 = datetime.strptime(today, "%Y-%m-%d")
        win7 = {(d0 - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)}
        # anomaly
        spend_today = sum(r["cost"] for r in rows if r["date"] == today)
        prev = [r["cost"] for r in rows if r["date"] != today and r["date"] in win7]
        st = {"account_status": acct.get("account_status", "ok"), "disapprovals": sum(1 for r in rows if r.get("disapproved")),
              "spend_today": round(spend_today, 2), "spend_avg_7d": round(sum(prev) / 6.0, 2) if prev else 0,
              "identity_or_payment_verification_requested": bool(acct.get("verification_requested"))}
        resp = self.decide("anomaly.escalate", st, ["continue", "pause_all", "escalate"], target="account")
        halt = resp["choice"] in ("pause_all",) or resp["mode_local"] == "M8"
        self.record_action("anomaly.escalate", "account", resp, applied=(resp["choice"] == "continue"), note="" if resp["choice"] == "continue" else "需要本人处理")
        if halt:
            self.log("anomaly: %s，本轮不再做投放调整" % resp["choice"])
        # campaign.adjust
        by_c = defaultdict(list)
        for r in rows:
            by_c[r["campaign"]].append(r)
        conv_by_c = defaultdict(lambda: [0, 0.0])
        for x in (rec or {}).get("rows", []):
            conv_by_c[x.get("campaign") or ""][0] += 1
            conv_by_c[x.get("campaign") or ""][1] += x["value"]
        todo = []
        # 当前系列设置（Agent 从后台读回来维护的文件；没有就按 SOUL 的首日预算估）
        camp_cfg = {}
        cp = os.path.join(self.data_dir, "inbox", "campaigns.json")
        if os.path.exists(cp):
            try:
                camp_cfg = json.load(open(cp, encoding="utf-8"))
            except Exception:  # noqa: BLE001
                camp_cfg = {}
        caps = self.cfg.get("caps") or {}
        default_budget = J.cap(caps, "first_day_budget", self.soul["params"]["budget"]["first_day"])
        self.caps_effective = {"daily_budget": J.cap(caps, "daily_budget", self.soul["params"]["budget"]["daily_cap"])}
        for c, rs in by_c.items():
            if halt:
                break
            dates = sorted({r["date"] for r in rs})
            w = [r for r in rs if r["date"] in win7]
            gbid = google_bid_of(w) if google_bid_of(w) is not None else (camp_cfg.get(c) or {}).get("google_bid")
            clicks_w = sum(r["clicks"] for r in w); cost_w = sum(r["cost"] for r in w)
            st = {"days_running": len(dates), "spend_total": round(sum(r["cost"] for r in rs), 2), "spend_window": round(cost_w, 2),
                  "clicks": clicks_w, "avg_cpc": round(cost_w / clicks_w, 4) if clicks_w else 0.0,
                  "conversions": conv_by_c[c][0], "commission": round(conv_by_c[c][1], 2), "last_change_days": self.last_change_days(c),
                  "daily_budget": float((camp_cfg.get(c) or {}).get("daily_budget", default_budget)), "money_at_stake": round(cost_w, 2),
                  "disapproved": any(r.get("disapproved") for r in rs), "bid_cap": (camp_cfg.get(c) or {}).get("bid_cap"), "google_bid": gbid}
            if st["bid_cap"] is None and caps.get("max_cpc") is None and gbid is None:
                self.log("出价上限未知 %s：没有 offer 的 bid_cap、caps.max_cpc 与谷歌推荐出价，本轮不按出价调" % c)
            resp = self.decide("campaign.adjust", st, ["keep", "bid_down", "budget_up", "budget_down", "pause"], target=c)
            if resp["choice"] == "keep":
                self.record_action("campaign.adjust", c, resp, applied=True, note="no_change")
            elif J.executes(resp):
                todo.append({"node": "campaign.adjust", "target": c, "choice": resp["choice"], "state": st, "reason": resp["judge"]["reason"]})
                self.record_action("campaign.adjust", c, resp, applied=False, note="todo: 由流量插件 deploy 动作或 Agent 在后台执行")
            else:
                self.record_action("campaign.adjust", c, resp, applied=False, note="proposal only (%s)" % resp["mode_local"])
        # keyword.action（只对有点击的词）
        by_k = defaultdict(list)
        for r in rows:
            if r.get("keyword") and r["date"] in win7:
                by_k[(r["campaign"], r.get("adgroup", ""), r["keyword"])].append(r)
        conv_by_k = defaultdict(int)
        for x in (rec or {}).get("rows", []):
            conv_by_k[(x.get("campaign") or "", x.get("adgroup") or "", x.get("keyword") or "")] += 1
        for key, rs in by_k.items():
            if halt:
                break
            clicks = sum(r["clicks"] for r in rs); cost = sum(r["cost"] for r in rs)
            if clicks == 0:
                continue
            st = {"clicks": clicks, "conversions": conv_by_k[key], "avg_cpc": round(cost / clicks, 4), "cost": round(cost, 2), "money_at_stake": round(cost, 2),
                  "bid_cap": (camp_cfg.get(key[0]) or {}).get("bid_cap"), "google_bid": latest_google_bid(rs)}
            tgt = "%s/%s/%s" % key
            resp = self.decide("keyword.action", st, ["keep", "pause", "bid_down", "negative"], target=tgt)
            if resp["choice"] != "keep" and J.executes(resp):
                todo.append({"node": "keyword.action", "target": tgt, "choice": resp["choice"], "state": st, "reason": resp["judge"]["reason"]})
                self.record_action("keyword.action", tgt, resp, applied=False, note="todo")
            elif resp["choice"] != "keep":
                self.record_action("keyword.action", tgt, resp, applied=False, note="proposal only (%s)" % resp["mode_local"])
        # conversion.upload
        upload = None
        if rec and (rec["rows"] or rec["chargebacks"]):
            st = {"rows_in_window": len(rec["rows"]), "rows_out_of_window": len(rec["out_of_window"]), "gclid_all_valid": True, "reconciled": True,
                  "chargebacks": len(rec["chargebacks"]), "money_at_stake": rec["summary"]["value"]}
            resp = self.decide("conversion.upload", st, ["upload", "hold"], target="conversions")
            if resp["choice"] == "upload" and J.executes(resp):
                upload = resp
            self.record_action("conversion.upload", "conversions", resp, applied=False, note="见 outbox 上传文件" if upload else "hold")
        return todo, upload

    def step_execute(self, todo, upload, rec):
        t = self.cfg.get("traffic") or {}
        d, m = self.plugin("traffic", t.get("plugin", "google-ads"))
        if todo:
            json.dump({"run_id": self.run_id, "caps_effective": getattr(self, "caps_effective", {}), "actions": todo},
                      open(self.path("actions-todo.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
            api_mode = m["actions"].get("deploy") != "manual" and (self.cfg.get("traffic") or {}).get("deploy_mode", "api") == "api"
            self.log("actions-todo: %d 项（%s 模式）" % (len(todo), "api" if api_mode else "manual"))
            if api_mode and self.apply:
                rc, _ = self.run_script(os.path.join(d, m["actions"]["deploy"]), ["--actions", self.path("actions-todo.json"), "--apply"])
                if rc == 4:
                    self.log("deploy api: 凭据缺失，动作留在 actions-todo 由 Agent 在后台做")
                if rc == 0:
                    self.con.execute("UPDATE actions SET applied=1, applied_at=? WHERE run_id=? AND applied=0 AND node IN ('campaign.adjust','keyword.action')", (subid.now_iso(), self.run_id))
                    for a in self.actions:
                        if a["node"] in ("campaign.adjust", "keyword.action") and not a["applied"]:
                            a["applied"] = True; a["note"] = "applied via api"
        if upload and rec:
            out = os.path.join(self.data_dir, "outbox", "conversions-%s.csv" % self.run_id)
            rc, _ = self.run_script(os.path.join(d, m["actions"]["convert"]), ["--conversions", self.path("conversions.json"), "--out", out,
                                                                                "--timezone", self.cfg.get("timezone", "UTC")])
            if rc == 0:
                self.log("conversions csv: %s（Agent 在后台上传，或 api 模式自动）" % os.path.relpath(out, ROOT))
                self.evidence.append({"id": "e-convert", "deliverable": "conversion_upload_file", "kind": "file", "ref": os.path.relpath(out, ROOT), "result": "pass"})
                if m["actions"].get("convert_api") and self.apply and (self.cfg.get("traffic") or {}).get("deploy_mode", "api") == "api":
                    rc2, _ = self.run_script(os.path.join(d, m["actions"]["convert_api"]), ["--conversions", self.path("conversions.json"), "--conversion-name", t.get("conversion_name", "affiliate_commission"),
                                                                                            "--timezone", self.cfg.get("timezone", "UTC"), "--apply"])
                    if rc2 == 0:
                        R.mark_uploaded(self.con, self.run_id, [r["event_id"] for r in rec["rows"]])
                        self.log("conversions uploaded via api")
                    elif rc2 == 4:
                        self.log("convert api: 凭据缺失，Agent 在后台上传 outbox 文件")
        self.con.commit()

    # ---------------------------------------------------------------- 报告
    def build_report(self, rep, rec, exit_code):
        rows = (rep or {}).get("rows", [])
        clicks = sum(r["clicks"] for r in rows); cost = sum(r["cost"] for r in rows)
        conv = len((rec or {}).get("rows", []))
        com = sum(x["value"] for x in (rec or {}).get("rows", []))
        hard = [n for n in self.needs_human if not n.get("soft")]
        reasons = sorted({n["reason"] for n in self.needs_human}) or []
        status = "stopped" if any(j["mode"] == "M8" for j in self.judgments) else ("blocked" if hard else "in_progress")
        report = {"type": "adspilot.report", "schema_version": 1, "adspilot_version": VERSION, "reported_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                  "run_id": self.run_id, "line": self.cfg.get("line", "NA"), "seg": int(self.cfg.get("seg", 0)),
                  "summary": {"window_days": 30, "spend": round(cost, 2), "clicks": clicks, "impressions": sum(r["impressions"] for r in rows),
                              "avg_cpc": round(cost / clicks, 4) if clicks else 0.0, "conversions": conv, "commission": round(com, 2),
                              "chargebacks": len((rec or {}).get("chargebacks", [])), "epc": round(com / clicks, 4) if clicks else 0.0,
                              "currency": self.cfg.get("currency", "USD"), "campaigns_active": len({r["campaign"] for r in rows})},
                  "actions": self.actions, "judgments": self.judgments, "evidence": self.evidence,
                  "needs_human": {"required": bool(hard), "reasons": reasons, "note": "; ".join(n["note"] for n in self.needs_human)[:300]},
                  "status": status, "exit_code": exit_code, "plugins": sorted(self.plugins_used), "soul": self.soul["id"]}
        if self.cfg.get("member"):
            report["member"] = self.cfg["member"]
        if any(self.ud_report.values()):
            report["user_decisions"] = self.ud_report
        errs = validate(load_schema("report.schema.json"), report)
        if errs:
            self.log("report schema errors: %s" % errs[:3])
        json.dump(report, open(self.path("report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        return report, not errs

    def finish(self, exit_code, summary):
        self.con.execute("INSERT OR REPLACE INTO runs(run_id,started_at,finished_at,exit_code,summary) VALUES(?,?,?,?,?)",
                         (self.run_id, self.started, subid.now_iso(), exit_code, json.dumps(summary, ensure_ascii=False)))
        self.con.commit()
        self.log("::STATUS{@RUN|state:%s|exit:%d|by:@SELF|authority:proposal}" % ({0: "claimed_complete", 2: "blocked", 3: "stopped"}.get(exit_code, "needs_revision"), exit_code))
        self.log_fp.close()


def load_cfg(path):
    p = path or os.path.join(ROOT, "config", "adspilot.json")
    if not os.path.exists(p):
        return None
    return json.load(open(p, encoding="utf-8"))


def run_once(cfg, run_id=None, apply=False):
    run_id = run_id or time.strftime("run-%Y%m%d-%H%M%S")
    run = Run(cfg, run_id, apply)
    run.log("adspilot %s run %s mode=%s soul=%s provider=%s" % (VERSION, run_id, "APPLY" if apply else "dry-run", run.soul["id"], (cfg.get("judgment") or {}).get("provider")))
    try:
        if not run.step_selfcheck():
            run.finish(3, {"error": "selfcheck"}); return 3
        run.step_pull_mappings()
        rep = run.step_traffic_report()
        com = run.step_commissions()
        rec = run.step_reconcile(com)
        todo, upload = run.step_judgments(rep, rec)
        run.step_execute(todo, upload, rec)
        hard = [n for n in run.needs_human if not n.get("soft")]
        exit_code = 2 if hard else 0
        report, ok = run.build_report(rep, rec, exit_code)
        run.log("report: %s（教练要看就把这个文件贴过去）" % os.path.relpath(run.path("report.json"), ROOT))
        run.finish(exit_code, report["summary"])
        return exit_code
    except Exception as e:  # noqa: BLE001
        run.log("ERROR %s: %s" % (type(e).__name__, e))
        run.finish(1, {"error": str(e)[:200]})
        return 1


def ack(cfg, run_id):
    data_dir = cfg.get("data_dir", "data")
    con = subid.open_db(os.path.join(data_dir if os.path.isabs(data_dir) else os.path.join(ROOT, data_dir), "ledger.db"))
    n = con.execute("UPDATE actions SET applied=1, applied_at=? WHERE run_id=? AND applied=0 AND note LIKE 'todo%'", (subid.now_iso(), run_id)).rowcount
    con.commit()
    print("acked %d actions for %s" % (n, run_id))
    return 0


def _selftest_cfg(tmp, name, mappings=True):
    """自测用的一套独立配置与账本：每个场景一份，互不串味。"""
    cfg = json.load(open(os.path.join(ROOT, "config", "adspilot.example.json"), encoding="utf-8"))
    base = os.path.join(tmp, name)
    cfg.update({"data_dir": os.path.join(base, "data"), "runs_dir": os.path.join(base, "runs")})
    cfg["traffic"]["report_csv"] = os.path.join(ROOT, "tests", "fixtures", "google-ads-report.csv")
    cfg["affiliate"]["commissions_source"] = "json"
    cfg["affiliate"]["commissions_json"] = os.path.join(ROOT, "tests", "fixtures", "commissions.cj.json")
    con = subid.open_db(os.path.join(cfg["data_dir"], "ledger.db"))
    if mappings:
        for row in json.load(open(os.path.join(ROOT, "tests", "fixtures", "mappings.json"), encoding="utf-8")):
            subid.record(con, row)
    con.commit(); con.close()
    return cfg


def _selftest_decisions(cfg, decisions):
    p = os.path.join(cfg["data_dir"], "inbox", "user-decisions.json")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump({"decisions": decisions}, f, ensure_ascii=False)
    return p


def _selftest_sha1(p):
    with open(p, "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()


def _selftest_report(cfg, run_id):
    return json.load(open(os.path.join(cfg["runs_dir"], run_id, "report.json"), encoding="utf-8"))


def selftest():
    import tempfile
    tmp = tempfile.mkdtemp(prefix="adspilot-selftest-")
    today = datetime.now().date()
    ds = lambda n=0: (today - timedelta(days=n)).strftime("%Y-%m-%d")  # noqa: E731
    schema = load_schema("report.schema.json")
    results = []

    def check(name, cond, detail=""):
        results.append(bool(cond))
        print("%s %s %s" % ("ok  " if cond else "FAIL", name, detail))

    def ud_of(rep):
        return rep.get("user_decisions") or {}

    def by_target(rep, node):
        return {a["target"]: a["choice"] for a in rep["actions"] if a["node"] == node}

    def decided(rep, node):
        return [j.get("decided_by") for j in rep["judgments"] if j["node"] == node]

    # 第一轮：没有用户决定，判断自己走
    cfg = _selftest_cfg(tmp, "a")
    rc = run_once(cfg, run_id="selftest", apply=False)
    rep = _selftest_report(cfg, "selftest")
    errs = validate(schema, rep)
    ok = rc in (0, 2) and not errs and rep["summary"]["conversions"] >= 1 and any(a["node"] == "campaign.adjust" for a in rep["actions"])
    base_adj = by_target(rep, "campaign.adjust")
    adj = [t for t, c in base_adj.items() if c != "keep"]
    targets = sorted(base_adj)

    # T2-a 第二轮：用户对第一轮每个 campaign.adjust 目标逐条说 keep（带 created），循环照做，判断的意见记成建议
    p = _selftest_decisions(cfg, [{"node": "campaign.adjust", "target": t, "choice": "keep", "created": ds(), "note": "selftest"} for t in targets])
    h0 = _selftest_sha1(p)
    run_once(cfg, run_id="selftest-user", apply=False)
    rep2 = _selftest_report(cfg, "selftest-user")
    errs2 = validate(schema, rep2)
    adj2 = by_target(rep2, "campaign.adjust")
    by2 = decided(rep2, "campaign.adjust")
    applied2 = sorted(x["target"] for x in ud_of(rep2).get("applied", []) if x["node"] == "campaign.adjust")
    con = subid.open_db(os.path.join(cfg["data_dir"], "ledger.db"))
    anchors = con.execute("SELECT first_seen, spend_at FROM user_decision_anchor").fetchall()
    con.close()
    user_ok = (not errs2 and sorted(adj2) == targets and all(c == "keep" for c in adj2.values()) and by2 and all(b == "user" for b in by2)
               and applied2 == targets and len(anchors) == len(targets) and all(a[0] == ds() and a[1] is not None for a in anchors))
    check("T2-a", user_ok, "targets=%s adjust=%s decided_by=%s applied=%s anchors=%d schema=%s" % (
        targets, sorted(set(adj2.values())), sorted(set(by2)), applied2, len(anchors), "ok" if not errs2 else errs2[:2]))

    # T4-a keep 不算改动：第二轮用户说了 keep，第三轮不再有用户决定，判断应与第一轮一致（加预算不被 keep 卡住）
    f_ok_round2 = _selftest_sha1(p) == h0          # T2-f：第二轮没回写
    _selftest_decisions(cfg, [])
    h0 = _selftest_sha1(p)                          # 测试自己改了文件，重新记；第三轮也不许回写
    run_once(cfg, run_id="selftest-after-keep", apply=False)
    rep_k = _selftest_report(cfg, "selftest-after-keep")
    check("T4-a", by_target(rep_k, "campaign.adjust") == base_adj, "第一轮=%s 用户keep之后一轮=%s" % (base_adj, by_target(rep_k, "campaign.adjust")))

    # T2-b 花钱节点写 target:"*" ⇒ 忽略并写进报告，判断照常；非花钱节点的 * 照旧生效
    cfg_b = _selftest_cfg(tmp, "b")
    pb = _selftest_decisions(cfg_b, [{"node": "campaign.adjust", "target": "*", "choice": "keep", "created": ds()},
                                     {"node": "keyword.action", "target": "*", "choice": "keep", "created": ds()},
                                     {"node": "conversion.upload", "target": "*", "choice": "hold", "created": ds()}])
    hb = _selftest_sha1(pb)
    run_once(cfg_b, run_id="selftest-wild", apply=False)
    rep3 = _selftest_report(cfg_b, "selftest-wild")
    errs3 = validate(schema, rep3)
    ig = ud_of(rep3).get("ignored", [])
    log3 = open(os.path.join(cfg_b["runs_dir"], "selftest-wild", "run.log"), encoding="utf-8").read()
    want_ig = [{"node": n, "target": "*", "choice": "keep", "why": "wildcard_not_allowed_on_money_node"} for n in ("campaign.adjust", "keyword.action")]
    by3 = decided(rep3, "campaign.adjust") + decided(rep3, "keyword.action")
    wild_ok = (not errs3 and all(w in ig for w in want_ig) and len(ig) == len(want_ig)
               and by_target(rep3, "campaign.adjust") == base_adj and by_target(rep3, "keyword.action") == by_target(rep, "keyword.action")
               and by3 and all(b == "judge" for b in by3)
               and "user_decision campaign.adjust * keep ignored wildcard_not_allowed_on_money_node" in log3
               and any(x["node"] == "conversion.upload" for x in ud_of(rep3).get("applied", [])))
    check("T2-b", wild_ok, "ignored=%s adjust_same_as_round1=%s decided_by=%s nonmoney_applied=%s schema=%s" % (
        [x["node"] for x in ig], by_target(rep3, "campaign.adjust") == base_adj, sorted(set(by3)),
        [x["node"] for x in ud_of(rep3).get("applied", [])], "ok" if not errs3 else errs3[:2]))

    # T2-c..e 直接在一轮里调 decide：到期、多花出一截、越过测试总额（USD 配置）
    cfg_c = _selftest_cfg(tmp, "c", mappings=False)
    uds = [{"node": "campaign.adjust", "target": "C-old", "choice": "keep", "created": ds(8)},
           {"node": "campaign.adjust", "target": "C-spend", "choice": "keep", "created": ds()},
           {"node": "campaign.adjust", "target": "C-cross", "choice": "keep", "created": ds()},
           {"node": "campaign.adjust", "target": "C-ok", "choice": "keep", "created": ds()}]
    pc = _selftest_decisions(cfg_c, uds)
    hc = _selftest_sha1(pc)

    def akey(d):  # 与原书 STEP 2.1 的定义逐字一致，独立于实现算一遍
        return hashlib.sha1(json.dumps({k: d.get(k) for k in ("node", "target", "choice", "until", "created")}, sort_keys=True).encode("utf-8")).hexdigest()
    con = subid.open_db(os.path.join(cfg_c["data_dir"], "ledger.db"))
    for d, spend_at in ((uds[1], 100.0), (uds[2], 250.0), (uds[3], 100.0)):
        con.execute("INSERT INTO user_decision_anchor(key, first_seen, spend_at) VALUES(?,?,?)", (akey(d), ds(), spend_at))
    con.commit(); con.close()
    r = Run(cfg_c, "selftest-unit", False)
    ch = ["keep", "bid_down", "budget_up", "budget_down", "pause"]
    st0 = {"days_running": 7, "spend_total": 140, "spend_window": 140, "clicks": 700, "avg_cpc": 0.2, "conversions": 3, "commission": 400,
           "last_change_days": 3, "daily_budget": 5.0, "money_at_stake": 140, "disapproved": False, "bid_cap": None}
    rc_old = r.decide("campaign.adjust", st0, ch, target="C-old", evidence=["selftest"])
    rc_spend = r.decide("campaign.adjust", dict(st0, spend_total=250), ch, target="C-spend", evidence=["selftest"])
    rc_cross = r.decide("campaign.adjust", dict(st0, spend_total=320), ch, target="C-cross", evidence=["selftest"])
    rc_ok = r.decide("campaign.adjust", dict(st0, spend_total=150), ch, target="C-ok", evidence=["selftest"])
    rep4, _ = r.build_report(None, None, 0)
    r.finish(0, {})
    errs4 = validate(schema, rep4)
    exp = {x["target"]: x["why"] for x in ud_of(rep4).get("expired", [])}
    log4 = open(os.path.join(cfg_c["runs_dir"], "selftest-unit", "run.log"), encoding="utf-8").read()
    check("T2-c", exp.get("C-old") == "until_passed" and rc_old.get("decided_by") == "judge"
          and "user_decision campaign.adjust C-old keep expired until_passed" in log4,
          "why=%s decided_by=%s choice=%s" % (exp.get("C-old"), rc_old.get("decided_by"), rc_old["choice"]))
    check("T2-d", str(exp.get("C-spend", "")).startswith("extra_spend_") and rc_spend.get("decided_by") == "judge"
          and rc_ok.get("decided_by") == "user" and rc_ok["choice"] == "keep" and "C-ok" not in exp,
          "why=%s decided_by=%s | 控制组 C-ok 多花50 decided_by=%s" % (exp.get("C-spend"), rc_spend.get("decided_by"), rc_ok.get("decided_by")))
    check("T2-e", exp.get("C-cross") == "crossed_test_spend_total" and rc_cross.get("decided_by") == "judge" and rc_cross["choice"] == "pause",
          "why=%s decided_by=%s choice=%s mode=%s" % (exp.get("C-cross"), rc_cross.get("decided_by"), rc_cross["choice"], rc_cross["mode_local"]))
    # T4-g 日常循环的状态带谷歌推荐出价：词取自己的首页出价估计；系列按点击加权；报表里没有才用开局记下的
    cfg_g = _selftest_cfg(tmp, "g", mappings=False)
    os.makedirs(os.path.join(cfg_g["data_dir"], "inbox"), exist_ok=True)
    json.dump({"C1": {"daily_budget": 5.0}, "C2": {"daily_budget": 5.0, "google_bid": 2.5}},
              open(os.path.join(cfg_g["data_dir"], "inbox", "campaigns.json"), "w", encoding="utf-8"))
    rg = Run(cfg_g, "selftest-gbid", False)
    seen = []
    orig = rg.decide

    def spy(node, state, choices, target="", evidence=None):
        seen.append((node, target, dict(state or {})))
        return orig(node, state, choices, target=target, evidence=evidence)
    rg.decide = spy
    d0 = ds()
    rows_g = [{"date": d0, "campaign": "C1", "adgroup": "A", "keyword": "k1", "impressions": 100, "clicks": 10, "cost": 30.0, "top_of_page_bid": 2.0},
              {"date": d0, "campaign": "C1", "adgroup": "A", "keyword": "k2", "impressions": 100, "clicks": 30, "cost": 90.0, "top_of_page_bid": 4.0},
              {"date": d0, "campaign": "C2", "adgroup": "B", "keyword": "k3", "impressions": 50, "clicks": 5, "cost": 10.0}]
    rg.step_judgments({"rows": rows_g}, None)
    rg.finish(0, {})
    gb = {(n, t): s_.get("google_bid") for n, t, s_ in seen}
    want_g = {("campaign.adjust", "C1"): 3.5, ("campaign.adjust", "C2"): 2.5, ("keyword.action", "C1/A/k1"): 2.0, ("keyword.action", "C1/A/k2"): 4.0,
              ("keyword.action", "C2/B/k3"): None}
    check("T4-g", all(gb.get(k) == v for k, v in want_g.items()), "google_bid=%s" % {("%s %s" % k): gb.get(k) for k in want_g})
    check("T2-f", f_ok_round2 and _selftest_sha1(p) == h0 and _selftest_sha1(pb) == hb and _selftest_sha1(pc) == hc,
          "user-decisions.json 三份跑完字节不变")
    ok = ok and all(results) and not errs4
    print("selftest rc=%d conversions=%d actions=%d judgments=%d schema=%s judge_changes=%d user_keep=%s -> %s" % (
        rc, rep["summary"]["conversions"], len(rep["actions"]), len(rep["judgments"]), "ok" if not errs else errs[:2], len(adj), bool(user_ok), "OK" if ok else "FAIL"))
    shutil.rmtree(tmp, ignore_errors=True)
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    cfg_path = argv[argv.index("--config") + 1] if "--config" in argv else None
    cfg = load_cfg(cfg_path)
    if cfg is None:
        print("config/adspilot.json 不存在：cp config/adspilot.example.json config/adspilot.json"); return 4
    if "--ack" in argv:
        return ack(cfg, argv[argv.index("--ack") + 1])
    apply = "--apply" in argv or (bool(cfg.get("apply")) and "--dry-run" not in argv)
    run_id = argv[argv.index("--run-id") + 1] if "--run-id" in argv else None
    return run_once(cfg, run_id, apply)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
