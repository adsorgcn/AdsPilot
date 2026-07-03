# AdsPilot

*Read this in [中文](README.md).*

**An AI that runs your Google Ads.**

AdsPilot isn't a dashboard you log into. You install it locally, connect your own Google
Ads account, and then you talk to an AI that operates Google Ads for you: researching
offers and keywords, building and adjusting campaigns, filtering traffic, and managing
multiple accounts.

> **Your credentials stay yours.** Authorization happens locally in your browser (an
> OAuth loopback flow, the same pattern the Claude Code CLI uses to sign in). Your Google
> refresh token is stored on your own machine and is never sent to any server.

## What it is

Most ad tools are a web console: you log in, click around, and configure everything by
hand. AdsPilot inverts that. The interface is the AI. You describe what you want in plain
language, and the AI drives the Google Ads API for you.

- The AI is the operator; there's no management UI to learn.
- It runs where you are, on your own machine, not on a hosted service that holds your account.
- It's meant to run as an OpenClaw skill, so non-technical users can install it through
  guided setup, and the bugs they hit become improvements to the project.

## Why there's no login system

Traditional ad SaaS needs a login system, subscription billing, multi-tenant permissions,
and custody of your tokens, because its architecture is "the platform does the work for
you." AdsPilot's architecture is "the AI does the work for you." You install locally,
authorize Google in your own browser, and the token stays yours. The AI drives the API
directly, so there's no web backend in the middle. Login, billing, multi-tenancy, and
token custody don't need to exist in this model, so they don't.

## Core capabilities

**1. Affiliate API integration.** A pluggable `AffiliateProvider` interface. The AI
selects offers from an affiliate network's first-party structured data and drafts ad copy.
Adding a new network means implementing the interface, not touching the core.

**2. Google Ads keyword data.** A `KeywordProvider` interface abstracts the keyword
source. The Google Ads API is the first implementation; when API access is still pending,
CSV import is an automatic fallback so nothing stalls.

**3. Real traffic sources with anti-fraud filtering.** Purchased real traffic is tracked,
and four layers filter out fake traffic:

| Layer | Mechanism | Latency |
|---|---|---|
| 1 | Entry fingerprint (IP intelligence, UA anomalies, header consistency) | milliseconds, synchronous |
| 2 | Rate windows (click frequency per IP/fingerprint in a time window) | milliseconds, Redis counters |
| 3 | Behavior signals (dwell time, interaction, JS execution) | seconds, async backfill |
| 4 | Conversion trace-back (an affiliate chargeback maps back to the originating click) | days, offline batch |

IP intelligence is pluggable (`IPIntelProvider`, IPQS first). A real-time rule engine and
an offline ML model run in parallel: rules carry the cold start, the model takes over once
there are enough samples. "Anti-fraud" here means filtering fake traffic out, never
producing it.

**4. Multi-account management.** The Google Ads MCC manages data across many accounts, and
a `BrowserProvider` interface integrates a fingerprint browser (AdsPower first) for session
isolation across accounts.

## How it works

1. **Install** through OpenClaw (or clone and run locally for development).
2. **Authorize.** A local browser flow connects your Google Ads account. The token is
   written to your machine only. See [Local authorization](docs/local-auth.en.md) for setup and the full flow.
3. **Operate.** Tell the AI what you want ("find keywords for this product", "launch a
   campaign for this offer", "why is this ad group underperforming?") and it uses the
   Google Ads API to carry it out.

## Pluggable architecture

Every third-party integration goes through a provider interface, so adding a new one means
implementing the interface rather than changing the core.

| Provider | Interface | First implementation |
|---|---|---|
| Affiliate | `AffiliateProvider` | CJ / Impact |
| Keyword | `KeywordProvider` | Google Ads API |
| Traffic | `TrafficProvider` | Native |
| IP intelligence | `IPIntelProvider` | IPQS |
| AI | `AIProvider` | Claude / DeepSeek |
| Fingerprint browser | `BrowserProvider` | AdsPower |

## Modules

The capability layer is a set of independent Go service modules, wired together through a
Go workspace (`go.work`).

| Module | Responsibility | Status |
|---|---|---|
| `adscenter` | Google Ads API: accounts, keywords, campaigns, MCC | built |
| `aicore` | AI abstraction (offer selection, ad design, anti-fraud inference) | built |
| `siterank` | Site and keyword ranking signals | built |
| `recommendations` | Optimization recommendations | built |
| `proxy-pool` | Neutral IP routing infrastructure | built |
| `gateway-middleware` | Edge auth and routing | built |
| `bff` | Aggregation layer | built |
| `projector` | Event projections and read models | built |
| `useractivity` | Activity tracking | built |
| `console` | Console backend | built |
| `affiliate` | Affiliate API integration | planned |
| `traffic` | Real traffic ingestion and tracking | planned |
| `antifraud` | Anti-fraud filtering | planned |
| `browserpool` | Fingerprint-browser API | planned |

Shared Go libraries live under `pkg/`.

## Status

Local authorization (the browser loopback flow, with the token stored on the user's
machine) is in active development. Packaging the capabilities as an OpenClaw skill and
distributing through ClawHub come next.

## Boundaries

- No fake traffic and no simulated clicks. "Anti-fraud" means filtering fake or junk
  traffic out, never producing it.
- No cloaking, and nothing shown to Google's crawlers that differs from what real users see.
- Credentials never live in the code. They are supplied through environment variables and
  encrypted at rest.
- Your OAuth token stays on your machine, with zero server retention.

## Configuration

Configuration is environment-driven. Start from `.env.example` and supply your own values.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `CREDENTIAL_ENC_KEY` | 32-byte key for encrypting stored credentials |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Your own Google Ads developer token |
| `GOOGLE_ADS_OAUTH_CLIENT_ID` | Your own OAuth client ID (desktop-type client) |
| `GOOGLE_ADS_OAUTH_CLIENT_SECRET` | Your own OAuth client secret |

## Development

Backend (Go 1.25.1+):

```bash
go work sync
go build ./...
```

Formatting and per-module tests run in CI; see `.github/workflows/ci.yml`.

## License

MIT.
