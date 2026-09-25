#!/usr/bin/env bash
# 哨兵：只查不动。最新一轮超过 26 小时没跑、或最近退出码是 1/3，就报。用回流插件发一条（配置了才发）。
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
  if [ -n "${ADSPILOT_REPORT_WEBHOOK:-}" ]; then
    python3 - "$msg" <<'PY'
import json,os,sys,urllib.request
body={"msg_type":"text","content":{"text":"AdsPilot sentinel: "+sys.argv[1]}}
req=urllib.request.Request(os.environ["ADSPILOT_REPORT_WEBHOOK"],data=json.dumps(body).encode(),headers={"Content-Type":"application/json"},method="POST")
try: urllib.request.urlopen(req,timeout=10)
except Exception as e: print("webhook failed:",e)
PY
  fi
  exit 2
fi
echo "$(date -Is) sentinel ok: $latest exit ${code:-?} age ${age_h}h"
