Operational Tuning Guide (Preview)

Scope
- Cloud Run scaling for core services
- Non-secret env vars for capacity/cache behavior
- Smoke scripts for validation

Services and Defaults (preview)

browser-exec-{stack}
- Scaling: min=1, max=30, concurrency=80, cpu=2, mem=2048Mi
- Env: BROWSER_MAX_CONTEXTS=12, BROWSER_MAX_MEMORY_MB=1536
- Notes: ensure min>0 for warm pool; adjust max based on traffic

siterank-{stack}
- Scaling: min=1, max=20, concurrency=60
- Env: SIMILARWEB_RETRIES=2
- Notes: enable ANALYZE_WITH_RESOLVE=1 only when Browser-Exec is warmed

adscenter-{stack}
- Scaling: min=1, max=15, concurrency=60
- Env: PREFLIGHT_CACHE_TTL_MS=120000 (2 minutes)
- Notes: keep validate-only fast path hot; monitor P95

One‑click tuning
- Run: STACK=preview PROJECT_ID=<id> REGION=asia-northeast1 deployments/scripts/tune-preview.sh

Env update helper
- deployments/scripts/set-env-vars.sh
  - Example: PROJECT_ID=... REGION=... SERVICE=adscenter ./deployments/scripts/set-env-vars.sh PREFLIGHT_CACHE_TTL_MS=180000

Scaling helper
- deployments/scripts/set-scaling.sh
  - Example: PROJECT_ID=... REGION=... SERVICE=browser-exec MIN=2 MAX=50 CONCURRENCY=80 CPU=2 MEM=2048Mi ./deployments/scripts/set-scaling.sh

Smoke tests
- Bulk reports: deployments/scripts/smoke-bulk-report.sh
- Bulk audits: deployments/scripts/smoke-bulk-audits.sh
- Billing: deployments/scripts/smoke-billing.sh

SLO watchpoints
- Siterank evaluate P95 <= 10s (excludes resolve phase)
- Adscenter preflight P95 <= 800ms
- Browser-Exec error rate <= 1%

Geo augmentation (optional)
- For improved country overlap scoring in Siterank, configure:
  - SIMILARWEB_GEO_URL: a printf-like template returning JSON geo distribution per host
    - Example: https://api.example.com/similarweb/geo?domain=%s
    - Expected flexible shapes:
      - { "country_shares": [{"country":"US","share":0.35}, ...] }
      - or { "top_countries": ["US","GB","CA", ...] }
- Fallback remains: if request provides country but no geo data, Siterank awards full country score (20pts)
