#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
关键词插件 · Google Ads Keyword Planner（用户自己的 Google Ads 凭据，与流量插件同一套环境变量）

两个动作：
  suggest --seed "roborock" [--url https://us.roborock.com/] --country US --language en [--limit 50] [--out f.json]
          种子词加网址出候选词：月搜索、竞争、首页出价低位与高位（广告账户币种）
  suggest --batch seeds.json [--out f.json]      seeds.json: [{"id":"cj:1:2","seed":["roborock"],"url":"https://..."}]，一个进程查多组
  volume  --keywords "a,b,c" --country US --language en    已有词查数据
输出 {"type":"adspilot.keywords","currency":"HKD","country":"US","language":"en","rows":[{text,volume,competition,cpc_low,cpc_high,brand}]}
batch 输出 {"type":"adspilot.keywords.batch","currency":..,"results":{id: rows}, "errors":{id: msg}}
brand：词里含种子词本身（品牌词）。联盟常不许品牌词竞价，选品与建系列时按政策过滤。
退出码：0 成功；3 API 失败；4 凭据缺失。
"""
import json
import os
import re
import sys
import time
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "plugins", "traffic", "google-ads"))
from gads_api import Client, GadsError  # noqa: E402


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def brand_tokens(seeds, url=None):
    """品牌识别用的记号：整个商家名与网址的主域名，都去掉空格与符号比。contacts direct 与 contactsdirect 算同一个。
    不拿名字里的单个词当记号：Trampoline Parts and Supply 的 trampoline 是品类词，实测会把 98% 的词误标成品牌。"""
    toks = set()
    for s in seeds or []:
        if norm(s):
            toks.add(norm(s))
    if url:
        host = urlparse(url).netloc.lower().split(":")[0]
        parts = [p for p in host.split(".") if p not in ("www", "us", "uk", "shop", "store")]
        if len(parts) >= 2 and len(parts[-2]) >= 4:
            toks.add(norm(parts[-2]))
    return toks


def row(text, m, toks):
    t = norm(text)
    return {"text": text, "volume": int(m.get("avgMonthlySearches") or 0), "competition": m.get("competition") or "",
            "cpc_low": round(int(m.get("lowTopOfPageBidMicros") or 0) / 1e6, 2), "cpc_high": round(int(m.get("highTopOfPageBidMicros") or 0) / 1e6, 2),
            "brand": any(k and k in t for k in toks)}


def homepage(url):
    u = urlparse(url)
    return "%s://%s/" % (u.scheme or "https", u.netloc) if u.netloc else url


class Planner:
    def __init__(self, client, country="US", language="en"):
        self.c = client
        self.geo = client.geo_constant(country)
        self.lang = client.language_constant(language)
        self.country, self.language = country.upper(), language.lower()
        self.currency = client.search("SELECT customer.currency_code FROM customer")[0]["customer"]["currencyCode"]

    def suggest(self, seeds, url=None, limit=100):
        """有网址就只用网址（商家首页）当种子：实测它给出品类词（robot vacuum cleaner、contact lenses），
        网址加品牌词一起当种子只回品牌词。种子词只用来标 brand。没网址才用种子词。"""
        seeds = [s for s in (seeds or []) if s]
        body = {"language": self.lang, "geoTargetConstants": [self.geo], "keywordPlanNetwork": "GOOGLE_SEARCH", "pageSize": min(int(limit), 1000)}
        if url:
            body["urlSeed"] = {"url": homepage(url)}
        else:
            body["keywordSeed"] = {"keywords": seeds[:20]}
        r = self.c.call(":generateKeywordIdeas", body)
        toks = brand_tokens(seeds, url)
        return [row(x["text"], x.get("keywordIdeaMetrics") or {}, toks) for x in (r.get("results") or [])][:int(limit)]

    def volume(self, keywords):
        body = {"keywords": keywords[:10000], "language": self.lang, "geoTargetConstants": [self.geo], "keywordPlanNetwork": "GOOGLE_SEARCH"}
        r = self.c.call(":generateKeywordHistoricalMetrics", body)
        return [row(x["text"], x.get("keywordMetrics") or {}, set()) for x in (r.get("results") or [])]


def clean_brand(name):
    """联盟里的商家名 -> 种子词：去掉 Affiliate Program、Inc、LLC 之类。"""
    n = re.sub(r"\((.*?)\)", " ", name or "")
    n = re.sub(r"\b(affiliate|program|inc|llc|ltd|limited|corp|corporation|co|company|us|usa|uk|official|store|shop)\b\.?", " ", n, flags=re.I)
    n = re.sub(r"[^A-Za-z0-9' ]+", " ", n)
    n = re.sub(r"\s+", " ", n).strip().lower()
    return n


def selftest():
    r = row("Roborock S8", {"avgMonthlySearches": "2400", "competition": "HIGH", "lowTopOfPageBidMicros": "10200000", "highTopOfPageBidMicros": "16600000"}, brand_tokens(["roborock"]))
    ok = r["volume"] == 2400 and r["cpc_low"] == 10.2 and r["cpc_high"] == 16.6 and r["brand"] is True
    t = brand_tokens(["contactsdirect"], "https://www.contactsdirect.com/")
    ok = ok and row("contacts direct coupon", {}, t)["brand"] and not row("contact lenses", {}, t)["brand"]
    ok = ok and homepage("https://us.roborock.com/pages/") == "https://us.roborock.com/"
    ok = ok and clean_brand("Roborock Affiliate Program") == "roborock" and clean_brand("Gabriel & Co. Fine Jewelry And Bridal") == "gabriel fine jewelry and bridal"
    print("row=%s brand_clean=%s -> %s" % (r, clean_brand("Roborock Affiliate Program"), "OK" if ok else "FAIL"))
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    if not argv or argv[0] not in ("suggest", "volume"):
        print(__doc__); return 1
    cmd = argv[0]
    kv = {argv[i][2:]: argv[i + 1] for i in range(1, len(argv) - 1) if argv[i].startswith("--") and not argv[i + 1].startswith("--")}
    client = Client()
    if client.missing:
        print(json.dumps({"error": "missing env: %s" % ", ".join(client.missing)})); return 4
    try:
        pl = Planner(client, kv.get("country", "US"), kv.get("language", "en"))
    except (GadsError, ValueError, KeyError, IndexError) as e:
        print(json.dumps({"error": "planner init failed: %s" % (client.error_summary(e) if isinstance(e, GadsError) else e)})); return 3
    head = {"currency": pl.currency, "country": pl.country, "language": pl.language, "pulled_at": time.strftime("%Y-%m-%dT%H:%M:%S")}
    try:
        if cmd == "volume":
            out = dict(head, type="adspilot.keywords", rows=pl.volume([k.strip() for k in kv.get("keywords", "").split(",") if k.strip()]))
        elif kv.get("batch"):
            items = json.load(open(kv["batch"], encoding="utf-8"))
            res, errs = {}, {}
            for i, it in enumerate(items):
                if i:
                    time.sleep(1.0)
                try:
                    res[it["id"]] = pl.suggest(it.get("seed") or [], it.get("url"), int(kv.get("limit", 100)))
                except GadsError as e:
                    errs[it["id"]] = client.error_summary(e)[:200]
            out = dict(head, type="adspilot.keywords.batch", results=res, errors=errs)
        else:
            seeds = [s.strip() for s in kv.get("seed", "").split(",") if s.strip()]
            out = dict(head, type="adspilot.keywords", rows=pl.suggest(seeds, kv.get("url"), int(kv.get("limit", 100))))
    except GadsError as e:
        print(json.dumps({"error": client.error_summary(e)})); return 3
    if kv.get("out"):
        os.makedirs(os.path.dirname(os.path.abspath(kv["out"])), exist_ok=True)
        json.dump(out, open(kv["out"], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        n = len(out.get("rows") or []) or sum(len(v) for v in (out.get("results") or {}).values())
        print(json.dumps({"out": kv["out"], "rows": n, "currency": pl.currency, "errors": out.get("errors") or {}}))
    else:
        print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
