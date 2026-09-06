# Google Ads workflows

Use the host's authorized Google Ads tools. If using authenticated REST,
consult current official method schemas before constructing requests. The
baseline reviewed on 2026-09-06 is REST v25; v16 is sunset. The host injects
OAuth and developer tokens, with `login-customer-id` only when required.

Run [onboarding](onboarding.md) for conditional setup and per-capability access
checks. Developer-token injection applies to the normal access mode; a verified
Cloud-managed pilot uses its documented alternative. Do not require a user's
own API project/token when the chosen integration already supplies them.

On failure use [troubleshooting](troubleshooting.md). Check current schema and
structured provider error details, repair within scope, validate changed
requests again, and preserve the receipt. Do not defer every unfamiliar error
to the owner or turn a successful account read into a global readiness claim.

## Account and performance reads

List accessible customers, inspect the selected client (not merely its MCC),
and bind currency/timezone. Query current campaign status, budget, cost,
clicks, impressions, and conversions for the requested date range. Preserve
micros and account timezone when comparing periods; mark attribution lag and
missing data. Do not infer revenue from conversions without a verified value.

```ilang
::STATE{@ADS, kind:google_ads_connector, binding:verified_host_tool}
::STATE{@ACCOUNT, kind:selected_customer, binding:verified_user_scope}
[GET:@ADS|typ=accounts]=>[CHEK|src=@ACCOUNT]=>[GET:@ADS|typ=campaign_metrics]=>[AUDT|typ=data_quality]=>[OUT]
```

Useful read shape after tool-schema binding:

```text
POST https://googleads.googleapis.com/v25/customers/{customer_id}/googleAds:searchStream
query: SELECT campaign.resource_name, campaign.id, campaign.name,
       campaign.status, metrics.impressions, metrics.clicks,
       metrics.cost_micros, metrics.conversions
       FROM campaign WHERE segments.date DURING LAST_30_DAYS
```

This is a method outline, not a command to execute or a credential template.
Use the user's date range, selected client ID, and the tool's actual schema.

## Keyword research

Resolve language and geo-target resource names. Call GenerateKeywordIdeas
with explicit account, seed type, language, geographies, and search network.
Keep returned average monthly searches, competition, and bid ranges attached
to provider/time/targeting provenance. Distinguish no data from zero volume.
The method is `customers/{customer_id}:generateKeywordIdeas`.

If the host lacks this capability, analyze owner-provided CSV through the
host's data tools and label source/date/coverage. Qualitative brainstorming
is useful, but never fabricate Google search-volume or bid numbers.

## Paused Search campaign

Read [records](records.md) first. Establish the customer, currency, daily
budget, targeting, bidding strategy, landing page, ad text, and requested
status. Preserve unresolved product choices in the draft. Confirm any required
political-advertising declaration from the owner/context; never make that
attestation by default merely to satisfy a required field.

Construct typed operations in dependency order: budget, paused Search
campaign, targeting criteria, ad group, keyword criteria, responsive search
ad. Use unique temporary resource IDs only within a single multi-resource
request. Attach the correct budget and all resource names to the target
customer. Keep created campaigns paused until explicitly authorized to enable.

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

`RUN` here delegates to an observed provider tool after host enforcement; it
does not imply a shell, server, or permission grant. After approval and a
durable operation claim, submit the same validated plan with validation-only
disabled, then query returned resource names. Report a verified paused draft
campaign only when all required resources/fields exist in that customer.

## Optimization and safe resumption

Propose the smallest change supported by sufficient recent evidence. Explain
what metric should change and what would invalidate the hypothesis. A pause
and a budget increase have different effects and approval scopes. Use exact
resource names and update masks; never substitute the manager ID in a URL.

For timeout, partial failure, or interrupted batches, follow the reconciliation
rules in records.md. Continuous optimization requires an already available
host scheduler plus a durable policy and spend limits; do not start or promise
a daemon on the user's machine.

## Authoritative references

- [REST methods and request examples](https://developers.google.com/google-ads/api/rest/examples)
- [Search and SearchStream](https://developers.google.com/google-ads/api/rest/common/search)
- [Keyword ideas](https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas)
- [Multi-resource mutations](https://developers.google.com/google-ads/api/docs/mutating/overview)
- [Create campaigns and current required fields](https://developers.google.com/google-ads/api/docs/campaigns/create-campaigns)
- [API sunset dates](https://developers.google.com/google-ads/api/docs/sunset-dates)
