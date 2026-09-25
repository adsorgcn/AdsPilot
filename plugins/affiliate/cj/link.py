#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CJ 插件 · link 动作（带 sub-id 的链接）

输入 CJ 后台或 Link Search 给的点击链接（click URL，形如 https://www.anrdoezrs.net/click-PID-LINKID 或带 ?url= 的深链）与主干发的 token，
输出把 sid=<token> 装进去的链接。已有 sid 就替换，其他参数不动。token 必须匹配 ^[A-Za-z0-9]{8,32}$。

用法：
  python3 link.py --base "https://www.anrdoezrs.net/click-1234567-12345?url=https%3A%2F%2Fbrand.example%2Fp" --token FIXTURETOKEN00000001
  python3 link.py --selftest
输出：{"url": ..., "sub_id_param": "sid", "token": ...}
"""
import json
import re
import sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

SUB_ID_PARAM = "sid"
TOKEN_RE = re.compile(r"^[A-Za-z0-9]{8,32}$")


def with_token(base, token):
    if not TOKEN_RE.match(token or ""):
        raise ValueError("bad token")
    parts = urlsplit(base)
    q = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k != SUB_ID_PARAM]
    q.append((SUB_ID_PARAM, token))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(q), parts.fragment))


def selftest():
    u = with_token("https://www.anrdoezrs.net/click-1234567-12345?url=https%3A%2F%2Fbrand.example%2Fp&sid=OLD", "FIXTURETOKEN00000001")
    ok = u.count("sid=") == 1 and "sid=FIXTURETOKEN00000001" in u and "url=https%3A%2F%2Fbrand.example%2Fp" in u
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
