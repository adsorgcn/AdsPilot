#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CJ 插件 · offers 动作（offer 发现与尽调数据）

api 路：Advertiser Lookup（advertiser-lookup.api.cj.com/v2，XML）拉已加入（joined）的商家，取 EPC（7 天与 3 个月，每百次点击）、
网络排名、品类、佣金条款；再按 --advertiser-ids 精确查。PPC 与品牌词竞价政策 API 不给，从 data/inbox/cj-offer-policy.json 读用户核对过的值，
没有就填 null（主干把 null 当不允许，不猜）。
json 路：--json 读一份已按输出形状整理好的文件（用户从后台抄的）。

输出：offer 列表 JSON
  {offer_ref, network, advertiser, advertiser_id, epc, epc_3m, network_rank, commission, cookie_days, lock_days, ppc_allowed, brand_bidding_allowed,
   allowed_traffic, category, status}

用法：
  python3 offers.py [--advertiser-ids 100001,100002] [--out runs/<id>/offers.json]
  python3 offers.py --json data/inbox/cj-offers.json --out ...
  python3 offers.py --selftest
退出码：0 成功；3 API 失败；4 凭据缺失。
"""
import json
import os
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
import cj_common as C  # noqa: E402


def load_policy():
    p = os.path.join(ROOT, "data", "inbox", "cj-offer-policy.json")
    if os.path.exists(p):
        try:
            return json.load(open(p, encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return {}
    return {}


def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def parse_advertisers(root, policy):
    out = []
    for adv in root.iter("advertiser"):
        aid = (adv.findtext("advertiser-id") or "").strip()
        cat = adv.find("primary-category")
        actions = adv.find("actions")
        commission = None
        if actions is not None:
            for a in actions.findall("action"):
                c = a.findtext("commission/default")
                if c:
                    commission = c.strip(); break
        pol = policy.get(aid, {})
        out.append({"offer_ref": "cj:%s:" % aid, "network": "cj", "advertiser": (adv.findtext("advertiser-name") or "").strip(), "advertiser_id": aid,
                    "epc": _f(adv.findtext("seven-day-epc")), "epc_3m": _f(adv.findtext("three-month-epc")), "network_rank": _f(adv.findtext("network-rank")),
                    "commission": commission, "cookie_days": pol.get("cookie_days"), "lock_days": pol.get("lock_days"),
                    "ppc_allowed": pol.get("ppc_allowed"), "brand_bidding_allowed": pol.get("brand_bidding_allowed"),
                    "allowed_traffic": pol.get("allowed_traffic"), "reversal_rate": pol.get("reversal_rate"),
                    "category": ((cat.findtext("child") if cat is not None else "") or "").strip().lower(),
                    "status": (adv.findtext("relationship-status") or "").strip().lower() or "joined"})
    return out


def fetch(advertiser_ids=None):
    miss = C.missing_creds()
    if miss:
        return None, "missing env: %s" % ", ".join(miss), 4
    _, pid = C.creds()
    params = {"requestor-cid": pid, "advertiser-ids": advertiser_ids or "joined", "records-per-page": "100"}
    try:
        root = C.rest_xml(C.ADVERTISER_LOOKUP_URL, params)
    except Exception as e:  # noqa: BLE001
        return None, "api failed: %s" % str(e)[:200], 3
    return parse_advertisers(root, load_policy()), "", 0


def selftest():
    xml = """<cj-api><advertisers total-matched="1"><advertiser><advertiser-id>100001</advertiser-id><advertiser-name>Brand X</advertiser-name>
    <network-rank>3</network-rank><seven-day-epc>12.34</seven-day-epc><three-month-epc>10.1</three-month-epc><relationship-status>joined</relationship-status>
    <primary-category><parent>Computer &amp; Electronics</parent><child>Software</child></primary-category>
    <actions><action><name>Sale</name><type>sale</type><commission><default>8.00%</default></commission></action></actions></advertiser></advertisers></cj-api>"""
    rows = parse_advertisers(ET.fromstring(xml), {"100001": {"ppc_allowed": True, "cookie_days": 45}})
    ok = len(rows) == 1 and rows[0]["epc"] == 12.34 and rows[0]["ppc_allowed"] is True and rows[0]["category"] == "software" and rows[0]["commission"] == "8.00%"
    print(json.dumps(rows[0]), "OK" if ok else "FAIL")
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1) if argv[i].startswith("--") and not argv[i + 1].startswith("--")}
    if "json" in kv:
        rows = json.load(open(kv["json"], encoding="utf-8"))
    else:
        rows, msg, rc = fetch(kv.get("advertiser-ids"))
        if rc:
            print(msg); return rc
    if kv.get("out"):
        os.makedirs(os.path.dirname(os.path.abspath(kv["out"])), exist_ok=True)
        json.dump(rows, open(kv["out"], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("offers=%d -> %s" % (len(rows), kv["out"]))
    else:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
