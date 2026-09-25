#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
iLang runtime 的拉取与校验（主干，Agent 适配部件）

仓库里钉着一份 iLang runtime（reference/ilang/ilang-latest.md 加 sha256 加 manifest.json）。
执行 Agent 读这份，不读网上的；要更新就跑本脚本，校验通过才落盘。

用法：
  python3 core/agent/ilang_runtime.py verify           # 校验本地副本
  python3 core/agent/ilang_runtime.py update           # 看看上游有没有新版本（dry-run）
  python3 core/agent/ilang_runtime.py update --apply   # 拉取并校验通过后覆盖本地副本

来源：https://github.com/ilang-ai/ilang-spec（MIT）。只用标准库。
"""
import hashlib
import json
import os
import sys
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DIR = os.path.join(ROOT, "reference", "ilang")
MANIFEST_URL = "https://raw.githubusercontent.com/ilang-ai/ilang-spec/main/runtime/manifest.json"


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "adspilot-ilang-runtime"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def verify():
    p = os.path.join(DIR, "ilang-latest.md")
    s = os.path.join(DIR, "ilang-latest.sha256")
    if not (os.path.exists(p) and os.path.exists(s)):
        print("missing runtime files under reference/ilang/")
        return 1
    want = open(s, encoding="utf-8").read().split()[0]
    got = sha256(open(p, "rb").read())
    ok = want == got
    print("local runtime sha256 %s %s" % (got[:16], "OK" if ok else "MISMATCH (want %s)" % want[:16]))
    return 0 if ok else 1


def update(apply):
    local_manifest = os.path.join(DIR, "manifest.json")
    local_ver = None
    if os.path.exists(local_manifest):
        local_ver = json.load(open(local_manifest, encoding="utf-8")).get("version")
    m = json.loads(fetch(MANIFEST_URL).decode("utf-8"))
    core = m["bundles"]["core"]
    print("local  version: %s" % local_ver)
    print("remote version: %s (commit %s)" % (m.get("version"), m.get("commit", "")[:12]))
    if local_ver == m.get("version"):
        print("already up to date")
        return 0
    if not apply:
        print("dry-run: 加 --apply 才会拉取并覆盖")
        return 0
    body = fetch(core["url"])
    got = sha256(body)
    if got != core["sha256"]:
        print("sha256 mismatch: manifest %s, downloaded %s; 不落盘" % (core["sha256"][:16], got[:16]))
        return 1
    os.makedirs(DIR, exist_ok=True)
    open(os.path.join(DIR, "ilang-latest.md"), "wb").write(body)
    open(os.path.join(DIR, "ilang-latest.sha256"), "w", encoding="utf-8").write("%s  ilang-latest.md\n" % got)
    open(local_manifest, "w", encoding="utf-8").write(json.dumps(m, ensure_ascii=False, indent=2) + "\n")
    print("updated to %s" % m.get("version"))
    return 0


def main(argv):
    if not argv or argv[0] not in ("verify", "update"):
        print(__doc__)
        return 1
    if argv[0] == "verify":
        return verify()
    return update("--apply" in argv)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
