#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Impact 插件 · offers 动作（offer 数据与尽调字段）

api 路：GET /Campaigns?InsertionOrderStatus=Active 拉已加入的项目，只留 Type=Performance 且 ContractStatus=Active 的；再 GET /Contracts 拿佣金率、锁定期、
cookie 窗口、币种与特别条款文本。token 没勾 Contracts 作用域时 Contracts 回 403：这几项填 null，stderr 说明，不算失败。
EPC：Impact 伙伴 API 不给任何项目层面的 EPC 或转化率，epc 与 epc_3m 一律 null，不编数。选品第一条（词的出价 < 每次点击赚的钱）算不出来，开局第一轮由用户
--pick 定；跑起来以后用 partner_performance_by_program 报表与自己的点击算真实 EPC。
PPC 与品牌词竞价政策：HasStandDownPolicy 为 true ⇒ brand_bidding_allowed false；其余从 data/inbox/impact-offer-policy.json（按 CampaignId 键：ppc_allowed、
brand_bidding_allowed、cookie_days、lock_days、allowed_traffic、reversal_rate、category）读用户核对过的值，没有就 null（主干把 null 当不允许，不猜）。
json 路：--json 读一份已按输出形状整理好的文件。

输出：offer 列表 JSON，与 cj/offers.py 同形：
  {offer_ref "impact:<AdvertiserId>:<CampaignId>", network, advertiser, advertiser_id, campaign_id, epc null, epc_3m null, commission, payout_rate, payout_amount,
   cookie_days, lock_days, ppc_allowed, brand_bidding_allowed, has_stand_down_policy, allowed_traffic, category, program_url, click_url（TrackingLink）, status, …}

用法：
  python3 offers.py [--campaign-ids 4321,4322] [--with-terms] [--out runs/<id>/offers.json]
  python3 offers.py --json data/inbox/impact-offers.json --out ...
  python3 offers.py --selftest
退出码：0 成功（账号零个项目也是 0，rows 为空并在 stderr 说明）；3 API 失败；4 凭据缺失或凭据错。
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
import impact_common as I  # noqa: E402

FIX = os.path.join(ROOT, "tests", "fixtures")


def load_policy():
    p = os.path.join(ROOT, "data", "inbox", "impact-offer-policy.json")
    if os.path.exists(p):
        try:
            return json.load(open(p, encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return {}
    return {}


def select(camps, campaign_ids=None):
    """只留 Performance 且合同 Active 的；--campaign-ids 再过滤。"""
    want = {x.strip() for x in (campaign_ids or "").split(",") if x.strip()}
    return [c for c in camps if (c.get("Type") or "").lower() == "performance" and (c.get("ContractStatus") or "").lower() == "active"
            and (not want or str(c.get("CampaignId")) in want)]


def build(camps, contracts, policy, with_terms=False):
    by_cid = {str(c.get("CampaignId")): c for c in contracts or []}
    return [I.campaign_offer(c, by_cid.get(str(c.get("CampaignId"))), policy.get(str(c.get("CampaignId"))), with_terms) for c in camps]


def fetch(campaign_ids=None, with_terms=False):
    """返回 (rows, notes, rc)。notes 给 stderr。"""
    miss = I.missing_creds()
    if miss:
        return None, ["missing env: %s" % ", ".join(miss)], 4
    notes = []
    try:
        camps, _ = I.get_all("Campaigns", {"InsertionOrderStatus": "Active"}, "Campaigns")
    except I.Unauthorized as e:
        return None, [str(e)], 4
    except I.ImpactError as e:
        return None, ["api failed: %s" % str(e)[:200]], 3
    camps = select(camps, campaign_ids)
    contracts = []
    if camps:
        try:
            contracts, _ = I.get_all("Contracts", {}, "Contracts")
        except I.Forbidden:
            notes.append("Contracts 403：token 作用域没勾 Contracts，commission、cookie_days、lock_days 为 null；到 app.impact.com Settings → Technical → API 给这个 token 加 Contracts 读权限")
        except I.ImpactError as e:
            notes.append("Contracts 拉取失败（%s），合同字段为 null" % str(e)[:120])
    else:
        notes.append("账号没有已加入的 Performance 项目：先在 Marketplace 申请品牌，获批后再跑")
    return build(camps, contracts, load_policy(), with_terms), notes, 0


def selftest():
    camps = json.load(open(os.path.join(FIX, "impact.campaigns.json"), encoding="utf-8"))["Campaigns"]
    contracts = json.load(open(os.path.join(FIX, "impact.contracts.json"), encoding="utf-8"))["Contracts"]
    sel = select(camps)
    rows = build(sel, contracts, {"4322": {"ppc_allowed": True, "brand_bidding_allowed": True, "category": "software"}}, with_terms=True)
    by = {r["campaign_id"]: r for r in rows}
    x, y = by.get("4321", {}), by.get("4322", {})
    checks = {
        "只留 Performance+Active（Creator 出局）": len(sel) == 2 and "4323" not in by,
        "offer_ref 形状": x.get("offer_ref") == "impact:1001:4321",
        "stand-down ⇒ brand_bidding_allowed false": x.get("brand_bidding_allowed") is False and x.get("has_stand_down_policy") is True,
        "合同：8.00% cookie 30 天 lock 30": x.get("commission") == "8.00%" and x.get("cookie_days") == 30 and x.get("lock_days") == 30 and x.get("payout_rate") == 8.0,
        "合同：固定金额 USD 5.00 cookie 7": y.get("commission") == "USD 5.00" and y.get("payout_amount") == 5.0 and y.get("cookie_days") == 7,
        "政策文件覆盖 ppc/brand/category": y.get("ppc_allowed") is True and y.get("brand_bidding_allowed") is True and y.get("category") == "software",
        "没政策 ⇒ ppc null": x.get("ppc_allowed") is None,
        "epc 不编数": x.get("epc") is None and x.get("epc_3m") is None,
        "click_url 是 TrackingLink": x.get("click_url", "").startswith("https://brand-x.sjv.io/c/"),
        "条款文本带出": "trademark" in x.get("terms_text", "").lower(),
        "没合同 ⇒ 合同字段 null": build(sel, [], {})[0].get("commission") is None,
        "--campaign-ids 过滤": [r["campaign_id"] for r in build(select(camps, "4322"), contracts, {})] == ["4322"],
    }
    ok = all(checks.values())
    print("offers=%d %s -> %s" % (len(rows), {k: v for k, v in checks.items() if not v} or "all checks pass", "OK" if ok else "FAIL"))
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1) if argv[i].startswith("--") and not argv[i + 1].startswith("--")}
    if "json" in kv:
        rows = json.load(open(kv["json"], encoding="utf-8"))
    else:
        rows, notes, rc = fetch(kv.get("campaign-ids"), with_terms=("--with-terms" in argv))
        if rc:
            print("; ".join(notes)); return rc
        for n in notes:
            sys.stderr.write(n + "\n")
    if kv.get("out"):
        os.makedirs(os.path.dirname(os.path.abspath(kv["out"])), exist_ok=True)
        json.dump(rows, open(kv["out"], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("offers=%d -> %s" % (len(rows), kv["out"]))
    else:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
