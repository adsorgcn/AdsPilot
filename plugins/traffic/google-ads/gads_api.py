#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Ads 插件公用：REST 客户端（只用标准库）。

凭据只从环境变量读，不落盘、不打印：
  GOOGLE_ADS_CLIENT_ID  GOOGLE_ADS_CLIENT_SECRET  GOOGLE_ADS_REFRESH_TOKEN  GOOGLE_ADS_CUSTOMER_ID
  可选 GOOGLE_ADS_DEVELOPER_TOKEN（过渡期）  GOOGLE_ADS_LOGIN_CUSTOMER_ID  GOOGLE_ADS_API_VERSION（默认 v25）
所有 mutate 都支持 validate_only：Google 只校验不落库。
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

NEEDED = ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"]


class GadsError(Exception):
    def __init__(self, status, body):
        self.status, self.body = status, body
        super().__init__("HTTP %s: %s" % (status, body[:400]))


class Client:
    def __init__(self, env=None):
        env = env or os.environ
        self.missing = [k for k in NEEDED if not env.get(k)]
        self.cid = env.get("GOOGLE_ADS_CUSTOMER_ID", "").replace("-", "")
        self.login = env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "").replace("-", "")
        self.dev = env.get("GOOGLE_ADS_DEVELOPER_TOKEN", "")
        self.ver = env.get("GOOGLE_ADS_API_VERSION") or "v25"
        self._client_id = env.get("GOOGLE_ADS_CLIENT_ID", "")
        self._secret = env.get("GOOGLE_ADS_CLIENT_SECRET", "")
        self._refresh = env.get("GOOGLE_ADS_REFRESH_TOKEN", "")
        self._token = None
        self.calls = []

    # ------------------------------------------------------------ auth
    def token(self):
        if self._token:
            return self._token
        data = urllib.parse.urlencode({"client_id": self._client_id, "client_secret": self._secret,
                                       "refresh_token": self._refresh, "grant_type": "refresh_token"}).encode()
        req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data, method="POST")
        with urllib.request.urlopen(req, timeout=20) as r:
            d = json.loads(r.read().decode())
        self._token = d["access_token"]
        self.scopes = set((d.get("scope") or "").split())
        return self._token

    def has_scope(self, scope):
        self.token()
        return scope in getattr(self, "scopes", set())

    DATAMANAGER_SCOPE = "https://www.googleapis.com/auth/datamanager"

    def datamanager_ingest(self, body):
        """Data Manager API events:ingest（新接入的离线点击转化必须走这里；需要 datamanager scope）。"""
        req = urllib.request.Request("https://datamanager.googleapis.com/v1/events:ingest", data=json.dumps(body).encode(),
                                     headers={"Authorization": "Bearer " + self.token(), "Content-Type": "application/json"}, method="POST")
        self.calls.append(("POST", "datamanager:events:ingest"))
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read().decode("utf-8")
                return json.loads(raw) if raw.strip() else {}
        except urllib.error.HTTPError as e:
            raise GadsError(e.code, e.read().decode("utf-8", "ignore"))

    def headers(self):
        h = {"Authorization": "Bearer " + self.token(), "Content-Type": "application/json"}
        if self.dev:
            h["developer-token"] = self.dev
        if self.login:
            h["login-customer-id"] = self.login
        return h

    # ------------------------------------------------------------ http
    def call(self, path, body=None, method="POST", customer=None):
        cid = customer or self.cid
        url = "https://googleads.googleapis.com/%s/customers/%s%s" % (self.ver, cid, path)
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, headers=self.headers(), method=method)
        self.calls.append((method, path))
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read().decode("utf-8")
                return json.loads(raw) if raw.strip() else {}
        except urllib.error.HTTPError as e:
            raise GadsError(e.code, e.read().decode("utf-8", "ignore"))

    def search(self, query, customer=None):
        chunks = self.call("/googleAds:searchStream", {"query": query}, customer=customer)
        rows = []
        for ch in chunks if isinstance(chunks, list) else []:
            rows.extend(ch.get("results", []))
        return rows

    def mutate(self, service, operations, validate_only=False, partial_failure=False):
        body = {"operations": operations, "validateOnly": bool(validate_only)}
        if partial_failure:
            body["partialFailure"] = True
        return self.call("/%s:mutate" % service, body)

    # ------------------------------------------------------------ helpers
    @staticmethod
    def micros(amount, unit=10_000):
        """金额转微单位，并按计费单位取整（多数币种 0.01 即 10000 微；报 VALUE_NOT_MULTIPLE_OF_BILLABLE_UNIT 就升到 100000、1000000 重试）。"""
        m = int(round(float(amount) * 1_000_000))
        return max(unit, (m // unit) * unit)

    @staticmethod
    def round_unit(micros, unit):
        return max(unit, (int(micros) // unit) * unit)

    @staticmethod
    def error_summary(err):
        """把 Google 的错误体压成一行：错误码 + 字段路径。"""
        try:
            d = json.loads(err.body)
            details = d.get("error", {}).get("details", [])
            out = []
            for det in details:
                for e in det.get("errors", []):
                    code = e.get("errorCode", {})
                    path = ".".join(p.get("fieldName", "") for p in e.get("location", {}).get("fieldPathElements", []))
                    out.append("%s@%s %s" % (json.dumps(code, ensure_ascii=False), path, (e.get("message") or "")[:120]))
            if out:
                return "; ".join(out)
            return (d.get("error", {}).get("message") or err.body)[:300]
        except Exception:  # noqa: BLE001
            return err.body[:300]

    def geo_constant(self, country_code):
        rows = self.search("SELECT geo_target_constant.resource_name FROM geo_target_constant WHERE geo_target_constant.country_code = '%s' AND geo_target_constant.target_type = 'Country' AND geo_target_constant.status = 'ENABLED'" % country_code.upper())
        if not rows:
            raise ValueError("no geo target constant for %s" % country_code)
        return rows[0]["geoTargetConstant"]["resourceName"]

    def language_constant(self, code):
        code = code.lower()
        rows = self.search("SELECT language_constant.resource_name, language_constant.code FROM language_constant WHERE language_constant.code = '%s'" % code)
        if not rows:
            raise ValueError("no language constant for %s" % code)
        return rows[0]["languageConstant"]["resourceName"]


def redact_id(s):
    s = str(s or "")
    return s[:3] + "***" + s[-2:] if len(s) > 6 else "***"
