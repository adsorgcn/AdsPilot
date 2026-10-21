#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Impact 插件 · link 动作（带 sub-id 的链接）

输入 Impact 的追踪链接（Campaigns 给的 TrackingLink，形如 https://brand.sjv.io/c/{partnerId}/{adId}/{programId}，或 vanity 链接）与主干发的 token，
输出把 subId1=<token> 装进去的链接。官方写法就是在追踪链接后追加 ?subId1=…，所有追踪链接都认，vanity 链接也认；已有 subId1（不分大小写）就替换，其他参数不动。
token 必须匹配 ^[A-Za-z0-9]{8,32}$（Impact 上限 255 位字母数字，主干的 token 是 20 位）。

用法：
  python3 link.py --base "https://brand-x.sjv.io/c/1234567/654321/4321" --token FIXTURETOKEN00000001
  python3 link.py --selftest
输出：{"url": ..., "sub_id_param": "subId1", "token": ...}
"""
import json
import re
import sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

SUB_ID_PARAM = "subId1"
TOKEN_RE = re.compile(r"^[A-Za-z0-9]{8,32}$")


def with_token(base, token):
    if not TOKEN_RE.match(token or ""):
        raise ValueError("bad token")
    parts = urlsplit(base)
    q = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k.lower() != SUB_ID_PARAM.lower()]
    q.append((SUB_ID_PARAM, token))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(q), parts.fragment))


def selftest():
    u = with_token("https://brand-x.sjv.io/c/1234567/654321/4321?SubId1=OLD&sharedId=keep", "FIXTURETOKEN00000001")
    ok = u.lower().count("subid1=") == 1 and "subId1=FIXTURETOKEN00000001" in u and "sharedId=keep" in u and u.startswith("https://brand-x.sjv.io/c/1234567/654321/4321?")
    v = with_token("https://brand-y.pxf.io/vanity-path", "FIXTURETOKEN00000002")
    ok = ok and v == "https://brand-y.pxf.io/vanity-path?subId1=FIXTURETOKEN00000002"
    try:
        with_token("https://x/y", "bad token!"); ok = False
    except ValueError:
        pass
    print(u, "OK" if ok else "FAIL")
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    kv = {argv[i][2:]: argv[i + 1] for i in range(0, len(argv) - 1) if argv[i].startswith("--")}
    if "base" not in kv or "token" not in kv:
        print(__doc__); return 1
    try:
        print(json.dumps({"url": with_token(kv["base"], kv["token"]), "sub_id_param": SUB_ID_PARAM, "token": kv["token"]}))
    except ValueError as e:
        print(str(e)); return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
