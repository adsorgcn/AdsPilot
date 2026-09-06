# Google Ads workflows

Use the host's authorized Google Ads tools. If using authenticated REST,
consult current official method schemas before constructing requests. The
baseline reviewed on 2026-09-07 is REST v25; v16 is sunset. The host injects
OAuth and developer tokens, with `login-customer-id` only when required.

Run [onboarding](onboarding.md) for conditional setup and per-capability access
checks. Developer-token injection applies to the normal access mode; a verified
Cloud-managed pilot uses its documented alternative. Do not require a user's
own API project/token when the chosen integration already supplies them.

On failure use [troubleshooting](troubleshooting.md). Check current schema and
structured provider error details, repair within scope, validate changed
requests again, and preserve the receipt. Do not defer every unfamiliar error
to the owner or turn a successful account read into a global readiness claim.

The data contract is [contracts/google-ads.json](../contracts/google-ads.json).
Its logical fields and symbolic operation references are AdsPilot domain data,
not Google request fields or callable tools. Bind them to the discovered
connector's schema and the current official method. The repository's pure
normalizer/policy tests are contributor checks; do not install or run them as a
user prerequisite, and do not mistake simulated decisions for provider evidence.

## Account and performance reads

`ListAccessibleCustomers` returns directly accessible resource names based on
the connected identity, not the entire descendant tree; that method does not
need a target CID and ignores a supplied login CID. Inspect each relevant
manager using `customer_client`, querying level zero/self and immediate children
and traversing child managers with a visited set. Preserve multiple observed
parent paths instead of inventing a unique tree. The task must bind an observed
non-manager client plus its currency and timezone. An indirect client needs an
observed manager access path; the client stays in the request's customer field,
while the selected manager is only the login context. Do not use a manager's
currency or an old account's approval for the selected client.

Read campaign resource/name/status, budget resource and amount, cost, clicks,
impressions and conversions for explicit inclusive dates in that client's
timezone. Keep the query/field mask and source mode (`live`, `test`, `cached`,
or explicitly `synthetic`) with the receipt. Preserve `cost_micros` and all
budget/bid micros as decimal integer strings. One currency unit is one million
micros even for JPY; 5,000 JPY is `5000000000`, not `5000`. Do exact decimal
arithmetic and display the currency, rather than coercing int64 values through
a floating-point number. Conversions can be fractional and are not revenue.

For `Search`, continue the same query through every `nextPageToken`; for
`SearchStream`, consume every response chunk and confirm the stream completed.
Save continuation state and query identity if interrupted. A missing response,
provider error, incomplete page chain and successful empty result are different
states. An omitted metric stays unknown/null unless the host proves the field
was selected and its documented protobuf default is applicable. Never replace
permission failures or unavailable keyword metrics with zero. Do not total
incomplete results, duplicate pages, segmented and aggregate rows together,
or mixed currencies/timezones. Mark conversion lag when interpreting recent
periods; if value data is requested, fetch it explicitly with its provenance.

```ilang
::STATE{@ADS, kind:google_ads_connector, binding:verified_host_tool}
::STATE{@ACCOUNT, kind:selected_customer, binding:verified_user_scope}
[GET:@ADS|typ=accounts]=>[CHEK|src=@ACCOUNT]=>[GET:@ADS|typ=campaign_metrics]=>[AUDT|typ=data_quality]=>[OUT]
```

Useful read shape after tool-schema binding:

```text
POST https://googleads.googleapis.com/v25/customers/{customer_id}/googleAds:searchStream
query: SELECT campaign.resource_name, campaign.id, campaign.name,
       campaign.status, campaign.campaign_budget, campaign_budget.amount_micros,
       metrics.impressions, metrics.clicks,
       metrics.cost_micros, metrics.conversions
       FROM campaign WHERE segments.date DURING LAST_30_DAYS
```

This is a method outline, not a command to execute or a credential template.
Use the user's date range, selected client ID, and the tool's actual schema.

## Keyword research

Resolve language and geo-target resource names from host/provider observations,
not guessed location numbers. Call `customers/{customer_id}:generateKeywordIdeas`
with the actual client, language, geographies, network, and exactly one
documented seed: `keywordSeed`, `urlSeed`, `keywordAndUrlSeed`, or `siteSeed`.
The targeted baseline requires explicit geographies; an intentionally worldwide
request is a different confirmed targeting choice, not a fallback for a failed
location lookup. Consume all result pages with the same request identity.

Keep text/close variants, average monthly searches, competition/index, low/high
top-of-page bid micros and monthly volume series attached to customer,
currency, language, geographies, network, seed, retrieval time and source.
The historical period remains the requested period or labelled provider default;
historical averages are not forecasts. Missing `keywordIdeaMetrics` is unknown,
while an observed numeric zero remains zero. Preserve structured access errors
for the recovery catalog; a successful reporting call does not establish
planning permission (for example, Explorer-level restrictions are separate).

If the host lacks this capability, analyze owner-provided CSV through the
host's data tools and label source/date/coverage. Qualitative brainstorming
is useful, but never fabricate Google search-volume or bid numbers.

## Paused Search campaign

Read [records](records.md) first. Establish the customer, currency, daily
budget, targeting, bidding strategy, landing page, ad text, and requested
status. Preserve unresolved product choices in the draft. Confirm any required
political-advertising declaration from the owner/context; never make that
attestation by default merely to satisfy a required field.

The v0.3 golden path is deliberately concrete: one new non-shared budget,
one paused Search campaign using explicitly selected Manual CPC, positive
location/language targeting, one ad group, explicit-match keywords, and a
responsive search ad. Other campaign/bidding types can be drafted but need
their own documented capability binding and validation; never silently replace
a user's chosen strategy just to fit this narrow path. AI may propose the bid,
match types and copy from available evidence; the exact proposed values belong
in the plan, not in an unexplained technical questionnaire.

| Domain operation | Required plan/readback fields and dependency |
| --- | --- |
| Budget | New name, exact amount micros, standard delivery, not shared |
| Campaign | Budget reference, Search channel, paused status, Manual CPC, network settings, geographic targeting mode and political declaration |
| Location criteria | Campaign reference and each resolved geo target, positive criteria |
| Language criteria | Campaign reference and each resolved language target |
| Ad group | Campaign reference, Search Standard type, paused status and exact CPC bid micros |
| Keyword criteria | Ad-group reference, text, explicit match type and status |
| Responsive search ad | Ad-group reference, paused status, final URLs, headlines and descriptions |

The narrow draft defaults to Google Search only with content expansion disabled
and positive geo targeting `PRESENCE`; these are AdsPilot proposal defaults, not
Google requirements. Preserve explicit owner choices instead of silently
expanding to partners or people merely interested in a location. Confirm the
political-ad declaration; it is not a boolean the AI may invent. Include at
least three distinct headlines and two descriptions (within the current
provider limits); validate length, language, policy, URL and field requirements
through the current schema/provider, not this count check alone. This baseline
uses HTTPS final URLs without embedded credentials.

Translate symbolic dependencies to unique temporary resource IDs in one
`GoogleAdsService.Mutate` request, creating referenced resources before use.
The host must retain the translation, ordered operations and exact request
digest. Temporary IDs have only request-local meaning; final criterion/ad
resource names include their compound parent/child IDs. All resources belong
to the selected client. If the actual connector only supports separate
requests, it cannot claim this atomic multi-resource path: use separately
validated/authorized durable stages or keep the combined plan as a draft.

Validate the exact request through provider `validateOnly: true`, normally
with `partialFailure: false` for a dependent creation batch. A successful
validation creates no resources. If the connector cannot request provider
validation, return a draft with `provider_validation: unavailable`; do not
silently bypass it.

```ilang
::STATE{@PLAN, kind:campaign_plan, binding:current_task}
::STATE{@ADS, kind:google_ads_connector, binding:verified_host_tool}
::STATE{@APPROVAL, kind:host_approval, binding:exact_plan_revision}
::STATE{@RESULT, kind:provider_evidence, binding:current_task}
[DRFT:@PLAN|typ=search_campaign]=>[VALD:@ADS|src=@PLAN]=>[CHEK:@APPROVAL|src=@PLAN]=>[RUN:@ADS|src=@PLAN]=>[GET:@RESULT]=>[AUDT|src=@PLAN]=>[OUT]
```

`RUN` delegates to an observed provider tool after host enforcement; it does
not imply a shell, server, or permission grant. Before submission, require
current host evidence of the exact client identity, successful provider
validation, scoped authorization and an atomically owned durable claim.
Bind plan ID/revision/content digest, translated request digest, customer,
currency/timezone, operation count and budget. A naked `owned: true` flag is
insufficient: the record belongs to the actual execution actor in the current
host session. A second Agent with the same conversation or host session must
not reuse somebody else's claim. Reuse a valid existing scope grant after the
host verifies its binding; do not repeatedly ask the owner for the same scope.

Submit the exact validated request with validation-only disabled, record the
operation-level results, then independently query every returned resource.
Read back the relevant normalized fields in the table, including dependency
edges, geography, budget and paused statuses, not just whether a campaign name
exists. Correlate reads to the submitted operation, request digest, actual
account/actor/session and time; reject a future timestamp, stale pre-submit
snapshot or foreign account. A resumed host must re-attest the current binding
and ownership before accepting old execution records. Complete only when all
requested objects match; report source mode, resource IDs, applied count and
remaining errors. Paused campaign/group/ad creation does not mean serving,
policy approval or permission to enable them later.

An average daily budget is not a hard daily/lifetime spending guarantee. State
the budget period and explain provider overdelivery. Any requested total cap
needs a separately specified host control; do not rename a daily amount as a
hard cap or promise that a periodic checker can enforce one perfectly.

## Optimization and safe resumption

Propose the smallest change supported by a complete same-account report,
owner-defined thresholds, sufficient samples and an appropriate attribution
window. Explain the hypothesis and what would disprove it. The narrow tested
policy supports a pause when the owner's sample/cost threshold is crossed with
zero observed conversions, or an explicitly requested amount for a verified
non-shared campaign budget. It does not invent a profitable threshold or
increase spend automatically because a report looks good.

For a pause, read the current campaign and use an exact `status` update mask.
For a budget change, verify the currently linked budget, non-shared status and
current amount, and use `amount_micros`; check the owner's explicit amount
limit. Shared budgets affect other campaigns, so the narrow single-campaign
flow cannot change them. Both changes remain proposals until a new revision,
exact provider validation, scope binding, owned claim and readback are present.
Current reads are not an atomic provider compare-and-swap guarantee: the host
must supply the required concurrency boundary or leave the change as a draft.

For timeout, partial failure, or interrupted batches, follow the reconciliation
rules in records.md. A create timeout retains `unknown_outcome` and its claim;
query returned IDs or a bounded multi-field reconciliation candidate set.
Names alone are not unique, and no match in one read is not proof the request
failed. Partial failure preserves each evidenced success and failure by plan
operation and customer; unknown keys, foreign IDs and duplicate results need
reconciliation. Never retry the whole batch or advertise automatic rollback.
Successful validate-only evidence is distinct from a validation error and
creates no objects. Continuous optimization requires an already available
host scheduler plus a durable policy and spend limits; do not start or promise
a daemon on the user's machine.

## Authoritative references

- [REST methods and request examples](https://developers.google.com/google-ads/api/rest/examples)
- [Search and SearchStream](https://developers.google.com/google-ads/api/rest/common/search)
- [Direct account access](https://developers.google.com/google-ads/api/docs/account-management/listing-accounts)
- [Account hierarchy](https://developers.google.com/google-ads/api/docs/account-management/get-account-hierarchy)
- [Keyword ideas](https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas)
- [Multi-resource mutations](https://developers.google.com/google-ads/api/docs/mutating/overview)
- [Create campaigns and current required fields](https://developers.google.com/google-ads/api/docs/campaigns/create-campaigns)
- [Responsive search ads](https://developers.google.com/google-ads/api/docs/responsive-search-ads/create-responsive-search-ads)
- [Location targeting](https://developers.google.com/google-ads/api/docs/targeting/location-targeting)
- [Partial failures](https://developers.google.com/google-ads/api/docs/best-practices/partial-failures)
- [Average daily budgets](https://support.google.com/google-ads/answer/6385083)
- [API sunset dates](https://developers.google.com/google-ads/api/docs/sunset-dates)
