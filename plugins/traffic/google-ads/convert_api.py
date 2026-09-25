#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Ads 插件 · convert 动作的 API 路（用户自有凭据）

输入：core/ledger/reconcile.py 的输出（adspilot.conversions）。
做：
  1. 确保账号里有一个「点击上传」类型（UPLOAD_CLICKS）的转化操作，名字取 --conversion-name（默认 affiliate_commission）；没有就建（--apply 才建）
  2. 上传点击转化。两条传输：
       datamanager  Data Manager API events:ingest（Google 2026-09-25 实测口径：新接入一律走这里；需要 OAuth 多一个 scope
                    https://www.googleapis.com/auth/datamanager，refresh token 里没有就退出码 2 报 needs_reauth）
       ads          Google Ads API uploadClickConversions（只对老接入开放；--transport ads 强制）
       默认 auto：refresh token 有 datamanager scope 就走 datamanager，否则试 ads，被拒就报 needs_reauth
  3. uploadConversionAdjustments（Google Ads API）：chargebacks 里能找到原转化时间的行做 RETRACTION
默认 dry-run；--validate-only 让 Google 只校验；--apply 才真传。
用法：
  python3 convert_api.py --conversions runs/<id>/conversions.json [--conversion-name affiliate_commission] [--timezone Asia/Tokyo] [--transport auto|datamanager|ads] [--apply|--validate-only]
  python3 convert_api.py --remove-action <name> --apply        # 测试收尾：删掉转化操作
  python3 convert_api.py --selftest
退出码：0 成功（含零行）；1 输入错误；2 需要本人重新授权（加 datamanager scope）；3 API 失败；4 凭据缺失。
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "core", "ledger"))
from gads_api import Client, GadsError, redact_id  # noqa: E402
from convert_export import fmt_time, tz_of, ledger_time_lookup  # noqa: E402


def find_action(client, name):
    rows = client.search("SELECT conversion_action.resource_name, conversion_action.id, conversion_action.type, conversion_action.status FROM conversion_action WHERE conversion_action.name = '%s'" % name.replace("'", "\\'"))
    for r in rows:
        ca = r["conversionAction"]
        if ca.get("type") == "UPLOAD_CLICKS" and ca.get("status") != "REMOVED":
            return ca["resourceName"]
    return None


def action_operation(name, currency):
    return {"create": {"name": name, "type": "UPLOAD_CLICKS", "category": "PURCHASE", "status": "ENABLED",
                       "countingType": "MANY_PER_CLICK", "clickThroughLookbackWindowDays": 90,
                       "valueSettings": {"defaultValue": 0, "defaultCurrencyCode": currency, "alwaysUseDefaultValue": False},
                       "attributionModelSettings": {"attributionModel": "GOOGLE_ADS_LAST_CLICK"}}}


def build_uploads(conv, action_rn, tz):
    conversions = [{"gclid": r["gclid"], "conversionAction": action_rn, "conversionDateTime": fmt_time(r["conversion_time"], tz),
                    "conversionValue": float(r["value"]), "currencyCode": r["currency"]} for r in conv.get("rows", [])]
    orig = {r["event_id"]: r["conversion_time"] for r in conv.get("rows", [])}
    adjustments, unlinked = [], []
    for cb in conv.get("chargebacks", []):
        ot = orig.get(cb.get("original_event_id")) or (ledger_time_lookup(cb["original_event_id"]) if cb.get("original_event_id") else None)
        if not ot:
            unlinked.append(cb["event_id"]); continue
        adjustments.append({"gclidDateTimePair": {"gclid": cb["gclid"], "conversionDateTime": fmt_time(ot, tz)}, "conversionAction": action_rn,
                            "adjustmentType": "RETRACTION", "adjustmentDateTime": fmt_time(cb["conversion_time"], tz)})
    return conversions, adjustments, unlinked


def to_rfc3339(s):
    from datetime import datetime, timezone
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def datamanager_body(client, conv, action_rn, validate_only):
    dest = {"operatingAccount": {"product": "GOOGLE_ADS", "accountId": client.cid}, "productDestinationId": action_rn.split("/")[-1]}
    if client.login and client.login != client.cid:
        dest["loginAccount"] = {"product": "GOOGLE_ADS", "accountId": client.login}
    events = [{"transactionId": r["event_id"], "eventTimestamp": to_rfc3339(r["conversion_time"]), "adIdentifiers": {"gclid": r["gclid"]},
               "conversionValue": float(r["value"]), "currency": r["currency"], "eventSource": "WEB"} for r in conv.get("rows", [])]
    return {"destinations": [dest], "events": events, "validateOnly": bool(validate_only)}


def upload(client, conv, conversions, adjustments, action_rn, mode, transport="auto"):
    out = {}
    if conversions:
        use = transport
        if use == "auto":
            use = "datamanager" if client.has_scope(client.DATAMANAGER_SCOPE) else "ads"
        if use == "datamanager":
            if not client.has_scope(client.DATAMANAGER_SCOPE):
                out["needs_reauth"] = {"scope": client.DATAMANAGER_SCOPE, "why": "Data Manager API 需要这个 scope；本人在 OAuth 同意屏幕重新授权一次，换新的 refresh token"}
            else:
                res = client.datamanager_ingest(datamanager_body(client, conv, action_rn, mode == "validate"))
                out["conversions"] = {"transport": "datamanager", "sent": len(conversions), "request_id": res.get("requestId", ""),
                                      "warnings": [w.get("description", "")[:160] for w in res.get("fieldWarnings", [])][:5]}
        else:
            body = {"conversions": conversions, "partialFailure": True, "validateOnly": (mode == "validate")}
            res = client.call(":uploadClickConversions", body)
            msg = (res.get("partialFailureError") or {}).get("message", "")
            out["conversions"] = {"transport": "ads", "sent": len(conversions), "results": len(res.get("results", [])), "partial_failure": msg[:300]}
            if "Data Manager API" in msg:
                out["needs_reauth"] = {"scope": client.DATAMANAGER_SCOPE, "why": "这个账号的 uploadClickConversions 已被 Google 限制为老接入；新接入必须走 Data Manager API，需要重新授权加 scope"}
    if adjustments:
        body = {"conversionAdjustments": adjustments, "partialFailure": True, "validateOnly": (mode == "validate")}
        res = client.call(":uploadConversionAdjustments", body)
        out["adjustments"] = {"sent": len(adjustments), "results": len(res.get("results", [])),
                              "partial_failure": (res.get("partialFailureError") or {}).get("message", "")[:300]}
    return out


def selftest():
    conv = {"rows": [{"event_id": "e1", "gclid": "CjwKCAjw_example_gclid_0001", "conversion_name": "affiliate_commission", "conversion_time": "2026-09-11T03:12:44+00:00", "value": 18.4, "currency": "USD"}],
            "chargebacks": [{"event_id": "e2", "original_event_id": "e1", "gclid": "CjwKCAjw_example_gclid_0001", "conversion_name": "affiliate_commission", "conversion_time": "2026-09-18T10:00:00+00:00", "value": -18.4, "currency": "USD"},
                            {"event_id": "e3", "gclid": "x", "conversion_name": "affiliate_commission", "conversion_time": "2026-09-18T10:00:00+00:00", "value": -1, "currency": "USD"}]}
    c, a, u = build_uploads(conv, "customers/1/conversionActions/9", tz_of("Asia/Tokyo"))
    ok = len(c) == 1 and c[0]["conversionDateTime"] == "2026-09-11 12:12:44+09:00" and len(a) == 1 and a[0]["adjustmentType"] == "RETRACTION" and u == ["e3"]
    op = action_operation("affiliate_commission", "USD")
    ok = ok and op["create"]["type"] == "UPLOAD_CLICKS"
    cl = Client(env={"GOOGLE_ADS_CUSTOMER_ID": "1234567890", "GOOGLE_ADS_LOGIN_CUSTOMER_ID": "9999999999"})
    dm = datamanager_body(cl, conv, "customers/1234567890/conversionActions/77", True)
    ok = ok and dm["destinations"][0]["productDestinationId"] == "77" and dm["destinations"][0]["loginAccount"]["accountId"] == "9999999999" \
        and dm["events"][0]["eventTimestamp"] == "2026-09-11T03:12:44Z" and dm["events"][0]["adIdentifiers"]["gclid"].startswith("Cjw")
    print("conversions=%d adjustments=%d unlinked=%s -> %s" % (len(c), len(a), u, "OK" if ok else "FAIL"))
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1) if argv[i].startswith("--") and not argv[i + 1].startswith("--")}
    mode = "apply" if "--apply" in argv else ("validate" if "--validate-only" in argv else "dry")
    if "remove-action" in kv:
        client = Client()
        if client.missing:
            print(json.dumps({"error": "missing env: %s" % ", ".join(client.missing)})); return 4
        rn = find_action(client, kv["remove-action"])
        if not rn:
            print(json.dumps({"removed": False, "why": "not found"})); return 0
        if mode != "apply":
            print(json.dumps({"would_remove": redact_id(rn.split("/")[-1])})); return 0
        try:
            client.mutate("conversionActions", [{"remove": rn}])
            print(json.dumps({"removed": True})); return 0
        except GadsError as e:
            print(json.dumps({"error": client.error_summary(e)})); return 3
    if "conversions" not in kv:
        print(__doc__); return 1
    conv = json.load(open(kv["conversions"], encoding="utf-8"))
    if conv.get("type") != "adspilot.conversions":
        print(json.dumps({"error": "input is not adspilot.conversions (run core/ledger/reconcile.py first)"})); return 1
    name = kv.get("conversion-name", conv.get("conversion_name") or "affiliate_commission")
    tz = tz_of(kv.get("timezone", "UTC"))
    currency = (conv.get("rows") or [{}])[0].get("currency", "USD") if conv.get("rows") else "USD"
    client = Client()
    if client.missing and mode != "dry":
        print(json.dumps({"error": "missing env: %s" % ", ".join(client.missing)})); return 4
    out = {"mode": mode, "customer": redact_id(client.cid), "conversion_name": name}
    try:
        if mode == "dry":
            action_rn = "customers/%s/conversionActions/<lookup-or-create>" % (client.cid or "?")
        else:
            action_rn = find_action(client, name)
            if not action_rn:
                if mode == "validate":
                    client.mutate("conversionActions", [action_operation(name, currency)], validate_only=True)
                    out["conversion_action"] = "would create (validated)"
                    action_rn = "customers/%s/conversionActions/1" % client.cid
                else:
                    res = client.mutate("conversionActions", [action_operation(name, currency)])
                    action_rn = res["results"][0]["resourceName"]
                    out["conversion_action"] = "created"
            else:
                out["conversion_action"] = "exists"
        conversions, adjustments, unlinked = build_uploads(conv, action_rn, tz)
        out.update({"rows": len(conversions), "retractions": len(adjustments), "unlinked_chargebacks": unlinked})
        if mode != "dry":
            out.update(upload(client, conv, conversions, adjustments, action_rn, mode, kv.get("transport", "auto")))
        out["applied"] = (mode == "apply") and "needs_reauth" not in out
    except GadsError as e:
        out["error"] = client.error_summary(e)
    print(json.dumps(out, ensure_ascii=False, indent=2))
    if "error" in out:
        return 3
    return 2 if "needs_reauth" in out else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
