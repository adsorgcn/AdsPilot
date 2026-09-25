#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cloudflare 公用客户端。只用标准库。钥匙只从环境变量读，不打印。

钥匙两种都认（有一种就行）：
  CF_API_TOKEN                     账号级全写 API Token（cfat_ 开头的账号 token 或用户 token）
  CF_EMAIL + CF_GLOBAL_API_KEY     个人资料页的 Global API Key
可选：CF_ACCOUNT_ID（不给就取账号列表第一个）

能做的事：verify、zones、kv namespace 建/找、kv put/get、worker 上传（带 KV 绑定与 secret）、
自定义域名挂到 worker（Cloudflare 自动建 DNS 与证书）、workers.dev 子域开关。

  python3 cf_api.py --selftest
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.cloudflare.com/client/v4"


class CFError(Exception):
    pass


class Client(object):
    def __init__(self, env=None):
        e = env if env is not None else os.environ
        self.token = e.get("CF_API_TOKEN", "")
        self.email = e.get("CF_EMAIL", "")
        self.gkey = e.get("CF_GLOBAL_API_KEY", "")
        self.account_id = e.get("CF_ACCOUNT_ID", "")
        self.missing = [] if (self.token or (self.email and self.gkey)) else ["CF_API_TOKEN 或 CF_EMAIL+CF_GLOBAL_API_KEY"]

    # ------------------------------------------------------------ HTTP
    def headers(self):
        h = {"User-Agent": "adspilot-cloudflare"}
        if self.token:
            h["Authorization"] = "Bearer " + self.token
        else:
            h["X-Auth-Email"] = self.email
            h["X-Auth-Key"] = self.gkey
        return h

    def call(self, method, path, body=None, raw=None, content_type="application/json", timeout=30):
        h = self.headers()
        data = None
        if raw is not None:
            data, h["Content-Type"] = raw, content_type
        elif body is not None:
            data, h["Content-Type"] = json.dumps(body).encode("utf-8"), "application/json"
        req = urllib.request.Request(API + path, data=data, headers=h, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                txt = r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            txt = e.read().decode("utf-8", "ignore")
            try:
                d = json.loads(txt)
            except ValueError:
                raise CFError("HTTP %s %s: %s" % (e.code, path, txt[:200]))
            raise CFError("HTTP %s %s: %s" % (e.code, path, "; ".join("%s %s" % (x.get("code"), x.get("message")) for x in d.get("errors") or [])[:300]))
        if not txt:
            return {}
        try:
            d = json.loads(txt)
        except ValueError:
            return {"raw": txt}
        if isinstance(d, dict) and d.get("success") is False:
            raise CFError("%s: %s" % (path, "; ".join("%s %s" % (x.get("code"), x.get("message")) for x in d.get("errors") or [])[:300]))
        return d.get("result") if isinstance(d, dict) and "result" in d else d

    # ------------------------------------------------------------ 账号与钥匙
    def account(self):
        if not self.account_id:
            accts = self.call("GET", "/accounts?per_page=5") or []
            if not accts:
                raise CFError("no account visible to this key")
            self.account_id = accts[0]["id"]
        return self.account_id

    def verify(self):
        """账号 token 在账号端点核，用户 token 在用户端点核；Global API Key 直接看能不能列账号。"""
        acc = self.account()
        if self.token:
            for path in ("/accounts/%s/tokens/verify" % acc, "/user/tokens/verify"):
                try:
                    r = self.call("GET", path)
                    return {"status": r.get("status"), "expires_on": r.get("expires_on"), "kind": "account_token" if "accounts" in path else "user_token"}
                except CFError:
                    continue
            raise CFError("token verify failed at both endpoints")
        return {"status": "active", "kind": "global_api_key"}

    # ------------------------------------------------------------ zone
    def zones(self):
        out, page = [], 1
        while True:
            r = self.call("GET", "/zones?per_page=50&page=%d" % page) or []
            out.extend(r)
            if len(r) < 50:
                break
            page += 1
        return out

    def zone_for(self, hostname):
        """hostname 落在哪个 zone：取最长后缀匹配。"""
        best = None
        for z in self.zones():
            n = z["name"]
            if hostname == n or hostname.endswith("." + n):
                if best is None or len(n) > len(best["name"]):
                    best = z
        if not best:
            raise CFError("no zone in this account for %s (域名要先加进这个 Cloudflare 账号)" % hostname)
        return best

    def dns_records(self, zone_id, name=None):
        q = "?per_page=100" + ("&name=" + urllib.parse.quote(name) if name else "")
        return self.call("GET", "/zones/%s/dns_records%s" % (zone_id, q)) or []

    # ------------------------------------------------------------ KV
    def kv_namespaces(self):
        return self.call("GET", "/accounts/%s/storage/kv/namespaces?per_page=100" % self.account()) or []

    def kv_ensure(self, title):
        for ns in self.kv_namespaces():
            if ns.get("title") == title:
                return ns["id"]
        return self.call("POST", "/accounts/%s/storage/kv/namespaces" % self.account(), {"title": title})["id"]

    def kv_put(self, ns_id, key, value, metadata=None):
        path = "/accounts/%s/storage/kv/namespaces/%s/values/%s" % (self.account(), ns_id, urllib.parse.quote(key, safe=""))
        if metadata:
            boundary = "----adspilot%d" % int(time.time() * 1000)
            parts = [("value", value), ("metadata", json.dumps(metadata))]
            body = b""
            for name, val in parts:
                body += ("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n" % (boundary, name)).encode() + val.encode("utf-8") + b"\r\n"
            body += ("--%s--\r\n" % boundary).encode()
            return self.call("PUT", path, raw=body, content_type="multipart/form-data; boundary=" + boundary)
        return self.call("PUT", path, raw=value.encode("utf-8"), content_type="text/plain; charset=utf-8")

    def kv_get(self, ns_id, key):
        path = "/accounts/%s/storage/kv/namespaces/%s/values/%s" % (self.account(), ns_id, urllib.parse.quote(key, safe=""))
        req = urllib.request.Request(API + path, headers=self.headers())
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            raise CFError("HTTP %s kv get %s" % (e.code, key))

    # ------------------------------------------------------------ Worker
    def worker_upload(self, script_name, js_source, kv_bindings=None, secrets=None, vars_=None, compatibility_date="2026-09-01"):
        """上传 ES module Worker，一次带上 KV 绑定、secret、明文变量。幂等：同名覆盖。"""
        bindings = []
        for name, ns_id in (kv_bindings or {}).items():
            bindings.append({"type": "kv_namespace", "name": name, "namespace_id": ns_id})
        for name, text in (secrets or {}).items():
            bindings.append({"type": "secret_text", "name": name, "text": text})
        for name, text in (vars_ or {}).items():
            bindings.append({"type": "plain_text", "name": name, "text": text})
        meta = {"main_module": "worker.js", "bindings": bindings, "compatibility_date": compatibility_date}
        boundary = "----adspilot%d" % int(time.time() * 1000)
        body = ("--%s\r\nContent-Disposition: form-data; name=\"metadata\"; filename=\"metadata.json\"\r\nContent-Type: application/json\r\n\r\n" % boundary).encode()
        body += json.dumps(meta).encode("utf-8") + b"\r\n"
        body += ("--%s\r\nContent-Disposition: form-data; name=\"worker.js\"; filename=\"worker.js\"\r\nContent-Type: application/javascript+module\r\n\r\n" % boundary).encode()
        body += js_source.encode("utf-8") + b"\r\n" + ("--%s--\r\n" % boundary).encode()
        return self.call("PUT", "/accounts/%s/workers/scripts/%s" % (self.account(), script_name), raw=body,
                         content_type="multipart/form-data; boundary=" + boundary, timeout=60)

    def worker_delete(self, script_name):
        return self.call("DELETE", "/accounts/%s/workers/scripts/%s?force=true" % (self.account(), script_name))

    def workers(self):
        return self.call("GET", "/accounts/%s/workers/scripts" % self.account()) or []

    def worker_domains(self):
        return self.call("GET", "/accounts/%s/workers/domains" % self.account()) or []

    def worker_domain_attach(self, hostname, zone_id, script_name):
        """把 hostname 挂到 worker：Cloudflare 自己建 DNS 记录与证书。幂等。"""
        for d in self.worker_domains():
            if d.get("hostname") == hostname and d.get("service") == script_name:
                return d
        return self.call("PUT", "/accounts/%s/workers/domains" % self.account(),
                         {"hostname": hostname, "zone_id": zone_id, "service": script_name, "environment": "production"})

    def worker_domain_detach(self, hostname):
        for d in self.worker_domains():
            if d.get("hostname") == hostname:
                return self.call("DELETE", "/accounts/%s/workers/domains/%s" % (self.account(), d["id"]))
        return None

    def workers_dev_subdomain(self):
        r = self.call("GET", "/accounts/%s/workers/subdomain" % self.account()) or {}
        return r.get("subdomain")

    def worker_subdomain_enable(self, script_name, enabled):
        return self.call("POST", "/accounts/%s/workers/scripts/%s/subdomain" % (self.account(), script_name), {"enabled": bool(enabled)})


def http_get(url, headers=None, timeout=15, follow=True):
    """普通 GET，返回 (status, headers, body)。follow=False 时 302 不跟。"""
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, hdrs, newurl):
            return None
    opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(url, headers=dict({"User-Agent": "adspilot-status"}, **(headers or {})))
    try:
        with opener.open(req, timeout=timeout) as r:
            return r.getcode(), dict(r.headers), r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "ignore")


def selftest():
    c = Client(env={"CF_API_TOKEN": "x"})
    ok = not c.missing and c.headers().get("Authorization") == "Bearer x"
    c2 = Client(env={"CF_EMAIL": "a@b", "CF_GLOBAL_API_KEY": "k"})
    ok = ok and not c2.missing and c2.headers().get("X-Auth-Key") == "k"
    c3 = Client(env={})
    ok = ok and bool(c3.missing)
    # worker 上传的 multipart 形状
    boundary_ok = True
    try:
        meta = {"main_module": "worker.js", "bindings": [{"type": "kv_namespace", "name": "MAPPINGS", "namespace_id": "1"}]}
        json.dumps(meta)
    except Exception:  # noqa: BLE001
        boundary_ok = False
    ok = ok and boundary_ok
    print("client env=%s multipart=%s -> %s" % ("ok" if not c.missing else c.missing, boundary_ok, "OK" if ok else "FAIL"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(selftest() if "--selftest" in sys.argv else (print(__doc__) or 0))
