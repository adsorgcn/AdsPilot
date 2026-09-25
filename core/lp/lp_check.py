#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
落地页合规检查（主干，LP 部件）

按 Google Ads 目的地要求做静态检查：有实质内容、有隐私与联系方式、有联盟披露、不自动跳转、CTA 走自己域名的 /go 而不是直投联盟链接、移动端可用。
过了才允许 lp.publish 节点给 publish。它是规则检查，不是人审；能查的都查，查不了的（内容与广告承诺是否一致）留给执行 Agent 按使用方法看。

用法：
  python3 core/lp/lp_check.py <page.html> [--min-words 300] [--json]
  python3 core/lp/lp_check.py --selftest
退出码：0 全过；1 有 fail。
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
AFFILIATE_DOMAINS = ("anrdoezrs.net", "dpbolvw.net", "jdoqocy.com", "kqzyfj.com", "tkqlhce.com", "emjcd.com", "cj.com",
                     "impact.com", "sjv.io", "pxf.io", "awin1.com", "linksynergy.com", "shareasale.com", "go2cloud.org")


def strip_tags(html):
    html = re.sub(r"<script.*?</script>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<style.*?</style>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<!--.*?-->", " ", html, flags=re.S)
    return re.sub(r"<[^>]+>", " ", html)


def check_html(html, min_words=300):
    res = []

    def add(name, ok, detail="", level="fail"):
        res.append({"check": name, "status": "pass" if ok else level, "detail": detail})

    text = strip_tags(html)
    words = len(re.findall(r"[A-Za-z0-9']+", text)) + len(re.findall(r"[一-鿿]", text)) // 2
    add("title", bool(re.search(r"<title>\s*\S.*?</title>", html, re.S | re.I)), "")
    add("viewport", bool(re.search(r'<meta[^>]+name=["\']viewport["\']', html, re.I)), "移动端可用")
    add("substantive_content", words >= min_words, "%d words (min %d)" % (words, min_words))
    add("placeholders_filled", "{{" not in html, "模板占位符还在" if "{{" in html else "")
    add("privacy_link", bool(re.search(r'href=["\'][^"\']*privacy', html, re.I)) or "隐私" in text, "")
    add("contact", bool(re.search(r'mailto:|href=["\'][^"\']*contact', html, re.I)) or "联系" in text, "")
    add("affiliate_disclosure", bool(re.search(r"affiliate (link|disclosure)|earn a commission|联盟|佣金", text, re.I)), "")
    add("no_meta_refresh", not re.search(r'http-equiv=["\']refresh', html, re.I), "禁止自动跳转")
    scripts = " ".join(re.findall(r"<script.*?</script>", html, flags=re.S | re.I))
    auto_redirect = re.search(r"(location\.(href|replace|assign)\s*[=(])", scripts) and not re.search(r"addEventListener\(\s*['\"]click", scripts)
    add("no_script_redirect", not auto_redirect, "脚本里有非点击触发的跳转" if auto_redirect else "")
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', html, re.I)
    direct = [h for h in hrefs if any(d in h.lower() for d in AFFILIATE_DOMAINS)]
    add("no_direct_affiliate_links", not direct, "; ".join(direct[:3]), "fail")
    go = [h for h in hrefs if h.startswith("/go") or "/go?" in h]
    add("cta_via_own_go", bool(go), "CTA 应走本站 /go 中转")
    add("go_links_nofollow_sponsored", all(re.search(r'rel=["\'][^"\']*(nofollow|sponsored)', a, re.I) for a in re.findall(r"<a[^>]+/go[^>]*>", html, re.I)) if go else True, "")
    imgs = re.findall(r"<img[^>]*>", html, re.I)
    noalt = [i for i in imgs if not re.search(r"\salt=", i, re.I)]
    add("img_alt", not noalt, "%d images without alt" % len(noalt), "warn")
    hidden = re.search(r"display\s*:\s*none[^>]*>[^<]{80,}", html, re.I)
    add("no_hidden_text_blocks", not hidden, "有大段 display:none 文本", "warn")
    return res


def summarize(res):
    fails = [r for r in res if r["status"] == "fail"]
    warns = [r for r in res if r["status"] == "warn"]
    return {"verdict": "fail" if fails else "pass", "fail": len(fails), "warn": len(warns), "results": res}


def selftest():
    tpl = open(os.path.join(ROOT, "core", "lp", "templates", "landing.html"), encoding="utf-8").read()
    s1 = summarize(check_html(tpl))
    # 模板本身占位符未填、字数不够，应当 fail
    ok = s1["verdict"] == "fail" and any(r["check"] == "placeholders_filled" and r["status"] == "fail" for r in s1["results"])
    filled = tpl
    for k in re.findall(r"\{\{([A-Z0-9_]+)\}\}", tpl):
        filled = filled.replace("{{%s}}" % k, "example text " * 3 if k.startswith(("P_", "H2_")) else "example")
    filled = filled.replace("</main>", "<p>" + ("useful original sentence about the product " * 60) + "</p></main>")
    s2 = summarize(check_html(filled))
    ok = ok and s2["verdict"] == "pass"
    bad = filled.replace('href="/go?o=example"', 'href="https://www.anrdoezrs.net/click-1-2"')
    s3 = summarize(check_html(bad))
    ok = ok and s3["verdict"] == "fail"
    print("template(unfilled)=%s filled=%s direct_affiliate=%s -> %s" % (s1["verdict"], s2["verdict"], s3["verdict"], "OK" if ok else "FAIL"))
    if not ok:
        for s in (s1, s2, s3):
            print(json.dumps([r for r in s["results"] if r["status"] != "pass"], ensure_ascii=False))
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    if not argv or argv[0].startswith("--"):
        print(__doc__); return 1
    html = open(argv[0], encoding="utf-8", errors="ignore").read()
    mw = int(argv[argv.index("--min-words") + 1]) if "--min-words" in argv else 300
    s = summarize(check_html(html, mw))
    if "--json" in argv:
        print(json.dumps(s, ensure_ascii=False, indent=2))
    else:
        for r in s["results"]:
            print("[%-4s] %-28s %s" % (r["status"].upper(), r["check"], r["detail"]))
        print("verdict: %s" % s["verdict"].upper())
    return 0 if s["verdict"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
