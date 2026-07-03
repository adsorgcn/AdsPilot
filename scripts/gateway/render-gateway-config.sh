#!/usr/bin/env bash
set -euo pipefail

# Render API Gateway config by replacing backend addresses.
# Inputs via env vars (any subset):
#  IDENTITY_URL, BILLING_URL, OFFER_URL, SITERANK_URL, BATCHOPEN_URL, ADSCENTER_URL, WORKFLOW_URL, CONSOLE_URL, USERACTIVITY_URL
# Usage example:
#  IDENTITY_URL=https://identity-xxx.run.app \
#  BILLING_URL=https://billing-xxx.run.app \
#  OFFER_URL=https://offer-xxx.run.app \
#  SITERANK_URL=https://siterank-xxx.run.app \
#  BATCHOPEN_URL=https://batchopen-xxx.run.app \
#  ADSCENTER_URL=https://adscenter-xxx.run.app \
#  WORKFLOW_URL=https://workflow-xxx.run.app \
#  CONSOLE_URL=https://console-xxx.run.app \
#  USERACTIVITY_URL=https://useractivity-xxx.run.app \
#  ./scripts/gateway/render-gateway-config.sh deployments/gateway/gateway.v2.yaml out/gateway.yaml

SRC=${1:?source gateway.yaml required}
OUT=${2:?output path required}

mkdir -p "$(dirname "$OUT")"

python3 - "$SRC" "$OUT" << 'PY'
import os, sys
_, src, out = sys.argv
with open(src, 'r', encoding='utf-8') as f:
    text = f.read()

mapping = {
    'identity-REPLACE_WITH_RUN_URL': os.getenv('IDENTITY_URL', ''),
    'billing-REPLACE_WITH_RUN_URL': os.getenv('BILLING_URL', ''),
    'offer-REPLACE_WITH_RUN_URL': os.getenv('OFFER_URL', ''),
    'siterank-REPLACE_WITH_RUN_URL': os.getenv('SITERANK_URL', ''),
    'batchopen-REPLACE_WITH_RUN_URL': os.getenv('BATCHOPEN_URL', ''),
    'adscenter-REPLACE_WITH_RUN_URL': os.getenv('ADSCENTER_URL', ''),
    'workflow-REPLACE_WITH_RUN_URL': os.getenv('WORKFLOW_URL', ''),
    'console-REPLACE_WITH_RUN_URL': os.getenv('CONSOLE_URL', ''),
    'notifications-REPLACE_WITH_RUN_URL': os.getenv('NOTIFICATIONS_URL', ''),
    'recommendations-REPLACE_WITH_RUN_URL': os.getenv('RECOMMENDATIONS_URL', ''),
    'useractivity-REPLACE_WITH_RUN_URL': os.getenv('USERACTIVITY_URL', ''),
}
proj = os.getenv('PROJECT_ID') or os.getenv('GOOGLE_CLOUD_PROJECT')
if proj:
    text = text.replace('<PROJECT_ID>', proj)
for placeholder, val in mapping.items():
    if val:
        # Accept full URL or host; API Gateway spec already contains scheme
        if val.startswith('https://'):
            val = val[len('https://'):]
        if val.startswith('http://'):
            val = val[len('http://'):]
        text = text.replace(placeholder, val)

with open(out, 'w', encoding='utf-8') as f:
    f.write(text)
print(f"[DONE] Rendered gateway config to {out}")
PY
