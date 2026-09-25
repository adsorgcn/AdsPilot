#!/usr/bin/env bash
# 全部自测：不需要任何凭据，不出网（selfcheck 用 --quick）。CI 跑的就是这个。
set -u
cd "$(dirname "$0")/.."
fail=0
run() { echo "== $*"; if "$@"; then echo "   ok"; else echo "   FAIL"; fail=1; fi; }
run python3 core/agent/ilang_runtime.py verify
run python3 core/agent/selfcheck.py --quick
run python3 core/selfcheck/validate.py --all
run python3 core/judge/judge.py --selftest
run python3 core/ledger/reconcile.py --selftest
run python3 core/lp/lp_check.py --selftest
run python3 plugins/traffic/google-ads/report_import.py --selftest
run python3 plugins/traffic/google-ads/spec.py --selftest
run python3 plugins/traffic/google-ads/convert_export.py --selftest
run python3 plugins/affiliate/cj/commissions.py --selftest
run python3 plugins/affiliate/cj/chargebacks.py --selftest
run python3 plugins/affiliate/cj/offers.py --selftest
run python3 plugins/affiliate/cj/link.py --selftest
run python3 plugins/judgment/llm/provider.py --selftest
run python3 plugins/judgment/jev/provider.py --selftest
run python3 plugins/judgment/soul-api/provider.py --selftest
run python3 core/loop/daily.py --selftest
run python3 reference/ilang/ilang_judge_validator.py --selftest
# 判断块与正典校验器一致
python3 core/judge/judge.py --node campaign.adjust --state tests/fixtures/state.adjust.json --choices tests/fixtures/choices.adjust.json --evidence x >/dev/null 2>tests/.judge.txt
run python3 reference/ilang/ilang_judge_validator.py --check tests/.judge.txt
rm -f tests/.judge.txt
if command -v node >/dev/null 2>&1; then run node --check plugins/deploy/cloudflare-worker/worker.js; fi
echo; if [ $fail -eq 0 ]; then echo "ALL OK"; else echo "SOME FAILED"; fi
exit $fail
