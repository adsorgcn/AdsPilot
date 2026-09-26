#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sub-id token 与映射表（主干，归因与对账部件）

一个 token 进联盟的 sub-id，其余全进本地映射表。token 32 位内纯字母数字，哪家联盟都装得下。
映射表 token -> gclid, campaign, adgroup, keyword, page, ts, network, offer。账本在 SQLite，路径 <data_dir>/ledger.db。

用法：
  python3 core/ledger/subid.py mint [--n 1]                          # 只出 token，不落库
  python3 core/ledger/subid.py record --gclid G --campaign C [--adgroup A --keyword K --page P --network cj --offer O --ts ISO]
  python3 core/ledger/subid.py import <mappings.jsonl>               # 从中转（Cloudflare Worker /export）拉回的 JSONL 入库，幂等
  python3 core/ledger/subid.py pull --url URL --key-env ENV          # 直接从中转的 export 接口拉回并入库
  python3 core/ledger/subid.py lookup <token>
  python3 core/ledger/subid.py stats
  python3 core/ledger/subid.py export --since 2026-09-01 [--out file.jsonl]
  通用：--db <path> 指定账本；默认读 config/adspilot.json 的 data_dir。

只用标准库。日志里不打印 gclid 原文。
"""
import json
import os
import secrets
import sqlite3
import sys
import time
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # 32 个符号，去掉易混的 0 O 1 I
TOKEN_LEN = 20

SCHEMA = """
CREATE TABLE IF NOT EXISTS mappings (
  token TEXT PRIMARY KEY, gclid TEXT, campaign TEXT, adgroup TEXT, keyword TEXT, page TEXT,
  ts TEXT, network TEXT, offer TEXT, source TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mappings_ts ON mappings(ts);
CREATE TABLE IF NOT EXISTS conversions (
  event_id TEXT PRIMARY KEY, token TEXT, gclid TEXT, event_time TEXT, click_time TEXT, amount REAL, currency TEXT,
  status TEXT, network TEXT, offer TEXT, batch TEXT, uploaded_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chargebacks (
  event_id TEXT PRIMARY KEY, original_event_id TEXT, token TEXT, gclid TEXT, event_time TEXT, amount REAL, currency TEXT,
  network TEXT, applied_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY, started_at TEXT, finished_at TEXT, exit_code INTEGER, summary TEXT
);
CREATE TABLE IF NOT EXISTS actions (
  action_id TEXT PRIMARY KEY, run_id TEXT, node TEXT, target TEXT, choice TEXT, mode TEXT, provider TEXT,
  applied INTEGER NOT NULL DEFAULT 0, applied_at TEXT, note TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_actions_target ON actions(target, applied_at);
CREATE TABLE IF NOT EXISTS user_decision_anchor (
  key TEXT PRIMARY KEY, first_seen TEXT, spend_at REAL
);
"""


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def mint():
    return "".join(secrets.choice(ALPHABET) for _ in range(TOKEN_LEN))


def valid_token(t):
    return isinstance(t, str) and 8 <= len(t) <= 32 and t.isalnum() and t.isascii()


def mask(g):
    if not g:
        return ""
    return g[:4] + "…" + g[-3:] if len(g) > 10 else "…"


def default_db():
    cp = os.path.join(ROOT, "config", "adspilot.json")
    data_dir = "data"
    if os.path.exists(cp):
        try:
            data_dir = json.load(open(cp, encoding="utf-8")).get("data_dir", "data")
        except Exception:  # noqa: BLE001
            pass
    p = data_dir if os.path.isabs(data_dir) else os.path.join(ROOT, data_dir)
    os.makedirs(p, exist_ok=True)
    return os.path.join(p, "ledger.db")


def open_db(path=None):
    path = path or default_db()
    if path != ":memory:":
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    con = sqlite3.connect(path)
    con.executescript(SCHEMA)
    return con


def record(con, row, source="local"):
    tok = row.get("token") or mint()
    if not valid_token(tok):
        raise ValueError("bad token")
    con.execute("INSERT OR IGNORE INTO mappings(token,gclid,campaign,adgroup,keyword,page,ts,network,offer,source,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                (tok, row.get("gclid"), row.get("campaign"), row.get("adgroup"), row.get("keyword"), row.get("page"),
                 row.get("ts") or now_iso(), row.get("network"), row.get("offer"), source, now_iso()))
    return tok


def import_jsonl(con, fp, source="worker"):
    n_new, n_dup, n_bad = 0, 0, 0
    for line in fp:
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
            before = con.total_changes
            record(con, row, source)
            if con.total_changes > before:
                n_new += 1
            else:
                n_dup += 1
        except Exception:  # noqa: BLE001
            n_bad += 1
    con.commit()
    return n_new, n_dup, n_bad


def deploy_info():
    """落地位在哪、钥匙是什么：plugins/deploy/*/setup.py 写的 data/deploy.json。没有就空。"""
    p = os.path.join(ROOT, "data", "deploy.json")
    if os.path.exists(p):
        try:
            return json.load(open(p, encoding="utf-8"))
        except ValueError:
            return {}
    return {}


def pull(con, url, key_env, since=None):
    dep = deploy_info()
    url = url or dep.get("export_url", "")
    key = os.environ.get(key_env or "", "") or dep.get("export_key", "")
    if not url:
        print("no export_url (config.deploy.export_url 或 data/deploy.json)"); return 4
    if not key:
        print("export key env %s not set" % key_env); return 4
    q = url + ("&" if "?" in url else "?") + "since=" + (since or "1970-01-01T00:00:00Z")
    req = urllib.request.Request(q, headers={"Authorization": "Bearer " + key, "User-Agent": "adspilot-subid"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read().decode("utf-8")
    except Exception as e:  # noqa: BLE001
        print("pull failed: %s" % e); return 3
    n = import_jsonl(con, body.splitlines(), source="worker")
    print("pulled: new=%d dup=%d bad=%d" % n)
    return 0


def lookup(con, token):
    cur = con.execute("SELECT token,gclid,campaign,adgroup,keyword,page,ts,network,offer,source FROM mappings WHERE token=?", (token,))
    r = cur.fetchone()
    if not r:
        return None
    keys = ["token", "gclid", "campaign", "adgroup", "keyword", "page", "ts", "network", "offer", "source"]
    return dict(zip(keys, r))


def stats(con):
    out = {}
    for t in ("mappings", "conversions", "chargebacks", "runs"):
        out[t] = con.execute("SELECT COUNT(*) FROM %s" % t).fetchone()[0]
    out["mappings_with_gclid"] = con.execute("SELECT COUNT(*) FROM mappings WHERE gclid IS NOT NULL AND gclid<>''").fetchone()[0]
    out["conversions_uploaded"] = con.execute("SELECT COUNT(*) FROM conversions WHERE uploaded_at IS NOT NULL").fetchone()[0]
    out["last_mapping_ts"] = con.execute("SELECT MAX(ts) FROM mappings").fetchone()[0]
    return out


def export(con, since, out=None):
    cur = con.execute("SELECT token,gclid,campaign,adgroup,keyword,page,ts,network,offer FROM mappings WHERE ts>=? ORDER BY ts", (since,))
    keys = ["token", "gclid", "campaign", "adgroup", "keyword", "page", "ts", "network", "offer"]
    fp = open(out, "w", encoding="utf-8") if out else sys.stdout
    n = 0
    for r in cur:
        fp.write(json.dumps(dict(zip(keys, r)), ensure_ascii=False) + "\n"); n += 1
    if out:
        fp.close()
    return n


def parse_kv(argv):
    kv, rest, i = {}, [], 0
    while i < len(argv):
        if argv[i].startswith("--") and i + 1 < len(argv) and not argv[i + 1].startswith("--"):
            kv[argv[i][2:]] = argv[i + 1]; i += 2
        elif argv[i].startswith("--"):
            kv[argv[i][2:]] = True; i += 1
        else:
            rest.append(argv[i]); i += 1
    return kv, rest


def main(argv):
    kv, rest = parse_kv(argv)
    if not rest:
        print(__doc__); return 1
    cmd, rest = rest[0], rest[1:]
    if cmd == "mint":
        for _ in range(int(kv.get("n", 1))):
            print(mint())
        return 0
    con = open_db(kv.get("db"))
    if cmd == "record":
        row = {k: kv.get(k) for k in ("token", "gclid", "campaign", "adgroup", "keyword", "page", "ts", "network", "offer")}
        tok = record(con, row, source="local"); con.commit()
        print(json.dumps({"token": tok, "gclid": mask(row.get("gclid"))}))
        return 0
    if cmd == "import":
        if not rest:
            print("need a .jsonl path"); return 1
        with open(rest[0], encoding="utf-8") as fp:
            n = import_jsonl(con, fp)
        print("imported: new=%d dup=%d bad=%d" % n); return 0
    if cmd == "pull":
        return pull(con, kv.get("url", ""), kv.get("key-env", "ADSPILOT_EXPORT_KEY"), kv.get("since"))
    if cmd == "lookup":
        r = lookup(con, rest[0]) if rest else None
        if not r:
            print("not found"); return 1
        r["gclid"] = mask(r.get("gclid"))
        print(json.dumps(r, ensure_ascii=False)); return 0
    if cmd == "stats":
        print(json.dumps(stats(con), ensure_ascii=False, indent=2)); return 0
    if cmd == "export":
        n = export(con, kv.get("since", "1970-01-01"), kv.get("out"))
        if kv.get("out"):
            print("exported %d rows to %s" % (n, kv["out"]))
        return 0
    print(__doc__); return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
