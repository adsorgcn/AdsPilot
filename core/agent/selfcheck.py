#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AdsPilot 能力自检（主干，Agent 适配部件）

执行者 Agent 在动任何东西之前先跑这一个脚本。它回答一个问题：这台机器加这个 Agent，够不够格无人值守地跑。
不够格就停，把结果贴给用户；不硬跑。

用法：
  python3 core/agent/selfcheck.py            # 人类可读摘要 + 退出码
  python3 core/agent/selfcheck.py --json     # 机器可读
  python3 core/agent/selfcheck.py --quick    # 跳过网络与插件校验（循环里每轮用）

退出码：0 全过（允许 warn）；1 有 fail。
只用标准库。
"""
import hashlib
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
import tempfile
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
MIN_PY = (3, 9)
SECRET_MARKERS = ("github_pat_", "ghp_", "AIza", "sk-ant-", "-----BEGIN ", "xoxb-", "AKIA")


def _res(name, status, detail="", fix=""):
    return {"check": name, "status": status, "detail": detail, "fix": fix}


def check_python():
    v = sys.version_info[:3]
    ok = v >= MIN_PY
    return _res("python", "pass" if ok else "fail", "%d.%d.%d" % v,
                "" if ok else "需要 Python %d.%d 以上" % MIN_PY)


def check_shell():
    try:
        out = subprocess.run(["echo", "adspilot"], capture_output=True, text=True, timeout=5)
        ok = out.returncode == 0 and out.stdout.strip() == "adspilot"
        return _res("shell_exec", "pass" if ok else "fail", "subprocess ok" if ok else out.stderr.strip())
    except Exception as e:  # noqa: BLE001
        return _res("shell_exec", "fail", str(e), "Agent 必须能执行命令，否则不适用")


def check_write(cfg):
    dirs = [cfg.get("data_dir", "data"), cfg.get("runs_dir", "runs")]
    bad = []
    for d in dirs:
        p = os.path.join(ROOT, d)
        try:
            os.makedirs(p, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=p, delete=True) as f:
                f.write(b"x")
        except Exception as e:  # noqa: BLE001
            bad.append("%s: %s" % (d, e))
    return _res("write_dirs", "fail" if bad else "pass", "; ".join(bad) if bad else ", ".join(dirs),
                "目录不可写就换 data_dir/runs_dir" if bad else "")


def check_network(timeout=5.0):
    hosts = [("raw.githubusercontent.com", 443), ("commissions.api.cj.com", 443)]
    reach = []
    for h, port in hosts:
        try:
            s = socket.create_connection((h, port), timeout=timeout)
            s.close()
            reach.append(h)
        except Exception:  # noqa: BLE001
            pass
    if not reach:
        return _res("network", "fail", "no host reachable", "插件都要出网；没有网络不适用")
    if len(reach) < len(hosts):
        return _res("network", "warn", "reachable: %s" % ", ".join(reach), "部分主机不可达，相关插件会退回 CSV 导入")
    return _res("network", "pass", ", ".join(reach))


def check_scheduler():
    found = []
    if shutil.which("systemctl"):
        found.append("systemd")
    if shutil.which("crontab"):
        found.append("cron")
    if shutil.which("schtasks"):
        found.append("schtasks")
    if shutil.which("launchctl"):
        found.append("launchd")
    if not found:
        return _res("scheduler", "fail", "none", "无人值守需要一个调度器：systemd timer、cron、launchd 或 Windows 任务计划")
    return _res("scheduler", "pass", ", ".join(found))


def check_long_run():
    # 能否派生一个脱离当前会话的进程：nohup 或 setsid 任一即可；Windows 用 start
    tools = [t for t in ("nohup", "setsid", "tmux", "screen") if shutil.which(t)]
    if platform.system() == "Windows":
        return _res("long_run", "pass", "windows: 用任务计划常驻")
    if not tools:
        return _res("long_run", "warn", "no nohup/setsid", "循环靠调度器拉起即可，常驻哨兵需要 nohup 或 setsid")
    return _res("long_run", "pass", ", ".join(tools))


def check_deploy_tools():
    tools = [t for t in ("git", "curl") if shutil.which(t)]
    missing = [t for t in ("git", "curl") if t not in tools]
    if missing:
        return _res("deploy_tools", "warn", "have: %s" % ", ".join(tools), "缺 %s" % ", ".join(missing))
    return _res("deploy_tools", "pass", ", ".join(tools) + "（落地位走 Cloudflare API，不需要 node）")


def check_ilang_runtime():
    p = os.path.join(ROOT, "reference", "ilang", "ilang-latest.md")
    s = os.path.join(ROOT, "reference", "ilang", "ilang-latest.sha256")
    if not (os.path.exists(p) and os.path.exists(s)):
        return _res("ilang_runtime", "fail", "missing", "python3 core/agent/ilang_runtime.py update --apply")
    with open(p, "rb") as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    with open(s, "r", encoding="utf-8") as f:
        want = f.read().split()[0].strip()
    ok = digest == want
    return _res("ilang_runtime", "pass" if ok else "fail", digest[:12], "" if ok else "runtime 与 sha256 不符，重新拉取")


def load_config():
    p = os.path.join(ROOT, "config", "adspilot.json")
    if not os.path.exists(p):
        return None, _res("config", "warn", "config/adspilot.json 不存在，用 example 的默认值",
                          "cp config/adspilot.example.json config/adspilot.json 然后填自己的值")
    try:
        with open(p, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    except Exception as e:  # noqa: BLE001
        return None, _res("config", "fail", "JSON 解析失败: %s" % e)
    if cfg.get("config_version") != 1:
        return cfg, _res("config", "fail", "config_version 必须为 1")
    return cfg, _res("config", "pass", "apply=%s provider=%s" % (cfg.get("apply"), (cfg.get("judgment") or {}).get("provider")))


def check_soul_money(cfg):
    """SOUL 金额按 money_unit（美元）写，主干按 config.fx 折成 config.currency：两个币种都要在 fx 里。"""
    if not cfg:
        try:
            cfg = json.load(open(os.path.join(ROOT, "config", "adspilot.example.json"), encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            return _res("soul_money", "fail", "读不到 config: %s" % e)
    sys.path.insert(0, os.path.join(ROOT, "core", "judge"))
    try:
        import judge as J  # noqa: E402
        soul = J.load_soul(cfg.get("soul", "soul/default.soul.md"))
    except Exception as e:  # noqa: BLE001
        return _res("soul_money", "fail", "SOUL 读不了: %s" % str(e)[:160])
    cur, unit, fx = cfg.get("currency"), soul.get("money_unit", "USD"), cfg.get("fx") or {}
    miss = [c for c in (cur, unit) if not isinstance(fx.get(c), (int, float))]
    if not cur or miss:
        return _res("soul_money", "fail", "config.currency=%s SOUL money_unit=%s，config.fx 缺 %s" % (cur, unit, ", ".join(str(m) for m in miss) or "currency"),
                    "在 config.fx 里填这两个币种每 1 美元的汇率")
    return _res("soul_money", "pass", "SOUL %s → 账户 %s，汇率 %s" % (unit, cur, round(float(fx[cur]) / float(fx[unit]), 4)))


def check_secrets_in_repo():
    hits = []
    skip_dirs = {".git", "data", "runs", "node_modules", "__pycache__"}
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for fn in filenames:
            if fn == "selfcheck.py" or fn.endswith((".png", ".jpg", ".db", ".sqlite")):
                continue
            p = os.path.join(dirpath, fn)
            try:
                with open(p, "r", encoding="utf-8", errors="ignore") as f:
                    txt = f.read()
            except Exception:  # noqa: BLE001
                continue
            for m in SECRET_MARKERS:
                if m in txt:
                    hits.append("%s (%s)" % (os.path.relpath(p, ROOT), m.strip()))
                    break
    return _res("no_secrets_in_repo", "fail" if hits else "pass", "; ".join(hits) if hits else "clean",
                "把凭据移到环境变量，仓库里只留变量名" if hits else "")


def check_version_consistency():
    vp = os.path.join(ROOT, "VERSION")
    cp = os.path.join(ROOT, "CHANGELOG.md")
    try:
        v = open(vp, encoding="utf-8").read().strip()
        top = ""
        for line in open(cp, encoding="utf-8"):
            if line.startswith("## "):
                top = line[3:].strip()
                break
        ok = top.startswith(v)
        return _res("version", "pass" if ok else "fail", "VERSION=%s CHANGELOG=%s" % (v, top),
                    "" if ok else "VERSION 与 CHANGELOG 最上面一条不一致")
    except Exception as e:  # noqa: BLE001
        return _res("version", "fail", str(e))


def check_plugins():
    v = os.path.join(ROOT, "core", "selfcheck", "validate.py")
    try:
        out = subprocess.run([sys.executable, v, "--manifests"], capture_output=True, text=True, timeout=60)
        ok = out.returncode == 0
        return _res("plugin_manifests", "pass" if ok else "fail", (out.stdout or out.stderr).strip().splitlines()[-1] if (out.stdout or out.stderr) else "")
    except Exception as e:  # noqa: BLE001
        return _res("plugin_manifests", "fail", str(e))


def main(argv):
    quick = "--quick" in argv
    as_json = "--json" in argv
    t0 = time.time()
    cfg, cfg_res = load_config()
    cfg = cfg or {}
    results = [check_python(), check_shell(), check_write(cfg), check_scheduler(), check_long_run(),
               check_deploy_tools(), check_ilang_runtime(), cfg_res, check_version_consistency(),
               check_secrets_in_repo(), check_soul_money(cfg)]
    if not quick:
        results.append(check_network())
        results.append(check_plugins())
    fails = [r for r in results if r["status"] == "fail"]
    warns = [r for r in results if r["status"] == "warn"]
    verdict = "fail" if fails else "pass"
    report = {"type": "adspilot.selfcheck", "verdict": verdict, "root": ROOT, "os": platform.platform(),
              "elapsed_ms": int((time.time() - t0) * 1000), "results": results}
    if as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        for r in results:
            line = "[%-4s] %-20s %s" % (r["status"].upper(), r["check"], r["detail"])
            if r["fix"]:
                line += "  -> " + r["fix"]
            print(line)
        print("verdict: %s (%d fail, %d warn)" % (verdict.upper(), len(fails), len(warns)))
        if fails:
            print("::STATUS{@SELFCHECK|state:blocked|missing:%s|by:@SELF|authority:proposal}" % ",".join(r["check"] for r in fails))
        else:
            print("::STATUS{@SELFCHECK|state:claimed_complete|evidence:selfcheck|by:@SELF|authority:proposal}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
