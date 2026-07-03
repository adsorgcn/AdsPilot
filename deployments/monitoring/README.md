# Operations & Monitoring

This folder contains helper scripts and guidance to operate and monitor the platform.

## API Enablement & IAM

Enable required GCP APIs and grant minimal IAM via:

```
PROJECT_ID=${GCP_PROJECT_ID} ./deployments/scripts/enable-apis.sh
```

## API Gateway

Render and deploy gateway v2:

```
PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 \
  ./deployments/scripts/render-gateway-auto.sh

PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 \
  ./deployments/scripts/deploy-gateway-v2.sh
```

## MCC Refresh Scheduler

Create an hourly scheduler job to refresh MCC link statuses:

```
PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 \
  ./deployments/scripts/create-mcc-refresh-scheduler.sh
```

Sharded mode (e.g. 4 shards):

```
PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 TOTAL_SHARDS=4 \
  ./deployments/scripts/create-mcc-refresh-scheduler.sh
```

Run a job immediately:

```
REGION=asia-northeast1 gcloud scheduler jobs run adscenter-mcc-refresh-s0
```

## Uptime & Alerts (guide)

1) Create an uptime check for Gateway `/readyz` (replace hostname):

```
HOST=$(gcloud api-gateway gateways describe gm-gw --location=asia-northeast1 --format='value(defaultHostname)')
# gcloud monitoring uptime checks configs create http is not GA in all SDKs; use Console or Terraform.
# Alternatively, use Monitoring API: https://cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.uptimeCheckConfigs
```

2) Create a simple alert (HTTP 5xx rate or Uptime SLO breach) using Cloud Console or IaC.

### Alert Policies (scripts)

- Create API Gateway uptime check (already present):
  - `PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 ./deployments/monitoring/create-uptime-check.sh`

- Create Cloud Run P95 latency alert per service:
  - `SERVICE=siterank THRESHOLD_SEC=10 PROJECT_ID=${GCP_PROJECT_ID} ./deployments/monitoring/create-alert-latency.sh`
  - `SERVICE=adscenter THRESHOLD_SEC=0.8 ./deployments/monitoring/create-alert-latency.sh`
  - Notes:
    - Uses metric `run.googleapis.com/request_latencies` with ALIGN_PERCENTILE_95 over 5m windows.
    - Threshold in seconds. Customize via `THRESHOLD_SEC` and `WINDOW`.

- Create Cloud Run 5xx error-rate alert per service (MQL):
  - `SERVICE=batchopen THRESHOLD=0.01 PROJECT_ID=${GCP_PROJECT_ID} ./deployments/monitoring/create-alert-error-rate.sh`
  - Notes:
    - Computes 5-minute 5xx/total ratio via MQL over `run.googleapis.com/request_count`.
    - `THRESHOLD` is a ratio (e.g., 0.01 == 1%).

- Bootstrap common alerts for preview stack:
  - `PROJECT_ID=${GCP_PROJECT_ID} ./deployments/monitoring/bootstrap-alerts.sh`
  - Creates P95 and error-rate policies for: siterank, adscenter, batchopen, billing, notifications, console.

### About Prometheus stage metrics

- The services expose Prometheus `/metrics` (e.g., siterank_resolve_nav_ms, siterank_sw_fetch_ms, etc.).
- To alert on these, enable Managed Service for Prometheus (GMP) for Cloud Run and configure scraping.
- Then create alerting policies on `prometheus.googleapis.com/*` metrics (out of scope here). This repo provides Cloud Run and Monitoring scripts; GMP wiring is environment-specific.

> Tip: All services expose Prometheus metrics at `/metrics`. You can attach a managed collector or scrape via Cloud Run sidecars depending on the environment.

### Batchopen metrics & thresholds (guidance)

The `batchopen` service performs landing reachability checks via Browser‑Exec. It now exposes:

- `batchopen_inflight_current` (gauge): current number of concurrent Browser‑Exec checks.
- `batchopen_host_cache_hits_total` (counter): total cache hits for host‑level short cache.
- `batchopen_host_cache_miss_total` (counter): total cache misses.

Recommended monitoring (preview):

- Cache hit ratio (5m):
  - ratio = rate(batchopen_host_cache_hits_total[5m]) / (rate(batchopen_host_cache_hits_total[5m]) + rate(batchopen_host_cache_miss_total[5m]))
  - Alert if ratio < 0.30 for 15m (suggest increasing cache TTL or dedup parameters).

- Inflight saturation: alert if `batchopen_inflight_current` > 0.8 * `BATCHOPEN_MAX_INFLIGHT` for 10m.

- Error budget (via Gateway): use existing 5xx rate alerts (see above) as a catch‑all.

Tuning knobs:

- `BATCHOPEN_DOMAIN_CACHE_MS` (default 120000) — increase to improve hit rate for bursty workloads.
- `BATCHOPEN_MAX_INFLIGHT` (default 8) — raise with care; ensure Browser‑Exec capacity is sufficient.
- `BATCHOPEN_RETRIES`/`BATCHOPEN_BACKOFF_MS` — tune retry behavior for transient 429/5xx.

## Notes

- All production traffic should go through API Gateway (Firebase JWT enforced). For local smoke, use `X-User-Id` header to bypass bearer.
- Keep `FIRESTORE_ENABLED=1` to update UI caches best-effort for notifications/billing.
