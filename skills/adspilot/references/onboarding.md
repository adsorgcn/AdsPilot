# Agent-led onboarding and conditional user intake

The product is the user's agent knowing how to get ready, perform the task,
and recover, not a demand that the AdsPilot developer first connects an account.
Use the [intake contract](../contracts/intake.json). The JSON is task data,
not a form the owner must manually fill and not executable permission.

## 1. Discover and fill before asking

Read the task and existing grants. Discover actual tools, connected identity,
secret-reference facilities and supported authentication flows. Distinguish:

- an existing connector with a usable account;
- a host connector awaiting the owner's consent;
- authorized host HTTP/identity tools which can configure API access;
- a host missing the capability itself.

For an existing connector, the integration supplies its API app/access; do not
ask every user to create a Cloud project, MCC or developer token. Token custody
and Ads account permissions are different. Google explicitly assigns the app
developer responsibility for its developer token when users use a third-party
app. [Developer-token policy](https://developers.google.com/google-ads/api/docs/api-policy/developer-token)

If host tools can configure the chosen integration within an existing scoped
grant, prepare and perform those supported steps. Otherwise prepare a concrete
host capability request from the contract. Search host-native integrations if
that facility exists. Do not stop at "connector missing": still produce the
requirements, authorized setup plan, business draft and exact resumption check.
Do not silently install untrusted connectors, create grants, register apps or
change organization security as part of ordinary advertising authorization.

## 2. Select a supported authentication route

Prefer the user's existing route. A multi-user integration uses the host's
registered OAuth callback; the owner signs into Google and consents there.
Existing credential/connection references are reused, not copied into chat.
[OAuth scenarios](https://developers.google.com/google-ads/api/docs/oauth/overview),
[multi-user flow](https://developers.google.com/google-ads/api/docs/oauth/multi-user-authentication)

If owner-managed API setup is actually needed, the agent assembles a setup
packet: selected project, API enablement, supported OAuth client/callback or
service identity, API access owner, exact missing scopes, and submission status.
Create/change resources only through authorized host tools. The user sees the
smallest remaining owner actions, not a generic programmer installation guide.

A service-account path is optional and must be supported by the host. The
principal needs Google Ads account access; Cloud IAM alone is not that grant.
Use protected host credential import/signing, never ask for a private key in
chat. Do not create broad delegation as an automatic workaround.
[Service accounts](https://developers.google.com/google-ads/api/docs/oauth/service-accounts)

Developer-token access is the normal mode. The documented Cloud-managed access
pilot can omit that header only with verified participating project/organization
approval; it does not remove OAuth/account permissions. Never guess enrollment.
[Cloud-managed access](https://developers.google.com/google-ads/api/docs/concepts/no-developer-token)

Do not substitute an OOB code, a user-run localhost listener or a device-code
flow as a universal escape hatch. Google device authorization's listed scopes
do not include Ads `adwords`. A missing host OAuth callback is a host capability
gap to resolve, not an instruction to run a server on the owner's computer.
[Device-flow scopes](https://developers.google.com/identity/protocols/oauth2/limited-input-device#allowed-scopes)

## 3. Ask the owner only for remaining decisions

For research, ask for the product and desired audience only when missing.
For a campaign, additionally resolve geography, spending limit/period, requested
state and required declarations. Discover account currency/timezone; don't ask
the owner to guess them. Normalize a displayed CID's hyphens, then verify it.
If several accounts remain possible, ask which one; do not choose the first.

Show a short action card for a step only the owner can complete:

> **Need from you:** Select the advertising account and approve Google's
> connection screen. **Why:** Only you can grant access. **Where:** The host's
> verified Google connection link. **Afterward:** I will check the account and
> continue automatically; don't send me a password, code or token.

Generate real, observed links, never a fabricated consent URL. A missing
developer-access application gets a draft packet (actual entity/contact,
website or valid individual presence, use case, requested capabilities and
data-handling description), with unknown facts left for confirmation. The
agent may fill truthful authorized fields, but cannot invent legal/business
attestations or promise Google's approval. Track pending reviews explicitly.

## 4. Verify each capability separately

Check identity, client/MCC hierarchy, test/production type, account metadata,
access level, permissible use, scope and the requested method. Accessible
customer listing contains direct access, not automatically every managed child.
Traverse the verified manager hierarchy when needed; `login_customer_id` is an
access path, not a replacement for the target advertiser.
[Account listing](https://developers.google.com/google-ads/api/docs/account-management/listing-accounts)

Google Ads uses the `adwords` OAuth scope; do not invent a separate read-only
OAuth scope. Account roles and host-enforced operation permissions constrain
writes. Account access and spending authorization remain distinct.
[Access model](https://developers.google.com/google-ads/api/docs/oauth/access-model)

Test-only access is not production access. Explorer can access production but
has restricted planning and other services, so report access may work while
Keyword Ideas is unavailable. Basic/Standard also have permissible-use limits.
Use observed access, not a universal quota constant or "one read passed" flag.
[Access levels](https://developers.google.com/google-ads/api/docs/api-policy/access-levels)

Represent each requested capability as `ready`, `needs_owner`, `needs_host`,
`pending_provider`, `unsupported`, or `not_checked`, with evidence. No broad
`write_ready` from a list-accounts response. Live writes still need the exact
validation, scoped grant and durable claim in [records](records.md).

## 5. Repair and resume

Use [troubleshooting](troubleshooting.md) on a failed probe. Keep an onboarding
receipt: known facts/evidence, route, owner action cards, host/provider pending
items, completed work and next probe. Reload it after consent or a resumed
session and verify identity/scope again. Do not restart the questionnaire or
retry unchanged permission failures. Independent research continues while
external approval is pending.

```ilang
::STATE{@INTAKE, kind:conditional_intake, binding:owner_task}
::STATE{@CAPABILITIES, kind:host_observations, binding:actual_tools}
::STATE{@SETUP, kind:authorized_setup_plan, binding:host_tools}
::STATE{@RECEIPT, kind:onboarding_checkpoint, binding:host_records}
[LIST:@CAPABILITIES]=>[MTCH|src=@INTAKE]=>[PLAN:@SETUP]=>[CHEK|typ=authorization]=>[AUDT:@RECEIPT]=>[OUT]
```
