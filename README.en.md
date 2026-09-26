# AdsPilot

**Open source, free.** The whole affiliate-advertising operation packaged as a core plus plugins, handed to *your own* agent (Claude Code, Codex, OpenClaw, Hermes or similar) to run unattended on *your own* accounts and *your own* machine. No login, no hosting, no fees.

**Compliance, stated next to "free":** your real identity, one account, KYC done honestly; no fake traffic, no click simulation, no cloaking, no bypassing platform eligibility or bans, no impersonation, no multi-accounting; zero credential retention, everything stays on your machine. If you cannot live with these, this repository cannot help you.

*中文: [README.md](README.md)*

## What it is and why it is built this way

Traditional ad SaaS is built as "the platform works for you": you log into its back office, hand it your accounts, pay monthly, and it builds campaigns, reads reports and moves budgets for you. That shape cannot avoid login, billing, tenants and hosted tokens, and it always makes the judgment calls for you, out of sight.

AdsPilot is built the other way round: "your agent works for you". There is no program to compile, no back office, no account system. The repository is a set of usage methods written for agents, plus small scripts that use only the Python standard library. The usage methods are written in iLang, so Claude Code, Codex or any other capable agent reads the same text and executes it the same way. Your agent reads the entry file, checks whether this machine qualifies for unattended operation, then follows the usage methods on your own Google Ads and CJ accounts: build campaigns, pull reports, reconcile commissions, feed conversions back, one round a day.

It splits in two along one rule: **anything that talks to an external API is a plugin; everything else is core.** The core depends on no external service. Remove any plugin and the core still runs, only dumber. Adding a platform or a network means adding one directory; the core does not change.

The core guarantees it runs; how well it runs depends on the SOUL, the collection of judgment rules and thresholds. A general default SOUL ships in the repo, local, open, free. At every decision point (which offer, whether to publish, raise budget or pause today, keep or stop this keyword, upload this conversion, stop on an account anomaly) the core scores the state as an iLang v5 eleven-dimension vector, runs the frozen f_v5 cascade to get M1 through M8. Judgment is advice, not a gate: when you say what to run or how to adjust, that is what happens, and the judgment is still computed and written into the output and ledger as advice; when you have not said, the agent decides by the judgment, M1 and M2 execute and the rest are only proposed. The only thing a word from you does not unlock is the first-screen compliance posture. During the public-good phase iLang Inc. hosts a judgment service (a cheap model plus Jev) free of charge, to sharpen the judgment on real data. This is also the first sizeable commercial application of the [iLang protocol](https://github.com/ilang-ai/ilang-spec): v3 communication, v4 execution, v5 judgment.

Humans appear in exactly three places: identity and KYC, payment and card binding, and appeals the platform requires in person. Everything else is the agent and the scripts.

## A student's day

At half past six the scheduler starts `core/loop/daily.py`. It self-checks, pulls yesterday's click mappings back from the relay on your own domain, reads the Google Ads report, pulls CJ commission detail, matches commissions to gclid and keyword by token, and writes a conversion file ready to go back into Google Ads. Then it walks every campaign and keyword through judgment: this campaign's average CPC is over the cap, lower the bid; that one spent a hundred with no conversion, pause it; this one has had commissions three days running, raise budget twenty percent. Actions are executed through the API when credentials are present, conversions go up through Data Manager; without credentials they become a to-do list the agent works through in the back office. Finally it leaves `report.json` and `run.log` in `runs/<id>/`; exit code 0 is normal, 2 means a human is needed, and a coach who wants to look asks for those two files. Nothing is sent anywhere automatically.

## The skeleton at a glance

```
core/       agent adaptation & self-check · launch · lp · judge (f_v5 frozen) · ledger (sub-id attribution & reconciliation) · loop · selfcheck
plugins/    traffic/google-ads · affiliate/cj · judgment/{llm,jev,soul-api} · deploy/cloudflare · keywords · ipintel
soul/       default SOUL, SOUL interface, SOUL API interface
schemas/    manifest · judgment · report · traffic-spec · traffic-report · commissions
reference/  pinned iLang runtime · affiliate-design · v1 handoff
```

The architecture one-pager is `ARCHITECTURE.md`; changing it needs the owner's sign-off.

## Where things stand

As of 2026-09-26, version 2.0.17. Every part below has code, a usage method and a self-test; the difference is whether it has touched the real world.

| Part | State | Real world |
|---|---|---|
| Agent adaptation & self-check | done | three identical entry files, twelve checks, pinned iLang runtime verification |
| Launch (three keys in, one campaign out) | **live-tested on a real account** | on reviews.aixray.dev: landing site built from nothing, page published, campaign created, one real click into the ledger, no human in between, then torn down |
| Landing page | done | template and compliance check pass self-test; one page published on a real domain during launch |
| Judgment (f_v5 frozen) | done | judgment blocks verified by the canonical iLang validator; providers are perception only |
| Attribution & reconciliation | done | sample data only |
| Unattended loop | done | sample data only; seven-day acceptance not run; user decisions expire and have a money limit |
| Default SOUL | done | money defined in USD and converted to the account currency; no bid or budget constants, the bid fallback and budgets follow Google's recommendation; custom boundaries are enforced by code and judgment plugins follow the configured SOUL; thresholds copied from the SOP, not yet calibrated on real data |
| Plugin Google Ads | **live-tested on a real account** | create campaign, adjust budget and bids, pause keyword, add negative, remove campaign, pull report, Data Manager conversion upload (validate-only): all pass |
| Plugin CJ | **live-tested on a real account** | offers (187 advertisers, paged), link with sid, commissions in windows, chargebacks: all pass (read-only) |
| Plugin judgment llm / jev / soul-api | code complete | never connected to real endpoints; jev waits for docs; soul-api server not built |
| Plugin Cloudflare landing site | **live-tested on a real account** | one key builds KV, Worker, domain and certificate; page 200, /go 302 with sid, /export into the ledger: all pass |
| Offer rule 1 (keyword bid < earnings per click) | **live-tested on a real account** | top 10 CJ offers checked against real bids: 3 pass, 7 out; passing keywords go straight to campaign creation |
| Plugin keywords (Google Ads Keyword Planner) | **live-tested on a real account** | homepage URL as seed yields category keywords with monthly searches and top-of-page bids |
| Plugin ipintel | contract only | first release pending |

In one sentence: onboarding is now one action, hand over three keys (Cloudflare, Google Ads, CJ), then run launch and get a real campaign. The whole chain from landing site to campaign to ledger has closed once in the real world. The only part not yet touched by real data is the SOUL thresholds, which can only be calibrated by running. Next is the first student environment running seven unattended days, after which the plugins move from alpha to stable.

## Progress log

**2026-09-26, 2.0.17.** The Google budget recommendation calls were checked on a real account for the first time, and three guesses from the docs were wrong: the pre-launch request needs location IDs, the query for running campaigns must select the whole recommendation object, and amounts must be labeled with the account currency rather than the brief's. All three are fixed, and a recommendation in the wrong currency is not used. Google gave no recommendation that time, so the recommended values still wait for a check.

**2026-09-26, 2.0.16.** Budgets follow Google's recommendation. Before, AdsPilot set budgets itself: USD 5 on day one, at most USD 10 a day, plus 20% when profitable, so a new account for which Google recommended HK$60 was blocked. There are no budget constants now: a new campaign gets Google's recommended budget, and a running campaign moves to Google's new recommendation when there is one; the user changes it if they want (a budget in the brief, or caps in the config); without a recommendation, launch asks the user and the daily loop leaves the budget alone. Loss-stopping rules still come first. This release did not touch a real account; the budget recommendation calls have not been checked on a real account yet.

**2026-09-26, 2.0.15.** The bid fallback is now Google's recommended bid. Before, a campaign without an offer-derived bid cap was held to a USD 0.25 constant written into the SOUL, so a profitable campaign averaging HK$3.5 per click was cut every day. The SOUL no longer carries bid constants: without an offer cap or a user cap, the cap is Google's top-of-page bid estimate (Keyword Planner at launch, each keyword's estimate in the daily report); if even that is missing, bids are not touched and launch only proposes. Also fixed an old issue: once a campaign was judged "keep", its change clock reset every day and it could never get a budget increase; keep no longer counts as a change. This release did not touch a real account; only self-tests and sample data were run.

**2026-09-26, 2.0.14.** Switching the SOUL now actually takes effect. Before, boundaries added in a custom SOUL were read by name only and never enforced, and the llm judgment plugin always took its rules from the default SOUL, so a different SOUL in the config still showed it the old rules. Boundaries can now carry conditions (for example "no keeping or raising budget when average CPC is over 2 with no conversions"); a hit stops the step, and the kind decides what a user's word can do: an operational boundary gives way when the user says so, a compliance boundary does not. A broken SOUL is rejected instead of running. The five built-in boundaries live in code and still apply if a SOUL deletes their lines. The judgment plugins now read the SOUL from the config. The order of the daily adjustment rules in the default SOUL now matches the code, with a guard that fails whichever side changes first. This release did not touch a real account; only self-tests and sample data were run.

**2026-09-26, 2.0.13.** User decisions now have an expiry and a money limit. Before, one sentence from the user such as "leave all these campaigns alone" was followed forever: no expiry, no matter how much was spent afterwards, even after a campaign passed the test spend total. Now each decision expires after 7 days by default (or on the date the user gave); if a campaign spends another $100 after the loop first saw the decision, or passes the test spend total, the decision lapses and the judgment decides again. The two spending nodes no longer accept "all" as a target; the user names each campaign or keyword. Each run's report lists which decisions were used, which lapsed and why. This release did not touch a real account; only self-tests and sample data were run.

**2026-09-26, 2.0.12.** Money now has a unit and bids have one rule. SOUL amounts (bid 0.25, budgets 5 and 10, stop-loss 100 and 300) used to carry no unit, so in a HK$ account they were read as HK$: a profitable campaign averaging HK$3.5 per click was cut every day, and a HK$3.79 keyword that offer selection approved was then refused at campaign creation. SOUL amounts are now defined in USD and converted by `config.currency` and `config.fx`; the bid cap comes from what this offer earns per click, and offer selection, campaign creation and daily bid changes use the same number. `config.caps` is empty by default; filled values are absolute caps in the account currency. Dry-run of launch offers and campaign for Roborock on our HK$ account: bid cap HK$4.56, campaign bid 4.42 (low top-of-page bid of the first passing keyword), first-day budget $5 converted to HK$39, judgment go.

**2026-09-26, 2.0.11.** Fixed a logic error: judgment had been built as a gate and blocked what the user wanted (a picked offer that failed the math was refused, a page that failed the check was not published, a hold stopped campaign creation). Now judgment only advises: when the user says, it is done, with the judgment still computed and recorded as advice; when the user has not said, the agent decides by the judgment. The daily loop works the same way: "don't pause this one" means the loop does not pause it and logs the judgment's view. Only the first-screen compliance posture is not unlocked by a word.

**2026-09-26, 2.0.10.** Offer rule 1: an offer can run only if at least one keyword's bid is below what one click earns. Earnings per click is EPC÷100 in the ad account's currency; the bid is Keyword Planner's low top-of-page bid; brand terms count only if the program allows brand bidding. First keywords plugin. On our account against the top 10 CJ offers: Roborock earns HK$4.56 per click and 6 category keywords bid below that (lowest: vacuum mop at 3.79), so it passes; ContactsDirect earns 12.52 but its cheapest non-brand keyword costs 18.96, so it is out. 3 of 10 pass.

**2026-09-25, 2.0.9.** Onboarding becomes key handover: three keys in environment variables, everything else is the agent. New core part "launch", seven steps (build landing site, pick offer, write and publish page, create campaign, one real click, enable, teardown). Cloudflare plugin rebuilt so one key builds everything (no wrangler, nothing to click in a console). With our own keys, on a real domain, from nothing to a campaign with no human in between, then torn down: the whole chain closed in the real world for the first time.

**2026-09-25, 2.0.8.** README rewritten as this narrative, with the "where things stand" table and this progress log; from now on every version is written in both places, details in `CHANGELOG.md`, the story here.

**2026-09-25, 2.0.7.** CJ plugin live-tested read-only with real publisher credentials: all four actions pass. Three corrections from the test: the Commission Detail collection field is `records`, a single query window cannot exceed 31 days (split into 30-day chunks), and Link Search wants the promotional property ID (new `CJ_WEBSITE_ID`). Old branches tagged `archive/` and removed; main protected.

**2026-09-25, 2.0.6.** Data Manager conversion upload passes validate-only on a real account. Pinned: a newly created click-upload conversion action takes about an hour to propagate before Data Manager can see it; the script marks `retry_later` and retries next round.

**2026-09-25, 2.0.5.** Data Manager request corrected from the live test: events carry `destinationReferences`, `eventSource` is required, `DUPLICATE_NAME` gets an automatic suffix.

**2026-09-25, 2.0.4.** Data Manager request checked against the official field mapping: `accountType` replaces the deprecated `product`, `encoding`, numeric `productDestinationId`, whole-batch fast fail.

**2026-09-25, 2.0.3.** Google Ads api path completed and live-tested on a real account: a campaign with a 1 HKD daily budget, paused on creation; budget, bid, keyword pause and negative keyword adjusted; then removed together with its budget. Found that v25 rejects `startDate`, bids must be multiples of the billable unit, and `uploadClickConversions` is closed to new integrations.

**2026-09-25, 2.0.2.** Aligned with Google's new policy: developer tokens deprecated from 2026-09-09, access level decided by the OAuth Cloud project, REST defaults to v25.

**2026-09-25, 2.0.1.** Report-back channel removed; the loop sends nothing out, reports stay local. Whether students use it well is read from the community bot's conversation logs.

**2026-09-25, 2.0.0.** First AI-paradigm release. Repositioned as an open, free core plus plugins; old Go code archived at `v1-go-archive`. Seven core parts, first plugins, six schemas, default SOUL, 21 self-tests.

**Before 2026-09-24.** The 1.x Go version, see `reference/HANDOFF-v1.md`.

## Three minutes (for your agent)

```bash
git clone https://github.com/adsorgcn/AdsPilot && cd AdsPilot
python3 core/agent/selfcheck.py                       # does this machine qualify for unattended operation
cp config/adspilot.example.json config/adspilot.json  # your values; credentials go in environment variables
python3 core/loop/daily.py --dry-run                  # one round, writes nothing external
```

Entry files: `CLAUDE.md` (Claude Code), `AGENTS.md` (Codex and others), `.cursor/rules/` (Cursor). Same content. Then install the scheduler per `core/loop/使用方法.md`, one round a day.

## Versioning and license

Three-part `VERSION`. Routine changes bump the last digit; a "minor" bumps the middle; the first digit is decided separately. Details of every version are in `CHANGELOG.md`.

MIT. The vendored iLang runtime is from ilang-spec (MIT).
