#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cloudflare 插件 · setup 动作（交钥匙：一把全写钥匙进，一个自有域名上的落地位出）

做的事，全部幂等，跑第二遍不会多建东西：
  1 核钥匙、找 hostname 落在哪个 zone（域名必须已在这个 Cloudflare 账号里）
  2 建 KV 命名空间 adspilot-<host>
  3 上传 worker.js，绑 MAPPINGS，放 secret EXPORT_KEY（第一次随机生成，之后沿用 data/deploy.json 里的）
  4 把 hostname 挂到 worker（Cloudflare 自动建 DNS 记录与证书）
  5 等 /health 通
  6 写 data/deploy.json：{host, base_url, zone, script, kv_namespace_id, export_key, export_url}，主干从这里读中转在哪、钥匙是什么

用法：
  python3 setup.py --host x.example.com            # dry-run：只核钥匙与 zone，列出将要建的东西
  python3 setup.py --host x.example.com --apply    # 真建
  python3 setup.py --host x.example.com --teardown --apply   # 拆：摘域名、删 worker、删 KV（测试收尾用）
  python3 setup.py --selftest
退出码：0 成功；3 API 失败；4 钥匙缺失或域名不在账号里。
"""
import json
import os
import secrets
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
import cf_api as CF  # noqa: E402

DEPLOY_JSON = os.path.join(ROOT, "data", "deploy.json")


def load_deploy():
    if os.path.exists(DEPLOY_JSON):
        try:
            return json.load(open(DEPLOY_JSON, encoding="utf-8"))
        except ValueError:
            return {}
    return {}


def save_deploy(d):
    os.makedirs(os.path.dirname(DEPLOY_JSON), exist_ok=True)
    json.dump(d, open(DEPLOY_JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    try:
        os.chmod(DEPLOY_JSON, 0o600)
    except OSError:
        pass


def script_name_for(host):
    return "adspilot-" + "".join(ch if ch.isalnum() else "-" for ch in host.lower()).strip("-")[:50]


def plan(client, host):
    zone = client.zone_for(host)
    return {"host": host, "zone": zone["name"], "zone_id": zone["id"], "script": script_name_for(host), "kv_title": "adspilot-" + host,
            "base_url": "https://" + host, "export_url": "https://%s/export" % host}


def wait_health(base_url, tries=30, sleep=4):
    for _ in range(tries):
        try:
            code, _, body = CF.http_get(base_url + "/health", timeout=10)
            if code == 200 and '"ok":true' in body.replace(" ", ""):
                return json.loads(body)
        except Exception:  # noqa: BLE001
            pass
        time.sleep(sleep)
    return None


def setup(client, host, apply):
    p = plan(client, host)
    out = {"mode": "apply" if apply else "dry", "plan": p, "steps": []}
    if not apply:
        out["steps"].append("dry-run: 未建任何东西；--apply 才建")
        return out, 0
    prev = load_deploy()
    export_key = prev.get("export_key") if prev.get("host") == host and prev.get("export_key") else secrets.token_urlsafe(32)
    ns_id = client.kv_ensure(p["kv_title"]); out["steps"].append("kv %s" % ns_id)
    js = open(os.path.join(HERE, "worker.js"), encoding="utf-8").read()
    client.worker_upload(p["script"], js, kv_bindings={"MAPPINGS": ns_id}, secrets={"EXPORT_KEY": export_key}); out["steps"].append("worker %s uploaded" % p["script"])
    client.worker_domain_attach(host, p["zone_id"], p["script"]); out["steps"].append("domain %s attached" % host)
    health = wait_health(p["base_url"])
    out["health"] = health
    d = {"plugin": "cloudflare", "host": host, "base_url": p["base_url"], "zone": p["zone"], "zone_id": p["zone_id"], "script": p["script"],
         "kv_namespace_id": ns_id, "export_key": export_key, "export_url": p["export_url"], "setup_at": time.strftime("%Y-%m-%dT%H:%M:%S")}
    save_deploy(d)
    out["deploy_json"] = os.path.relpath(DEPLOY_JSON, ROOT)
    out["applied"] = bool(health)
    if not health:
        out["error"] = "worker 上传了但 /health 两分钟内没通（证书可能还在签发，稍后再跑一次 setup 即可）"
        return out, 3
    return out, 0


def teardown(client, host, apply):
    p = plan(client, host)
    out = {"mode": "apply" if apply else "dry", "plan": p, "steps": []}
    if not apply:
        out["steps"].append("dry-run: 将摘域名、删 worker、删 KV")
        return out, 0
    client.worker_domain_detach(host); out["steps"].append("domain detached")
    try:
        client.worker_delete(p["script"]); out["steps"].append("worker deleted")
    except CF.CFError as e:
        out["steps"].append("worker delete: %s" % str(e)[:120])
    for ns in client.kv_namespaces():
        if ns.get("title") == p["kv_title"]:
            client.call("DELETE", "/accounts/%s/storage/kv/namespaces/%s" % (client.account(), ns["id"])); out["steps"].append("kv deleted")
    if load_deploy().get("host") == host:
        os.remove(DEPLOY_JSON); out["steps"].append("data/deploy.json removed")
    return out, 0


def selftest():
    ok = script_name_for("Go.Example.com") == "adspilot-go-example-com"
    d = {"host": "x.example.com", "export_key": "k"}
    ok = ok and d["export_key"] == "k"
    print("script_name=%s -> %s" % (script_name_for("Go.Example.com"), "OK" if ok else "FAIL"))
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1) if argv[i].startswith("--") and not argv[i + 1].startswith("--")}
    host = (kv.get("host") or load_deploy().get("host") or "").lower().strip()
    if not host:
        print(json.dumps({"error": "--host 必填（或 data/deploy.json 里已有）"})); return 4
    client = CF.Client()
    if client.missing:
        print(json.dumps({"error": "missing env: %s" % ", ".join(client.missing)})); return 4
    apply = "--apply" in argv
    try:
        v = client.verify()
        fn = teardown if "--teardown" in argv else setup
        out, rc = fn(client, host, apply)
        out["key"] = v
    except CF.CFError as e:
        print(json.dumps({"error": str(e)[:400]})); return 4 if "no zone" in str(e) else 3
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
