#!/usr/bin/env bash
# 哨兵：只查不动。最新一轮超过 26 小时没跑、或最近退出码是 1/3，就在 runs/sentinel.log 里报，退出码 2。
set -u
cd "$(dirname "$0")/../.."
runs_dir="$(python3 -c 'import json,os;print(json.load(open("config/adspilot.json")).get("runs_dir","runs") if os.path.exists("config/adspilot.json") else "runs")')"
latest="$(ls -1dt "$runs_dir"/run-* 2>/dev/null | head -1)"
now=$(date +%s)
if [ -z "$latest" ]; then echo "$(date -Is) sentinel: no runs yet"; exit 0; fi
mtime=$(stat -c %Y "$latest/run.log" 2>/dev/null || stat -f %m "$latest/run.log")
age_h=$(( (now - mtime) / 3600 ))
code="$(grep -o 'exit:[0-9]*' "$latest/run.log" | tail -1 | cut -d: -f2)"
msg=""
[ "$age_h" -gt 26 ] && msg="last run ${age_h}h ago"
case "${code:-x}" in 1|3) msg="${msg:+$msg; }last exit code $code";; esac
if [ -n "$msg" ]; then
  echo "$(date -Is) sentinel ALERT: $msg ($latest)"
  exit 2
fi
echo "$(date -Is) sentinel ok: $latest exit ${code:-?} age ${age_h}h"
