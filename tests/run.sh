#!/usr/bin/env bash
# 全部自测：不需要任何凭据，不出网（selfcheck 用 --quick）。CI 跑的就是这个。
# Windows：python3 多半是微软商店的占位别名，这里先试 $PYTHON（默认 python3），不能用就退到 python、py；
# 控制台是 GBK 时开 UTF-8 模式，免得「⇒」这类符号在打印时报编码错。
set -u
cd "$(dirname "$0")/.."
export PYTHONUTF8=1
PY="${PYTHON:-python3}"
if ! "$PY" -c "import sys" >/dev/null 2>&1; then
  for c in python py; do
    if "$c" -c "import sys" >/dev/null 2>&1; then PY="$c"; break; fi
  done
fi
echo "python: $PY $("$PY" -c 'import sys; print(sys.version.split()[0])' 2>/dev/null)"
fail=0
run() { echo "== $*"; if "$@"; then echo "   ok"; else echo "   FAIL"; fail=1; fi; }
run "$PY" core/agent/ilang_runtime.py verify
run "$PY" core/agent/selfcheck.py --quick
run "$PY" tests/scan_selftest.py
run "$PY" core/selfcheck/validate.py --all
run "$PY" core/selfcheck/validate.py --interfaces
run "$PY" adspilot.py --selftest
run "$PY" core/agent/mcp_server.py --selftest
run "$PY" core/judge/judge.py --selftest
run "$PY" core/ledger/reconcile.py --selftest
run "$PY" core/lp/lp_check.py --selftest
run "$PY" plugins/traffic/google-ads/report_import.py --selftest
run "$PY" plugins/traffic/google-ads/report_api.py --selftest
run "$PY" plugins/traffic/google-ads/budget_api.py --selftest
run "$PY" plugins/traffic/google-ads/spec.py --selftest
run "$PY" plugins/traffic/google-ads/convert_export.py --selftest
run "$PY" plugins/traffic/google-ads/deploy_api.py --selftest
run "$PY" plugins/traffic/google-ads/convert_api.py --selftest
run "$PY" plugins/traffic/google-ads/oauth_helper.py --selftest
run "$PY" plugins/ipintel/ipapi-is/lookup.py --selftest
run "$PY" core/selfcheck/preflight.py --selftest
run "$PY" core/judge/calibrate.py --selftest
run "$PY" tests/k2_selftest.py
run "$PY" tests/dsh_handoff.py
run "$PY" tests/write_gate_selftest.py
run "$PY" plugins/affiliate/cj/commissions.py --selftest
run "$PY" plugins/affiliate/cj/chargebacks.py --selftest
run "$PY" plugins/affiliate/cj/offers.py --selftest
run "$PY" plugins/affiliate/cj/link.py --selftest
run "$PY" plugins/affiliate/impact/offers.py --selftest
run "$PY" plugins/affiliate/impact/link.py --selftest
run "$PY" plugins/affiliate/impact/commissions.py --selftest
run "$PY" plugins/affiliate/impact/chargebacks.py --selftest
run "$PY" plugins/judgment/llm/provider.py --selftest
run "$PY" plugins/judgment/jev/provider.py --selftest
run "$PY" plugins/judgment/soul-api/provider.py --selftest
run "$PY" plugins/judgment/_template/provider.py --selftest
run "$PY" core/judge/eval_provider.py --selftest
run "$PY" plugins/deploy/cloudflare/cf_api.py --selftest
run "$PY" plugins/deploy/cloudflare/setup.py --selftest
run "$PY" plugins/deploy/cloudflare/publish.py --selftest
run "$PY" plugins/deploy/cloudflare/status.py --selftest
run "$PY" core/launch/launch.py --selftest
run "$PY" core/loop/daily.py --selftest
run "$PY" reference/ilang/ilang_judge_validator.py --selftest
# 判断块与正典校验器一致
"$PY" core/judge/judge.py --node campaign.adjust --state tests/fixtures/state.adjust.json --choices tests/fixtures/choices.adjust.json --evidence x >/dev/null 2>tests/.judge.txt
run "$PY" reference/ilang/ilang_judge_validator.py --check tests/.judge.txt
rm -f tests/.judge.txt
run "$PY" reference/ilang/ilang_grammar_validator.py --lint CONTRIBUTING.md AGENTS.md CLAUDE.md .cursor/rules/adspilot.mdc BOOK.md .dsh/skills/sem/SKILL.md --strict
run "$PY" -c '
import json, pathlib, re
ver = pathlib.Path("VERSION").read_text(encoding="utf-8").strip()
pkg = json.loads(pathlib.Path("package.json").read_text(encoding="utf-8"))
assert pkg["name"] == "adspilot" and pkg["version"] == ver, (pkg["name"], pkg["version"], ver)
book = pathlib.Path("BOOK.md").read_text(encoding="utf-8")
assert re.search(r"^\[VERSION:" + re.escape(ver) + r"\]$", book, re.M), "BOOK.md version"
for p in ("skills/sem.md", ".dsh/skills/sem/SKILL.md"):
    assert re.search(r"^version:\s*" + re.escape(ver) + r"\s*$", pathlib.Path(p).read_text(encoding="utf-8"), re.M), p
bodies = []
for p in ("AGENTS.md", "CLAUDE.md", ".cursor/rules/adspilot.mdc"):
    lines = pathlib.Path(p).read_text(encoding="utf-8").splitlines()
    idx = next(i for i, l in enumerate(lines) if l.startswith("# AdsPilot"))
    bodies.append("\n".join(lines[idx + 1:]))
assert bodies[0] == bodies[1] == bodies[2], "entry shared bodies differ"
print("bundle/entry sync OK: v%s" % ver)
'
if command -v pwsh >/dev/null 2>&1; then
  run pwsh -NoProfile -File tests/k2_windows_preview.ps1 -Python "$PY"
elif command -v powershell.exe >/dev/null 2>&1; then
  run powershell.exe -NoProfile -File tests/k2_windows_preview.ps1 -Python "$PY"
fi
if command -v node >/dev/null 2>&1; then
  run node --check plugins/deploy/cloudflare/worker.js
  run node --check integrations/dsh/index.mjs
  run node --test integrations/dsh/plugin.test.mjs
fi
echo; if [ $fail -eq 0 ]; then echo "ALL OK"; else echo "SOME FAILED"; fi
exit $fail
