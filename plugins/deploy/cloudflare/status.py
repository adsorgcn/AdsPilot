#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cloudflare 插件 · status 动作（落地位活着吗；真点一次走不走得通）

  python3 status.py                                   # /health
  python3 status.py --roundtrip --offer cj:100001:12345 [--slug widget-x-review]
      1 GET /<slug> 是 200 的 HTML
      2 GET /go?o=<offer>&gclid=APTEST... 不跟跳，期望 302 且 location 带 sid=<token>
      3 GET /export?since=<刚才> 带钥匙，期望里面有这个 token
  python3 status.py --selftest
输出 JSON。退出码：0 全通；3 有一步不通；4 未 setup。
"""
import json
import os
import sys
import time
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
import cf_api as CF  # noqa: E402
from setup import load_deploy  # noqa: E402


def health(dep):
    code, _, body = CF.http_get(dep["base_url"] + "/health", timeout=15)
    try:
        j = json.loads(body)
    except ValueError:
        j = {}
    return {"code": code, "ok": code == 200 and j.get("ok") is True, "version": j.get("version"), "pages": j.get("pages"), "offers": j.get("offers")}


def roundtrip(dep, offer, slug=None):
    out = {"steps": []}
    since = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() - 5)) + "Z"
    if slug:
        code, hdr, body = CF.http_get("%s/%s" % (dep["base_url"], slug), timeout=15)
        ok = code == 200 and "text/html" in (hdr.get("Content-Type") or hdr.get("content-type") or "") and "/go?o=" in body
        out["steps"].append({"step": "page", "ok": ok, "code": code, "words": len(body.split())})
    test_gclid = "APTEST" + time.strftime("%Y%m%d%H%M%S")
    q = urllib.parse.urlencode({"o": offer, "gclid": test_gclid, "c": "0", "a": "0", "k": "0", "n": "g", "p": "/" + (slug or "")})
    code, hdr, _ = CF.http_get("%s/go?%s" % (dep["base_url"], q), timeout=15, follow=False)
    loc = hdr.get("Location") or hdr.get("location") or ""
    token = ""
    if loc:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(loc).query)
        token = (qs.get("sid") or qs.get("subid") or [""])[0]
    ok_go = code == 302 and bool(token)
    out["steps"].append({"step": "go", "ok": ok_go, "code": code, "location_host": urllib.parse.urlparse(loc).netloc, "token_len": len(token)})
    code, _, body = CF.http_get("%s/export?since=%s" % (dep["base_url"], urllib.parse.quote(since)), headers={"Authorization": "Bearer " + dep["export_key"]}, timeout=20)
    rows = [json.loads(l) for l in body.splitlines() if l.strip()] if code == 200 else []
    hit = [r for r in rows if r.get("token") == token]
    ok_export = code == 200 and bool(hit) and hit[0].get("gclid") == test_gclid
    out["steps"].append({"step": "export", "ok": ok_export, "code": code, "rows_since": len(rows), "token_found": bool(hit)})
    out["ok"] = all(s["ok"] for s in out["steps"])
    out["token"] = token if ok_export else ""
    out["test_gclid"] = test_gclid
    return out


def selftest():
    qs = urllib.parse.parse_qs(urllib.parse.urlparse("https://www.dpbolvw.net/click-1-2?url=x&sid=ABC").query)
    ok = (qs.get("sid") or [""])[0] == "ABC"
    print("parse sid=%s -> %s" % (qs.get("sid"), "OK" if ok else "FAIL"))
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1) if argv[i].startswith("--") and not argv[i + 1].startswith("--")}
    dep = load_deploy()
    if not dep.get("base_url"):
        print(json.dumps({"error": "先跑 setup.py --apply（data/deploy.json 不存在）"})); return 4
    out = {"host": dep["host"], "health": health(dep)}
    if "--roundtrip" in argv:
        if not kv.get("offer"):
            print(json.dumps({"error": "--roundtrip 要 --offer <offer_ref>"})); return 1
        out["roundtrip"] = roundtrip(dep, kv["offer"], kv.get("slug"))
    ok = out["health"]["ok"] and (out.get("roundtrip", {"ok": True})["ok"])
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0 if ok else 3


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
