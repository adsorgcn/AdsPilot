#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CJ 插件公用：凭据、HTTP、字段翻译。只用标准库。凭据只从环境变量读，不打印。"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

COMMISSIONS_URL = "https://commissions.api.cj.com/query"
ADVERTISER_LOOKUP_URL = "https://advertiser-lookup.api.cj.com/v2/advertiser-lookup"
LINK_SEARCH_URL = "https://link-search.api.cj.com/v2/link-search"
SUB_ID_PARAM = "sid"          # 链接上的 sub-id 参数
SUB_ID_READBACK = "shopperId"  # Commission Detail 回读字段（sid 字段已废弃）


def creds():
    tok = os.environ.get("CJ_ACCESS_TOKEN", "")
    pid = os.environ.get("CJ_PUBLISHER_ID", "")
    return tok, pid


def website_id():
    """推广媒介（网站）ID，9 位，在 accounts.cj.com/promotional-properties 看；Link Search 的 website-id 要的是它，不是 CID。"""
    return os.environ.get("CJ_WEBSITE_ID", "")


def missing_creds():
    tok, pid = creds()
    return [k for k, v in (("CJ_ACCESS_TOKEN", tok), ("CJ_PUBLISHER_ID", pid)) if not v]


class CJError(Exception):
    pass


def graphql(query, timeout=30):
    tok, _ = creds()
    req = urllib.request.Request(COMMISSIONS_URL, data=json.dumps({"query": query}).encode(),
                                 headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json", "User-Agent": "adspilot-cj"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "ignore")
        try:
            msg = "; ".join(x.get("message", "")[:160] for x in json.loads(raw).get("errors", []))
        except Exception:  # noqa: BLE001
            msg = raw[:200]
        raise CJError("HTTP %s: %s" % (e.code, msg or "no body"))
    if body.get("errors"):
        raise CJError("; ".join(x.get("message", "")[:160] for x in body["errors"]))
    return body


def rest_xml(url, params, timeout=30):
    tok, _ = creds()
    req = urllib.request.Request(url + "?" + urllib.parse.urlencode(params), headers={"Authorization": "Bearer " + tok, "User-Agent": "adspilot-cj"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return ET.fromstring(r.read())


def status_map(s):
    s = (s or "").lower()
    return s if s in ("new", "locked", "extended", "closed", "corrected", "reversed") else "unknown"


def commission_row(p, currency="USD"):
    """CJ Commission Detail payload -> schemas/commissions.schema.json 的一行。"""
    amt = float(p.get("pubCommissionAmountUsd") or 0)
    original = p.get("original", True)
    is_cb = (original is False and amt < 0) or bool(p.get("correctionReason") and amt < 0)
    row = {"event_id": str(p.get("commissionId") or p.get("actionId") or ""), "event_time": p.get("eventDate") or p.get("postingDate") or "",
           "click_time": p.get("clickDate") or "", "sub_id": (p.get(SUB_ID_READBACK) or "").strip(), "status": status_map(p.get("actionStatus")),
           "amount": amt, "sale_amount": float(p.get("saleAmountUsd") or 0), "currency": currency,
           "advertiser": p.get("advertiserName") or "", "advertiser_id": str(p.get("advertiserId") or ""),
           "offer_ref": "cj:%s:%s" % (p.get("advertiserId", ""), p.get("aid") or p.get("websiteId") or ""), "action": p.get("actionType") or "",
           "is_chargeback": is_cb}
    if p.get("originalActionId"):
        row["original_event_id"] = str(p["originalActionId"])
    if is_cb:
        row["status"] = "reversed" if row["status"] in ("unknown", "new") else row["status"]
    return row
