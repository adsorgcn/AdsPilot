#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Ads OAuth 2.0 授权助手（桌面应用回环 + PKCE，双 scope 一次拿到）

解决冷启动与 scope 升级痛点：
  1. 同时申请 `https://www.googleapis.com/auth/adwords` 与 `https://www.googleapis.com/auth/datamanager`
     两个 scope，避免后续转化上传时遇到 `ACCESS_TOKEN_SCOPE_INSUFFICIENT`。
  2. 通过本机回环 `http://127.0.0.1:<port>` + PKCE (S256) 收回调；服务器或无浏览器环境可加 `--no-browser`
     或 `--manual`（粘贴完整回调地址或 code）。
  3. 凭据只在内存中换取并在显式 `--out-env`（须仓库外或 `.env` 文件，0600 权限）中保存，绝不写入仓库跟踪文件或 stdout 日志。

用法：
  python3 oauth_helper.py                              # dry-run：打印所需环境变量与授权 URL 模板
  python3 oauth_helper.py --apply [--no-browser] [--out-env ~/.config/adspilot/ads.env]
  python3 oauth_helper.py --check [--apply]            # 核对已有 GOOGLE_ADS_REFRESH_TOKEN 是否含双 scope
  python3 oauth_helper.py --selftest

退出码：0 成功；2 需要本人重授权（缺 scope）；3 网络或 OAuth 接口失败；4 凭据缺失或非法参数。
"""
import argparse
import base64
import hashlib
import http.server
import json
import os
import secrets
import sys
import tempfile
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SCOPES = (
    "https://www.googleapis.com/auth/adwords",
    "https://www.googleapis.com/auth/datamanager",
)
AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
TOKENINFO_ENDPOINT = "https://oauth2.googleapis.com/tokeninfo"


def _console_safe():
    for s in (sys.stdout, sys.stderr):
        try:
            if (getattr(s, "encoding", "") or "").lower().replace("-", "") != "utf8":
                s.reconfigure(errors="replace")
        except Exception:  # noqa: BLE001
            pass


def make_pkce():
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode("ascii")
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


def build_auth_url(client_id, redirect_uri, state, code_challenge):
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return AUTH_ENDPOINT + "?" + urllib.parse.urlencode(params)


def parse_callback_input(raw, expected_state):
    text = (raw or "").strip()
    if not text:
        raise ValueError("empty callback input")
    if "://" in text or text.startswith("?"):
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(text).query)
        if qs.get("error"):
            raise ValueError("oauth error: %s" % qs["error"][0])
        if expected_state and (qs.get("state") or [""])[0] != expected_state:
            raise ValueError("oauth state mismatch")
        code = (qs.get("code") or [""])[0]
        if not code:
            raise ValueError("missing authorization code in callback url")
        return code
    return text


def post_form(url, payload, timeout=20):
    data = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "adspilot-oauth/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def exchange_code(client_id, client_secret, code, redirect_uri, code_verifier, token_url=TOKEN_ENDPOINT):
    return post_form(
        token_url,
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
            "code_verifier": code_verifier,
        },
    )


def inspect_refresh_scopes(env, token_url=TOKEN_ENDPOINT, tokeninfo_url=TOKENINFO_ENDPOINT):
    missing = [k for k in ("GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN") if not env.get(k)]
    if missing:
        return {"ok": False, "missing": missing}, 4
    tok_resp = post_form(
        token_url,
        {
            "client_id": env["GOOGLE_ADS_CLIENT_ID"],
            "client_secret": env["GOOGLE_ADS_CLIENT_SECRET"],
            "refresh_token": env["GOOGLE_ADS_REFRESH_TOKEN"],
            "grant_type": "refresh_token",
        },
    )
    access_token = tok_resp.get("access_token") or ""
    if not access_token:
        return {"ok": False, "error": "no access_token returned"}, 3
    info = post_form(tokeninfo_url, {"access_token": access_token})
    granted = set((info.get("scope") or tok_resp.get("scope") or "").split())
    missing_scopes = [s for s in SCOPES if s not in granted]
    ok = len(missing_scopes) == 0
    return {
        "ok": ok,
        "has_adwords_scope": SCOPES[0] in granted,
        "has_datamanager_scope": SCOPES[1] in granted,
        "missing_scopes": missing_scopes,
        "scope_count": len(granted),
    }, (0 if ok else 2)


def write_env_token(out_path, refresh_token):
    dest = Path(out_path).expanduser().resolve()
    root_res = ROOT.resolve()
    try:
        rel = dest.relative_to(root_res)
        if not rel.name.startswith(".env"):
            raise ValueError("refusing to write token inside repo except gitignored .env*")
    except ValueError as exc:
        if "refusing to write" in str(exc):
            raise
    dest.parent.mkdir(parents=True, exist_ok=True)
    lines = []
    if dest.exists():
        for line in dest.read_text(encoding="utf-8").splitlines():
            if not line.startswith("GOOGLE_ADS_REFRESH_TOKEN="):
                lines.append(line)
    lines.append("GOOGLE_ADS_REFRESH_TOKEN=%s" % refresh_token)
    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    try:
        os.chmod(dest, 0o600)
    except OSError:
        pass
    return str(dest)


def run_loopback_flow(client_id, client_secret, port=0, no_browser=False, manual=False, timeout_s=300, token_url=TOKEN_ENDPOINT):
    verifier, challenge = make_pkce()
    state = secrets.token_urlsafe(24)

    if manual:
        redirect_uri = "http://127.0.0.1:%d" % (port or 8085)
        url = build_auth_url(client_id, redirect_uri, state, challenge)
        print("请在浏览器打开下面链接完成授权（包含 adwords 与 datamanager 双 scope）：", file=sys.stderr)
        print(url, file=sys.stderr)
        if not no_browser:
            webbrowser.open(url)
        raw = input("粘贴完整回调地址或 authorization code: ")
        code = parse_callback_input(raw, state)
    else:
        captured = {"code": "", "error": ""}
        done = threading.Event()

        class CallbackHandler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_GET(self):
                qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
                if qs.get("error"):
                    captured["error"] = qs["error"][0]
                    msg = b"AdsPilot OAuth failed. You may close this window."
                    code_http = 400
                elif (qs.get("state") or [""])[0] != state:
                    captured["error"] = "state_mismatch"
                    msg = b"AdsPilot OAuth state mismatch."
                    code_http = 400
                elif not (qs.get("code") or [""])[0]:
                    captured["error"] = "missing_code"
                    msg = b"AdsPilot OAuth missing authorization code."
                    code_http = 400
                else:
                    captured["code"] = qs["code"][0]
                    msg = b"AdsPilot OAuth succeeded. Return to your terminal or DSH."
                    code_http = 200
                self.send_response(code_http)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(msg)))
                self.end_headers()
                self.wfile.write(msg)
                done.set()

        srv = http.server.HTTPServer(("127.0.0.1", port), CallbackHandler)
        redirect_uri = "http://127.0.0.1:%d" % srv.server_address[1]
        url = build_auth_url(client_id, redirect_uri, state, challenge)
        th = threading.Thread(target=srv.serve_forever, daemon=True)
        th.start()
        try:
            print("请在浏览器打开下面链接完成授权（等待本机回环回调）：", file=sys.stderr)
            print(url, file=sys.stderr)
            if not no_browser:
                webbrowser.open(url)
            if not done.wait(timeout_s):
                raise TimeoutError("timed out waiting for OAuth browser callback")
        finally:
            srv.shutdown()
            srv.server_close()
        if captured["error"]:
            raise ValueError("oauth callback failed: %s" % captured["error"])
        code = captured["code"]

    tok_resp = exchange_code(client_id, client_secret, code, redirect_uri, verifier, token_url=token_url)
    refresh_token = tok_resp.get("refresh_token") or ""
    if not refresh_token:
        raise ValueError("token response omitted refresh_token (ensure prompt=consent & desktop OAuth client)")
    granted = set((tok_resp.get("scope") or "").split())
    return {
        "refresh_token": refresh_token,
        "scopes": sorted(granted),
        "has_required_scopes": all(s in granted for s in SCOPES) if granted else None,
        "redirect_uri": redirect_uri,
    }


def selftest():
    _console_safe()
    # 1. PKCE & URL builder check
    verifier, challenge = make_pkce()
    expected = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode("ascii")
    assert challenge == expected
    u = build_auth_url("cid-demo", "http://127.0.0.1:9999", "st-1", challenge)
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)
    scopes = set((qs.get("scope") or [""])[0].split())
    assert set(SCOPES).issubset(scopes) and qs.get("access_type") == ["offline"] and qs.get("prompt") == ["consent"]

    # 2. Missing env -> rc 4
    _, rc4 = inspect_refresh_scopes({})
    assert rc4 == 4

    # 3. Mock OAuth token + tokeninfo exchange (with interface_offline fallback)
    env_keys = ("NO_PROXY", "no_proxy")
    old = {k: os.environ.get(k) for k in env_keys}
    os.environ["NO_PROXY"] = "127.0.0.1,localhost"
    os.environ["no_proxy"] = "127.0.0.1,localhost"

    def _reply(path, form):
        if path.endswith("/token"):
            if form.get("grant_type") == ["authorization_code"]:
                return 200, {"access_token": "at-mock", "refresh_token": "rt-mock", "scope": " ".join(SCOPES)}
            return 200, {"access_token": "at-mock", "scope": " ".join(SCOPES)}
        if path.endswith("/tokeninfo"):
            return 200, {"scope": " ".join(SCOPES)}
        return 404, {}

    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_POST(self):
            raw_in = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode("utf-8")
            form = urllib.parse.parse_qs(raw_in)
            code_http, out = _reply(self.path, form)
            raw = json.dumps(out).encode("utf-8")
            self.send_response(code_http)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

    orig_urlopen = urllib.request.urlopen
    srv = None
    try:
        try:
            srv = http.server.HTTPServer(("127.0.0.1", 0), H)
            threading.Thread(target=srv.serve_forever, daemon=True).start()
            base = "http://127.0.0.1:%d" % srv.server_address[1]
        except PermissionError:
            base = "http://127.0.0.1:0"
            def _fake_urlopen(r, timeout=20):
                p = urllib.parse.urlparse(r.full_url).path
                form = urllib.parse.parse_qs((r.data or b"").decode("utf-8"))
                _, out = _reply(p, form)
                raw = json.dumps(out).encode("utf-8")
                class _Resp:
                    def __enter__(self): return self
                    def __exit__(self, *a): pass
                    def read(self): return raw
                return _Resp()
            urllib.request.urlopen = _fake_urlopen

        tok_out = exchange_code("cid", "csec", "code-1", "http://127.0.0.1:1234", verifier, token_url=base + "/token")
        assert tok_out.get("refresh_token") == "rt-mock"
        res_ok, rc0 = inspect_refresh_scopes(
            {"GOOGLE_ADS_CLIENT_ID": "cid", "GOOGLE_ADS_CLIENT_SECRET": "csec", "GOOGLE_ADS_REFRESH_TOKEN": "rt-mock"},
            token_url=base + "/token",
            tokeninfo_url=base + "/tokeninfo",
        )
        assert rc0 == 0 and res_ok["has_adwords_scope"] and res_ok["has_datamanager_scope"]
    finally:
        urllib.request.urlopen = orig_urlopen
        if srv is not None:
            srv.shutdown()
            srv.server_close()
        for k, v in old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    # 4. Callback parser + refusal to write token into tracked repo path
    assert parse_callback_input("http://127.0.0.1:8085/?code=abc123&state=s1", "s1") == "abc123"
    refused = False
    try:
        write_env_token(str(ROOT / "config" / "leak.env"), "rt-mock")
    except ValueError:
        refused = True
    assert refused
    with tempfile.TemporaryDirectory(prefix="adspilot-oauth-") as td:
        p = write_env_token(os.path.join(td, "ads.env"), "rt-mock")
        assert Path(p).is_file() and "GOOGLE_ADS_REFRESH_TOKEN=rt-mock" in Path(p).read_text(encoding="utf-8")

    print("google-ads oauth_helper selftest: pkce=ok scopes=adwords+datamanager check=0 repo_write_refused=True -> OK")
    return 0


def main(argv=None):
    _console_safe()
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--apply", action="store_true", help="真正启动回环授权或联网核验 refresh_token")
    p.add_argument("--check", action="store_true", help="核对已有 GOOGLE_ADS_REFRESH_TOKEN 是否含双 scope")
    p.add_argument("--port", type=int, default=0, help="回环监听端口（默认自动选空闲端口）")
    p.add_argument("--no-browser", action="store_true", help="只打印授权链接，不自动打开浏览器")
    p.add_argument("--manual", action="store_true", help="手工粘贴回调 URL 或 authorization code（SSH/容器环境）")
    p.add_argument("--out-env", help="将 GOOGLE_ADS_REFRESH_TOKEN 写入仓库外的 0600 env 文件")
    p.add_argument("--selftest", action="store_true")
    args = p.parse_args(argv)

    if args.selftest:
        return selftest()

    if args.check:
        if not args.apply:
            has = {k: bool(os.environ.get(k)) for k in ("GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN")}
            print(json.dumps({
                "mode": "dry",
                "action": "check_scopes",
                "required_scopes": list(SCOPES),
                "env_present": has,
                "next": "带 --apply 可联网刷新并核对 adwords + datamanager 双 scope",
            }, ensure_ascii=False, indent=2))
            return 0 if all(has.values()) else 4
        try:
            res, rc = inspect_refresh_scopes(os.environ)
        except Exception as exc:  # noqa: BLE001
            print(json.dumps({"ok": False, "error": str(exc)[:200]}, ensure_ascii=False))
            return 3
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return rc

    cid = os.environ.get("GOOGLE_ADS_CLIENT_ID", "")
    csec = os.environ.get("GOOGLE_ADS_CLIENT_SECRET", "")
    if not args.apply:
        print(json.dumps({
            "mode": "dry",
            "scopes": list(SCOPES),
            "env_present": {"GOOGLE_ADS_CLIENT_ID": bool(cid), "GOOGLE_ADS_CLIENT_SECRET": bool(csec)},
            "authorize_url_example": build_auth_url(cid or "<GOOGLE_ADS_CLIENT_ID>", "http://127.0.0.1:<port>", "<state>", "<s256_challenge>"),
            "next": "设置 GOOGLE_ADS_CLIENT_ID 与 GOOGLE_ADS_CLIENT_SECRET 后加 --apply 运行",
        }, ensure_ascii=False, indent=2))
        return 0

    if not cid or not csec:
        print(json.dumps({"ok": False, "error": "missing env: GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET"}, ensure_ascii=False))
        return 4

    try:
        res = run_loopback_flow(cid, csec, port=args.port, no_browser=args.no_browser, manual=args.manual)
        saved = write_env_token(args.out_env, res["refresh_token"]) if args.out_env else None
    except ValueError as exc:
        print(json.dumps({"ok": False, "error": str(exc)[:200]}, ensure_ascii=False))
        return 4 if "refusing" in str(exc) else 3
    except (OSError, urllib.error.URLError, TimeoutError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)[:200]}, ensure_ascii=False))
        return 3

    summary = {
        "ok": True,
        "token_obtained": True,
        "scopes": res["scopes"],
        "has_required_scopes": res["has_required_scopes"],
        "saved_env": saved,
    }
    if not saved:
        print("提示：已拿到新 GOOGLE_ADS_REFRESH_TOKEN（未落盘；下次建议传 --out-env <仓库外路径> 直接写入 DSH vault/env 文件）。", file=sys.stderr)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
