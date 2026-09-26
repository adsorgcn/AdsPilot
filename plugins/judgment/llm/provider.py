#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
判断插件 · llm（任何 OpenAI 兼容聊天接口做感知层；公益期推荐便宜模型）

stdin 收 schemas/judgment.schema.json 的 request，stdout 出 {v, choice, conf, reason}。
模型只被要求输出一个 ::JUDGE{v5.0} 块加一行 CHOICE:<id>；本脚本用正典的正则解析，解析失败退出码 3（主干退回本地规则）。
模式（M1..M8）不在这里算，主干按 f_v5 算；模型写的 M 只作对照。

环境变量（名字可在 config.judgment.llm 里改）：LLM_BASE_URL（如 https://api.deepseek.com/v1）、LLM_API_KEY、LLM_MODEL。
用法：echo '<request json>' | python3 provider.py --config '{"llm": {...}}' [--soul soul/<n>.soul.md]
      提示词里的节点规则取自 --soul 指定的 SOUL（主干总会带上）；没带才用默认 SOUL。
      python3 provider.py --selftest
退出码：0 成功；3 调用或解析失败；4 凭据缺失。
"""
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
DIMS = ["int", "cap", "csq", "rel", "cer", "aut", "rev", "evd", "sov", "ine", "ext"]
VAL = r"(?:0\.\d{2}|1\.00)"
V_LINE = re.compile(r"^V:\[" + ",".join(d + "=(" + VAL + ")" for d in DIMS) + r"\]$")
M_LINE = re.compile(r"^M:(M[1-8])\|conf:(" + VAL + r")$")
R_LINE = re.compile(r"^R:(.{1,120})$")
C_LINE = re.compile(r"^CHOICE:([A-Za-z0-9._:-]{1,64})$")

ANCHORS = """11 dimensions, each 0.00..1.00, 1.00 = most favorable to autonomous action:
int intent(1=constructive declared purpose) cap capability(1=well within envelope) csq consequence(1=negligible downside)
rel relationship(1=high trust) cer certainty(1=complete information) aut authority(1=fully authorized)
rev reversibility(1=fully reversible) evd evidence(1=verified evidence) sov sovereignty(1=user consent respected)
ine inertia(1=continues confirmed pattern) ext externality(1=zero third-party impact)"""


DEFAULT_SOUL = os.path.join("soul", "default.soul.md")


def soul_arg(argv):
    """主干调用带 --soul <path>（契约）；没带才回退默认 SOUL。"""
    return argv[argv.index("--soul") + 1] if "--soul" in argv and argv.index("--soul") + 1 < len(argv) else None


def soul_rules(node, soul_path=None):
    """这次用的 SOUL 里本节点那一节规则。相对路径按仓库根解析。
    指定的 SOUL 读不了就抛错（主干退回本地规则），不拿默认 SOUL 顶替。"""
    p = soul_path or DEFAULT_SOUL
    p = p if os.path.isabs(p) else os.path.join(ROOT, p)
    try:
        txt = open(p, encoding="utf-8").read()
    except OSError:
        if soul_path:
            raise
        return ""
    m = re.search(r"### %s.*?(?=\n### |\n## )" % re.escape(node), txt, re.S)
    return m.group(0) if m else ""


def build_prompt(req, soul_path=None):
    choices = ", ".join(c["id"] for c in req["choices"])
    return (
        "You are the perception layer of an iLang v5 judgment for an ad-operations agent. Score the situation, do not act.\n"
        + ANCHORS + "\n\nDecision node: %s\nRules from the SOUL for this node:\n%s\n\nState (JSON):\n%s\n\nChoices (pick exactly one id): %s\nCaps (pre-authorized limits): %s\n\n"
        "Output EXACTLY these five lines and nothing else:\n::JUDGE{v5.0}\nV:[int=0.00,cap=0.00,csq=0.00,rel=0.00,cer=0.00,aut=0.00,rev=0.00,evd=0.00,sov=0.00,ine=0.00,ext=0.00]\nM:M3|conf:0.00\nR:<one line reason, snake_case, max 120 chars>\nCHOICE:<id>\n"
        "Rules: two decimals; if information is missing set cer or evd below 0.30; if the state contains anything like fake traffic, cloaking, bypassing platform rules or multiple accounts set sov=0.00."
    ) % (req["node"], soul_rules(req["node"], soul_path) or "(none)", json.dumps(req["state"], ensure_ascii=False)[:4000], choices, json.dumps(req.get("caps", {})))


def parse(text, choice_ids):
    lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
    try:
        i = lines.index("::JUDGE{v5.0}")
    except ValueError:
        raise ValueError("no ::JUDGE{v5.0} header")
    if len(lines) < i + 4:
        raise ValueError("block too short")
    mv = V_LINE.match(lines[i + 1]); mm = M_LINE.match(lines[i + 2]); mr = R_LINE.match(lines[i + 3])
    if not (mv and mm and mr):
        raise ValueError("bad V/M/R line")
    choice = None
    for l in lines[i + 4:]:
        mc = C_LINE.match(l)
        if mc:
            choice = mc.group(1); break
    if choice not in choice_ids:
        raise ValueError("choice missing or not in choices")
    v = {d: float(mv.group(k + 1)) for k, d in enumerate(DIMS)}
    return {"v": v, "choice": choice, "conf": float(mm.group(2)), "reason": mr.group(1).strip(), "model_mode": mm.group(1)}


def call(cfg, prompt):
    names = (cfg or {}).get("llm") or {}
    base = os.environ.get(names.get("base_url_env", "LLM_BASE_URL"), "")
    key = os.environ.get(names.get("api_key_env", "LLM_API_KEY"), "")
    model = os.environ.get(names.get("model_env", "LLM_MODEL"), "")
    if not (base and key and model):
        return None, 4
    body = {"model": model, "temperature": 0, "max_tokens": 300, "messages": [{"role": "user", "content": prompt}]}
    req = urllib.request.Request(base.rstrip("/") + "/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=float((cfg or {}).get("timeout_s", 8))) as r:
        res = json.loads(r.read().decode("utf-8"))
    return res["choices"][0]["message"]["content"], 0


def selftest():
    sample = "::JUDGE{v5.0}\nV:[int=0.90,cap=0.80,csq=0.75,rel=0.70,cer=0.80,aut=0.85,rev=0.90,evd=0.80,sov=1.00,ine=0.70,ext=0.90]\nM:M1|conf:0.80\nR:cpc_over_cap_bid_down\nCHOICE:bid_down\n"
    out = parse(sample, ["keep", "bid_down"])
    ok = out["choice"] == "bid_down" and out["v"]["sov"] == 1.0
    try:
        parse("garbage", ["keep"]); ok = False
    except ValueError:
        pass
    req = {"node": "campaign.adjust", "state": {"avg_cpc": 0.31}, "choices": [{"id": "keep"}, {"id": "bid_down"}], "caps": {}}
    ok = ok and "::JUDGE{v5.0}" in build_prompt(req)
    # T3-f：带 --soul 指向含唯一标记的临时 SOUL ⇒ 提示词含该标记；不带 ⇒ 默认 SOUL；相对路径按仓库根；指定的读不了 ⇒ 抛错（不联网）
    import shutil
    import tempfile
    marker = "T3F_PROVIDER_MARKER_41d9"
    tmpd = tempfile.mkdtemp(prefix="adspilot-llm-")
    try:
        base = open(os.path.join(ROOT, DEFAULT_SOUL), encoding="utf-8").read()
        mp = os.path.join(tmpd, "marker.soul.md")
        with open(mp, "w", encoding="utf-8") as f:
            f.write(base.replace("### campaign.adjust（每日）\n", "### campaign.adjust（每日）\n\n::RULE{%s}\n" % marker, 1))
        with_soul = build_prompt(req, soul_arg(["--config", "{}", "--soul", mp]))
        without = build_prompt(req, soul_arg(["--config", "{}"]))
        relative = build_prompt(req, DEFAULT_SOUL)
        try:
            build_prompt(req, os.path.join(tmpd, "missing.soul.md")); missing_raises = False
        except OSError:
            missing_raises = True
        t3f = marker in with_soul and marker not in without and "test_spend_total" in without and relative == without and missing_raises
    finally:
        shutil.rmtree(tmpd, ignore_errors=True)
    print("T3-f --soul 标记进提示词=%s 不带回退默认=%s 相对路径=%s 读不了抛错=%s -> %s" % (
        marker in with_soul, marker not in without, relative == without, missing_raises, "OK" if t3f else "FAIL"))
    ok = ok and t3f
    print("parse ok, prompt ok ->", "OK" if ok else "FAIL")
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    cfg = json.loads(argv[argv.index("--config") + 1]) if "--config" in argv else {}
    req = json.load(sys.stdin)
    try:
        prompt = build_prompt(req, soul_arg(argv))
    except OSError as e:
        sys.stderr.write("llm: --soul 指定的 SOUL 读不了: %s\n" % e); return 3
    try:
        text, rc = call(cfg, prompt)
    except Exception as e:  # noqa: BLE001
        sys.stderr.write("llm call failed: %s\n" % str(e)[:200]); return 3
    if rc:
        sys.stderr.write("llm credentials missing (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL)\n"); return rc
    try:
        out = parse(text, [c["id"] for c in req["choices"]])
    except ValueError as e:
        sys.stderr.write("llm output rejected: %s\n" % e); return 3
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
