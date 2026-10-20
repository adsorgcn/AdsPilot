#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Impact 插件公用：凭据、HTTP、分页、字段翻译。只用标准库。凭据只从环境变量读，不打印，不进日志；报错信息里的 AccountSID 也抹掉。

伙伴 API：https://api.impact.com/Mediapartners/{AccountSID}/…，HTTP Basic（AccountSID 是用户名，AuthToken 是密码），Accept: application/json。
分页：Page、PageSize（默认 1000），响应带 @total、@numpages、@nextpageuri。
限速（响应头 X-RateLimit-Limit-hour）：/Actions 每小时 500 次，/Reports 250，其余 1000；超限 429 带 Retry-After。
2026-10-20 对着真账号只读核过：Campaigns、Actions、ActionUpdates、Reports 回 200；token 没勾作用域的资源（当时是 Contracts、Ads、Deals）
回 403 {"status":403,"title":"Access Denied"}，这里抛 Forbidden 让调用方降级，不算失败。
"""
import base64
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

HOST = "https://api.impact.com"
SUB_ID_PARAM = "subId1"       # 追踪链接上的 sub-id 参数（subId1 subId2 subId3 sharedId 各 255 位字母数字，vanity 链接也支持）
SUB_ID_READBACK = "SubId1"    # Actions 回读字段
WINDOW_DAYS = 45              # StartDate/EndDate 单次跨度上限（文档）
UA = "adspilot-impact"


def creds():
    return os.environ.get("IMPACT_ACCOUNT_SID", ""), os.environ.get("IMPACT_AUTH_TOKEN", "")


def missing_creds():
    sid, tok = creds()
    return [k for k, v in (("IMPACT_ACCOUNT_SID", sid), ("IMPACT_AUTH_TOKEN", tok)) if not v]


class ImpactError(Exception):
    """API 失败（网络、5xx、429 两次）。退出码 3。"""


class Forbidden(ImpactError):
    """403：token 的作用域没勾这个资源。调用方降级，不算失败。"""


class Unauthorized(ImpactError):
    """401：凭据错或 token 已重置。退出码 4。"""


def _auth():
    sid, tok = creds()
    return "Basic " + base64.b64encode(("%s:%s" % (sid, tok)).encode("utf-8")).decode("ascii")


def _strip(u):
    sid, _ = creds()
    return u.replace(sid, "<SID>") if sid else u


def url_for(path_or_uri, params=None):
    """path 相对 /Mediapartners/{SID}/；@nextpageuri 给的是以 / 开头的绝对路径，原样接在 HOST 后。"""
    sid, _ = creds()
    u = HOST + path_or_uri if path_or_uri.startswith("/") else "%s/Mediapartners/%s/%s" % (HOST, sid, path_or_uri)
    if params:
        u += ("&" if "?" in u else "?") + urllib.parse.urlencode(params)
    return u


def get(path_or_uri, params=None, timeout=30):
    """GET 一个资源，返回 (json, 响应头小写字典)。429 按 Retry-After 退避一次（最多 60 秒）再试；403 抛 Forbidden；401 抛 Unauthorized；其余非 2xx 抛 ImpactError。"""
    u = url_for(path_or_uri, params)
    for attempt in (1, 2):
        req = urllib.request.Request(u, headers={"Authorization": _auth(), "Accept": "application/json", "User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8")), {k.lower(): v for k, v in r.headers.items()}
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "ignore")[:200]
            if e.code == 429 and attempt == 1:
                try:
                    wait = min(60, int(e.headers.get("Retry-After", "5") or 5))
                except ValueError:
                    wait = 5
                time.sleep(wait)
                continue
            if e.code == 403:
                raise Forbidden("403 %s: %s" % (_strip(u), body))
            if e.code == 401:
                raise Unauthorized("401：凭据错或 token 已重置（IMPACT_ACCOUNT_SID / IMPACT_AUTH_TOKEN）")
            raise ImpactError("HTTP %s %s: %s" % (e.code, _strip(u), body))
        except (urllib.error.URLError, OSError) as e:
            raise ImpactError("network %s: %s" % (_strip(u), str(e)[:160]))
    raise ImpactError("429 twice: %s" % _strip(u))


def get_all(path, params, key, max_pages=100):
    """翻页取齐：跟 @nextpageuri 走，没有就按 @numpages 加 Page。返回 (items, 请求次数)。"""
    items, pages = [], 0
    uri, prm = path, dict(params or {})
    while uri and pages < max_pages:
        d, _ = get(uri, prm)
        pages += 1
        items.extend(d.get(key) or [])
        nxt = d.get("@nextpageuri") or ""
        if nxt:
            uri, prm = nxt, None
            continue
        try:
            page, num = int(d.get("@page") or 1), int(d.get("@numpages") or 1)
        except (TypeError, ValueError):
            break
        if page >= num:
            break
        uri, prm = path, dict(params or {}, Page=str(page + 1))
    return items, pages


def num(x):
    try:
        return None if x is None or x == "" else float(x)
    except (TypeError, ValueError):
        return None


def status_map(state):
    """Impact 的 State 只有三个值。PENDING 等锁定或人工审核 ⇒ new；APPROVED 已批付 ⇒ closed；REVERSED 不付 ⇒ reversed。"""
    return {"PENDING": "new", "APPROVED": "closed", "REVERSED": "reversed"}.get((state or "").upper(), "unknown")


def days(window, unit):
    w = num(window)
    if w is None:
        return None
    u = (unit or "DAY").upper()
    if u.startswith("HOUR"):
        return round(w / 24.0, 2)
    if u.startswith("WEEK"):
        return w * 7
    if u.startswith("MONTH"):
        return w * 30
    return w


def contract_terms(contract):
    """Contract.Terms -> commission、payout_rate、payout_amount、cookie_days、lock_days、currency、terms_text、contract_id；取不到的 null。
    取 EventCategory=SALE 的那条 EventPayout，没有就第一条。cookie_days 取 ValidReferrals 里 Type 以 CLICK 开头的窗口折成天。"""
    t = (contract or {}).get("Terms") or {}
    eps = t.get("EventPayouts") or []
    ep = next((e for e in eps if (e.get("EventCategory") or "").upper() == "SALE"), eps[0] if eps else {})
    rate, amt = num(ep.get("DefaultPayoutRate")), num(ep.get("DefaultPayout"))
    cur = (t.get("Currency") or "").upper() or None
    commission = "%.2f%%" % rate if rate else ("%s %.2f" % (cur or "", amt)).strip() if amt else None
    cookie = None
    for vr in ep.get("ValidReferrals") or []:
        if (vr.get("Type") or "").upper().startswith("CLICK"):
            cookie = days(vr.get("Window"), vr.get("WindowUnit"))
            break
    lines = [("%s: %s" % (s.get("TermsName") or "", s.get("TermsContent") or "")).strip(": ") for s in (t.get("SpecialTermsList") or [])]
    return {"commission": commission, "payout_rate": rate, "payout_amount": amt, "cookie_days": cookie,
            "lock_days": num((ep.get("Locking") or {}).get("Period")), "currency": cur, "event_category": ep.get("EventCategory"),
            "terms_text": "\n".join(x for x in lines if x), "contract_id": str((contract or {}).get("Id") or "") or None}


def campaign_offer(c, contract=None, policy=None, with_terms=False):
    """一个 Program（Campaigns 里的一条）加它的 Contract 与用户核对过的政策 -> 契约形状的 offer 行。
    epc 一律 null：伙伴 API 不给项目层面的 EPC，不编数。HasStandDownPolicy 为 true ⇒ brand_bidding_allowed false，政策文件说 true 也不放行。"""
    pol = policy or {}
    cid, aid = str(c.get("CampaignId") or ""), str(c.get("AdvertiserId") or "")
    terms = contract_terms(contract) if contract else {}
    standdown = str(c.get("HasStandDownPolicy")).lower() == "true"
    row = {"offer_ref": "impact:%s:%s" % (aid, cid), "network": "impact", "advertiser": c.get("AdvertiserName") or "", "advertiser_id": aid,
           "campaign_id": cid, "campaign": c.get("CampaignName") or "", "program_type": c.get("Type"),
           "epc": None, "epc_3m": None, "epc_currency": terms.get("currency") or "USD", "network_rank": None,
           "commission": terms.get("commission"), "payout_rate": terms.get("payout_rate"), "payout_amount": terms.get("payout_amount"),
           "cookie_days": pol.get("cookie_days", terms.get("cookie_days")), "lock_days": pol.get("lock_days", terms.get("lock_days")),
           "ppc_allowed": pol.get("ppc_allowed"), "brand_bidding_allowed": False if standdown else pol.get("brand_bidding_allowed"),
           "has_stand_down_policy": standdown, "allowed_traffic": pol.get("allowed_traffic"), "reversal_rate": pol.get("reversal_rate"),
           "category": pol.get("category"), "program_url": c.get("CampaignUrl") or c.get("AdvertiserUrl") or "",
           "click_url": c.get("TrackingLink") or "", "allows_deeplinking": str(c.get("AllowsDeeplinking")).lower() == "true",
           "deeplink_domains": c.get("DeeplinkDomains") or [], "shipping_regions": c.get("ShippingRegions") or [],
           "status": (c.get("ContractStatus") or "").lower() or "active", "contract_id": terms.get("contract_id")}
    if with_terms:
        row["terms_text"] = terms.get("terms_text") or ""
    return row


def action_rows(a, adv_by_campaign=None, updates=None):
    """一条 Action -> schemas/commissions.schema.json 的行（列表）。
    PENDING、APPROVED：一行佣金，sub_id 装 SubId1，click_time 装 ReferringDate，event_time 装 EventDate。
    REVERSED：只出一行拒付，event_id "<Id>:rev"，amount 为负，is_chargeback true，original_event_id 指向原 Id，event_time 取 ActionUpdates 的 UpdateDate
    （没有就 ClearedDate、EventDate）；金额优先取 ActionUpdates 的 DeltaPayout（负数），没有就取 Payout 或 IntendedPayout 的相反数。
    不出正数的 REVERSED 行：对账会把 status=reversed 当拒付，正数会灌成正向调整。"""
    cid = str(a.get("CampaignId") or "")
    adv = str((adv_by_campaign or {}).get(cid) or "")
    payout = num(a.get("Payout")) or 0.0
    row = {"event_id": str(a.get("Id") or ""), "event_time": a.get("EventDate") or a.get("CreationDate") or "",
           "click_time": a.get("ReferringDate") or "", "sub_id": (a.get(SUB_ID_READBACK) or "").strip(),
           "status": status_map(a.get("State")), "amount": payout, "sale_amount": num(a.get("Amount")) or 0.0,
           "currency": (a.get("Currency") or "USD").upper(), "advertiser": a.get("CampaignName") or "", "advertiser_id": adv or cid,
           "offer_ref": "impact:%s:%s" % (adv or "?", cid), "action": a.get("ActionTrackerName") or "", "is_chargeback": False}
    if row["status"] != "reversed":
        return [row]
    u = (updates or {}).get(row["event_id"]) or {}
    delta = u.get("delta")
    amt = -abs(delta) if delta else -abs(payout or num(a.get("IntendedPayout")) or 0.0)
    cb = dict(row, event_id=row["event_id"] + ":rev", event_time=u.get("time") or a.get("ClearedDate") or row["event_time"],
              amount=round(amt, 2), is_chargeback=True, original_event_id=row["event_id"])
    return [cb]
