# AdsPilot

**Open source, free.** The whole affiliate-advertising operation packaged as a core plus plugins, handed to *your own* agent (Claude Code, Codex, OpenClaw, Hermes or similar) to run unattended on *your own* accounts and *your own* machine. No login, no hosting, no fees.

**Compliance, stated next to "free":** your real identity, one account, KYC done honestly; no fake traffic, no click simulation, no cloaking, no bypassing platform eligibility or bans, no impersonation, no multi-accounting; zero credential retention, everything stays on your machine.

## What it is

Traditional ad SaaS is built as "the platform works for you", hence login, billing, tenants and hosted tokens. AdsPilot is built as "your agent works for you": the repository is a set of **usage methods** written in iLang (so any capable agent executes them the same way) plus standard-library Python scripts. Your agent reads them and can build campaigns, pull reports, reconcile commissions, upload conversions and run a daily loop by itself.

The core guarantees it runs; how well it runs depends on the SOUL. A general default SOUL ships in the repo (local, open, free). During the public-good phase iLang Inc. hosts a judgment service (a cheap model plus Jev) free of charge.

This is also the first sizeable commercial application of the [iLang protocol](https://github.com/ilang-ai/ilang-spec): v3 communication, v4 execution, v5 judgment.

## One rule

**Anything that talks to an external API is a plugin. Everything else is core.** The core depends on no external service.

```
core/       agent adaptation & self-check · lp · judge (f_v5 frozen) · ledger (sub-id attribution & reconciliation) · loop · selfcheck
plugins/    traffic/google-ads · affiliate/cj · judgment/{llm,jev,soul-api} · deploy/cloudflare-worker · keywords · ipintel
soul/       default SOUL, SOUL interface, SOUL API interface
schemas/    manifest · judgment · report · traffic-spec · traffic-report · commissions
```

## Three minutes (for your agent)

```bash
git clone https://github.com/adsorgcn/AdsPilot && cd AdsPilot
python3 core/agent/selfcheck.py
cp config/adspilot.example.json config/adspilot.json   # credentials go in environment variables
python3 core/loop/daily.py --dry-run
```

Entry files: `CLAUDE.md` (Claude Code), `AGENTS.md` (Codex and others), `.cursor/rules/` (Cursor). Same content, different header.

## Humans appear in exactly three places

Identity/KYC, payment/card binding, and appeals the platform requires in person. A plugin moves from alpha to stable only after seven consecutive unattended days in a clean user environment.

## Versioning

Three-part `VERSION`. Routine changes bump the last digit; a "minor" bumps the middle; the first digit is decided separately. The old Go code is at tag `v1-go-archive`.

MIT. The vendored iLang runtime is from ilang-spec (MIT).
