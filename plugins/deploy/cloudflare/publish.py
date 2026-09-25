#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cloudflare 插件 · publish 动作（把页面与 offer 表推到落地位，不重新部署）

  python3 publish.py --page site/widget-x-review.html --slug widget-x-review   # 页面 -> KV page:<slug>，访问 https://<host>/<slug>
  python3 publish.py --site --site-name "My Reviews" --contact you@example.com  # 推 /privacy 与 /terms（core/lp/templates 里的通用页）
  python3 publish.py --offers offers.json                                       # offer 表 -> KV offers（{offer_ref:{url,param}}），合并不覆盖
  python3 publish.py --selftest
读 data/deploy.json 知道推到哪。退出码：0 成功；3 API 失败；4 未 setup 或钥匙缺失。
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
import cf_api as CF  # noqa: E402
from setup import load_deploy  # noqa: E402

TEMPLATES = os.path.join(ROOT, "core", "lp", "templates")
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")


def fill(html, values):
    for k, v in values.items():
        html = html.replace("{{%s}}" % k, v)
    return html


def push_page(client, dep, slug, html):
    if not SLUG_RE.match(slug):
        raise ValueError("slug 只能小写字母数字与连字符: %r" % slug)
    client.kv_put(dep["kv_namespace_id"], "page:" + slug, html)
    return "%s/%s" % (dep["base_url"], "" if slug == "index" else slug)


def push_site_pages(client, dep, site_name, contact):
    urls = []
    for slug in ("privacy", "terms"):
        html = fill(open(os.path.join(TEMPLATES, slug + ".html"), encoding="utf-8").read(), {"SITE_NAME": site_name, "CONTACT_EMAIL": contact, "HOST": dep["host"]})
        urls.append(push_page(client, dep, slug, html))
    return urls


def push_offers(client, dep, table):
    cur = client.kv_get(dep["kv_namespace_id"], "offers")
    merged = {}
    if cur:
        try:
            merged = json.loads(cur)
        except ValueError:
            merged = {}
    for ref, t in table.items():
        if not t.get("url"):
            raise ValueError("offer %s 缺 url" % ref)
        merged[ref] = {"url": t["url"], "param": t.get("param", "sid")}
    client.kv_put(dep["kv_namespace_id"], "offers", json.dumps(merged))
    return len(merged)


def selftest():
    html = fill("<p>{{SITE_NAME}} {{CONTACT_EMAIL}}</p>", {"SITE_NAME": "S", "CONTACT_EMAIL": "c@x"})
    ok = html == "<p>S c@x</p>" and SLUG_RE.match("widget-x-review") and not SLUG_RE.match("Bad Slug")
    ok = ok and all(os.path.exists(os.path.join(TEMPLATES, f)) for f in ("privacy.html", "terms.html", "landing.html"))
    print("fill=%s slug=%s templates=%s -> %s" % (html, bool(SLUG_RE.match("widget-x-review")), True, "OK" if ok else "FAIL"))
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1) if argv[i].startswith("--") and not argv[i + 1].startswith("--")}
    dep = load_deploy()
    if not dep.get("kv_namespace_id"):
        print(json.dumps({"error": "先跑 setup.py --apply（data/deploy.json 不存在）"})); return 4
    client = CF.Client()
    if client.missing:
        print(json.dumps({"error": "missing env: %s" % ", ".join(client.missing)})); return 4
    out = {"host": dep["host"], "pushed": []}
    try:
        if kv.get("page"):
            slug = kv.get("slug") or os.path.splitext(os.path.basename(kv["page"]))[0].lower()
            out["pushed"].append(push_page(client, dep, slug, open(kv["page"], encoding="utf-8").read()))
        if "--site" in argv:
            out["pushed"].extend(push_site_pages(client, dep, kv.get("site-name", dep["host"]), kv.get("contact", "contact@" + dep["host"])))
        if kv.get("offers"):
            out["offers_total"] = push_offers(client, dep, json.load(open(kv["offers"], encoding="utf-8")))
    except (CF.CFError, ValueError, OSError) as e:
        print(json.dumps({"error": str(e)[:300]})); return 3
    if not out["pushed"] and "offers_total" not in out:
        print(__doc__); return 1
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
