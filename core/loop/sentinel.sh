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
  alert="$(date -Is) sentinel ALERT: $msg ($(basename "$latest"))"
  mkdir -p "$runs_dir" 2>/dev/null || true
  echo "$alert" >> "$runs_dir/sentinel.log" 2>/dev/null || true
  echo "$alert"
  if [ -n "${ADSPILOT_NOTIFY_WEBHOOK:-}" ]; then
    payload="$(python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1], "run": sys.argv[2], "exit_code": sys.argv[3], "age_h": sys.argv[4]}))' "$alert" "$(basename "$latest")" "${code:-}" "$age_h" 2>/dev/null)"
    [ -n "$payload" ] && curl -fsS -m 10 -H "Content-Type: application/json" -d "$payload" "$ADSPILOT_NOTIFY_WEBHOOK" >/dev/null 2>&1 || true
  fi
  exit 2
fi
echo "$(date -Is) sentinel ok: $(basename "$latest") exit ${code:-?} age ${age_h}h"
