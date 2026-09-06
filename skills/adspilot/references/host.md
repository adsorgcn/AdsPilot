# Host capability binding

Activation requires only loading the skill text. All execution belongs to the
agent host. Do not bootstrap an AdsPilot daemon or ask a human to administer
infrastructure when a capability is missing.

Discover actual tools and bind these logical capabilities to observed tool
names and schemas. Names below are domain labels, not callable functions.

| Logical capability | Evidence required before use |
| --- | --- |
| `google_ads.identity` | Connected provider identity and accessible customer IDs |
| `google_ads.query` | Authorized GAQL/search tool or authenticated Google Ads HTTP transport |
| `google_ads.keyword_ideas` | Keyword-planning tool with customer, language, and geography inputs |
| `google_ads.validate` | Provider validation that cannot apply mutations |
| `google_ads.mutate` | Host permission gate and scoped account/budget authorization |
| `google_ads.conversions` | Documented conversion upload tool, validation behavior, and per-item result schema |
| `host.records` | Durable, access-controlled plan/result storage with conditional writes |
| `host.authorization` | Host-enforced grant bound to provider, account, operations, budget, and current plan revision |
| `host.input_isolation` | Host-controlled separation of trusted instructions from untrusted provider/page content |
| `host.secrets` | Opaque secret references and request-time credential injection |
| `affiliate.read` | Connected CJ or other network account and documented read schema |
| `host.schedule` | Scheduler already supplied by the agent platform, when requested |

Prefer a connected Google Ads/CJ tool. Use authenticated HTTPS only when the
host can inject secrets without placing token values in generated commands,
prompts, URLs, logs, or files. A public web-fetch tool is not authenticated
transport. Missing tools and unconfigured accounts are separate conditions.

Read-only provider access can operate with host-authenticated identity and
normal tool isolation. A side effect additionally requires the host to enforce
scope, isolate untrusted input, and durably record operation identity and
outcome. A sentence claiming these capabilities is insufficient. If the host
cannot attest them, expose research and draft capabilities only.

Reuse existing OAuth grants in the host. If a grant is missing, use its own
account-connection flow. The owner may need to consent to the third-party
account; that does not require a terminal, loopback listener, or user server.
Do not promise the skill itself can grant Google API access, bypass provider
review, or retain secrets outside the host's protected store.

`customer_id` is the account being read or changed. `login_customer_id` is an
optional manager used for access. Never substitute one for the other. An
accessible-customer list can contain managers; inspect the hierarchy and
verify the selected client account, currency, timezone, and permission before
binding the task. When several targets fit and no prior selection exists,
prepare the work and ask for the target account before any write.

On handoff or session resumption, reload host-held plan/evidence records and
recheck their account and revision. Conversation memory is not an execution
ledger. Without durable state, research and drafting remain available; do not
start a retryable advertising mutation or promise unattended monitoring.

Report readiness as `planning_only`, `read_ready`, or `write_ready`, along with
the missing capabilities. Readiness describes this host/session, not every
installation of AdsPilot. The package always remains instruction-only.
