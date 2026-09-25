#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
回流插件 · feishu · post 动作

把 schemas/report.schema.json 的报告发回社区。两种通道，配哪个走哪个，都配就都发：
  collector  社区机器人的收集接口：POST <ADSPILOT_REPORT_URL>，Bearer <ADSPILOT_REPORT_SECRET>，体为原 JSON（机器人校验、审计、记进度）
  webhook    飞书自定义机器人 webhook（ADSPILOT_REPORT_WEBHOOK，可选签名 ADSPILOT_REPORT_SECRET）：发一条人能读的摘要
发前：过 schema；扫掉键名含 token、secret、password、api_key、gclid 的字段；报告文本里不出现凭据。
通道不可达：报告留在 runs/<id>/report.json，下一轮补发（幂等键 run_id），退出码 3。

用法：
  python3 post.py --report runs/<id>/report.json [--apply]
  python3 post.py --selftest
不带 --apply 只打印将发的摘要。退出码：0 发出或 dry-run；1 报告不合格；3 通道失败；4 未配置。
"""
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "core", "selfcheck"))
FORBIDDEN_KEYS = ("token", "secret", "password", "refresh_token", "api_key", "gclid")


def scrub(obj):
    if isinstance(obj, dict):
        return {k: scrub(v) for k, v in obj.items() if not any(f in k.lower() for f in FORBIDDEN_KEYS)}
    if isinstance(obj, list):
        return [scrub(x) for x in obj]
    return obj


def summary_text(rep):
    s = rep["summary"]
    nh = rep["needs_human"]
    modes = {}
    for j in rep["judgments"]:
        modes[j["mode"]] = modes.get(j["mode"], 0) + 1
    lines = ["AdsPilot %s 回报 %s" % (rep["adspilot_version"], rep["run_id"]),
             "线 %s 段 %s 状态 %s" % (rep["line"], rep["seg"], rep.get("status", "")),
             "%d天 花费 %.2f %s 点击 %d 转化 %d 佣金 %.2f 拒付 %d EPC %.3f" % (s["window_days"], s["spend"], s["currency"], s["clicks"], s["conversions"], s["commission"], s.get("chargebacks", 0), s.get("epc", 0)),
             "动作 %d 项（已执行 %d） 判断 %s" % (len(rep["actions"]), sum(1 for a in rep["actions"] if a["applied"]), " ".join("%s×%d" % kv for kv in sorted(modes.items()))),
             "需要本人：%s %s" % ("是" if nh["required"] else "否", ",".join(nh.get("reasons", [])))]
    if nh.get("note"):
        lines.append("备注：" + nh["note"][:200])
    return "\n".join(lines)


def feishu_body(text, secret):
    body = {"msg_type": "text", "content": {"text": text}}
    if secret:
        ts = str(int(time.time()))
        key = (ts + "\n" + secret).encode("utf-8")
        sign = base64.b64encode(hmac.new(key, b"", digestmod=hashlib.sha256).digest()).decode()
        body.update({"timestamp": ts, "sign": sign})
    return body


def post_json(url, body, bearer=None, timeout=15):
    headers = {"Content-Type": "application/json", "User-Agent": "adspilot-report"}
    if bearer:
        headers["Authorization"] = "Bearer " + bearer
    req = urllib.request.Request(url, data=json.dumps(body, ensure_ascii=False).encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read().decode("utf-8", "ignore")[:300]


def selftest():
    rep = {"type": "adspilot.report", "schema_version": 1, "adspilot_version": "2.0.0", "reported_at": "2026-09-25T00:00:00", "run_id": "selftest",
           "line": "L2", "seg": 3, "summary": {"window_days": 7, "spend": 12.5, "clicks": 50, "conversions": 1, "commission": 18.4, "currency": "USD"},
           "actions": [{"node": "campaign.adjust", "choice": "keep", "applied": True}], "judgments": [{"node": "campaign.adjust", "mode": "M1", "conf": 0.7, "provider": "local"}],
           "evidence": [], "needs_human": {"required": False}, "status": "in_progress", "gclid_leak": "x"}
    from validate import load_schema, validate
    clean = scrub(rep)
    errs = validate(load_schema("report.schema.json"), clean)
    txt = summary_text(clean)
    b = feishu_body(txt, "s3cret")
    ok = not errs and "gclid" not in json.dumps(clean) and "sign" in b and "AdsPilot" in txt
    print(txt.splitlines()[2], "->", "OK" if ok else ("FAIL %s" % errs[:2]))
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1) if argv[i].startswith("--") and not argv[i + 1].startswith("--")}
    if "report" not in kv:
        print(__doc__); return 1
    from validate import load_schema, validate
    rep = scrub(json.load(open(kv["report"], encoding="utf-8")))
    errs = validate(load_schema("report.schema.json"), rep)
    if errs:
        print("report rejected: %s" % errs[:3]); return 1
    text = summary_text(rep)
    webhook = os.environ.get("ADSPILOT_REPORT_WEBHOOK", "")
    secret = os.environ.get("ADSPILOT_REPORT_SECRET", "")
    collector = os.environ.get("ADSPILOT_REPORT_URL", "")
    if not (webhook or collector):
        print("not configured: ADSPILOT_REPORT_WEBHOOK 或 ADSPILOT_REPORT_URL"); return 4
    if "--apply" not in argv:
        print("dry-run, would send:\n" + text); return 0
    rc = 0
    if collector:
        try:
            st, _ = post_json(collector, rep, bearer=secret or None)
            print("collector %s" % st)
        except Exception as e:  # noqa: BLE001
            print("collector failed: %s" % str(e)[:200]); rc = 3
    if webhook:
        try:
            st, body = post_json(webhook, feishu_body(text, secret))
            print("webhook %s %s" % (st, body[:80]))
        except Exception as e:  # noqa: BLE001
            print("webhook failed: %s" % str(e)[:200]); rc = 3
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
