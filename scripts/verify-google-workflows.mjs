// Developer-only reference evaluator. It performs no network or external writes.
// Inputs are synthetic or host-normalized observations, not a new Google API.
// Passing this policy model does not enforce permissions on an actual host.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const cid = value => typeof value === 'string' && /^\d{10}$/.test(value);
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const same = (a, b) => canonical(a) === canonical(b);
const fail = message => { throw new TypeError(message); };
const need = (condition, message) => { if (!condition) fail(message); };
const integer = value => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value);
const int64 = value => integer(value) && BigInt(value) <= 9223372036854775807n;
const calendarDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const precise = value => value === undefined || value === null ? null
  : typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value)
    : int64(value) ? value : fail('Expected a nonnegative exact integer');
const money = value => value === undefined || value === null ? null
  : int64(value) ? value : fail('Money micros must be a nonnegative int64 decimal string');
const scopeFields = ['plan_id', 'revision', 'plan_digest', 'customer_id', 'currency', 'timezone'];
const collections = { campaign_budget: 'campaignBudgets', campaign: 'campaigns', geo_criterion: 'campaignCriteria', language_criterion: 'campaignCriteria', ad_group: 'adGroups', keyword_criterion: 'adGroupCriteria', responsive_search_ad: 'adGroupAds' };

export function decimalToMicros(value) {
  need(typeof value === 'string' && /^(0|[1-9]\d*)(\.\d{1,6})?$/.test(value), 'Amount must be a decimal string with at most six fractional digits');
  const [whole, fraction = ''] = value.split('.');
  const result = (BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'))).toString();
  need(int64(result), 'Amount exceeds int64 micros');
  return result;
}

export function formatMicros(value) {
  money(value);
  need(value !== null && value !== undefined, 'Money is missing');
  const n = BigInt(value);
  return `${n / 1000000n}.${(n % 1000000n).toString().padStart(6, '0')}`;
}

function decimal(value) {
  if (value === undefined || value === null) return null;
  let text = String(value);
  need(/^(0|[1-9]\d*)(\.\d+)?(e[+-]?\d+)?$/i.test(text), 'Invalid nonnegative decimal metric');
  if (/e/i.test(text)) {
    const [coefficient, exp] = text.toLowerCase().split('e');
    const exponent = Number(exp);
    need(Number.isSafeInteger(exponent) && Math.abs(exponent) <= 308, 'Invalid decimal exponent');
    const dot = coefficient.includes('.') ? coefficient.indexOf('.') : coefficient.length;
    const digits = coefficient.replace('.', '');
    const position = dot + exponent;
    text = position <= 0 ? `0.${'0'.repeat(-position)}${digits}` : position >= digits.length ? digits.padEnd(position, '0') : `${digits.slice(0, position)}.${digits.slice(position)}`;
  }
  return text;
}

function sumDecimal(values) {
  if (values.some(value => value === null)) return null;
  const scale = Math.max(0, ...values.map(value => (value.split('.')[1] || '').length));
  const total = values.reduce((sum, value) => {
    const [whole, fraction = ''] = value.split('.');
    return sum + BigInt(whole + fraction.padEnd(scale, '0'));
  }, 0n).toString().padStart(scale + 1, '0');
  return scale ? `${total.slice(0, -scale)}.${total.slice(-scale)}` : total;
}

function observation(input) {
  need(input?.provenance === 'host_tool' && nonempty(input.request_ref), 'A host observation with request reference is required');
  need(['live', 'test', 'synthetic', 'cached'].includes(input.source_mode), 'Explicit source mode is required');
  need(Number.isFinite(Date.parse(input.observed_at)), 'Observation time is required');
}

function account(input) {
  need(cid(input.customer_id) && /^[A-Z]{3}$/.test(input.currency || '') && nonempty(input.timezone), 'Customer, currency and timezone are required');
  try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }); } catch { fail('Invalid account timezone'); }
}

export function validateGoogleContract(contract) {
  const errors = [];
  if (contract?.kind !== 'google-ads-workflow-contract' || contract.schema_version !== 1) errors.push('Unknown Google workflow contract');
  if (contract?.version !== '0.3.0' || contract.runtime_required !== false) errors.push('Expected instruction-only version 0.3.0');
  if (contract?.paused_search?.defaults?.status !== 'PAUSED' || contract?.paused_search?.defaults?.validate_only !== true || contract?.paused_search?.defaults?.partial_failure !== false) errors.push('Unsafe Search defaults');
  if (!same(contract?.paused_search?.operation_kinds, Object.keys(collections))) errors.push('Incomplete Search dependency kinds');
  if (contract?.campaign_report?.money_encoding !== 'decimal_integer_string_micros' || contract?.campaign_report?.missing_metric !== null) errors.push('Lossy report contract');
  if (!Array.isArray(contract?.sources) || contract.sources.length < 8 || contract.sources.some(url => !/^https:\/\/(developers|support)\.google\.com\//.test(url))) errors.push('Official Google sources required');
  if (contract?.recovery?.unknown_outcome !== 'retain_claim_and_reconcile_no_create_retry' || contract?.recovery?.partial_failure !== 'preserve_per_operation_results_no_whole_batch_retry') errors.push('Unsafe recovery contract');
  return { ok: errors.length === 0, errors };
}

export function normalizeCustomerHierarchy(input) {
  observation(input);
  if (input.error) return { state: 'blocked', error: input.error, request_ref: input.request_ref };
  need(Array.isArray(input.direct_customers) && Array.isArray(input.accounts), 'Direct customers and observed accounts are required');
  const roots = input.direct_customers.map(name => {
    need(/^customers\/\d{10}$/.test(name), 'Malformed direct customer resource');
    return name.split('/')[1];
  });
  const byId = new Map();
  for (const item of input.accounts) {
    need(cid(item.customer_id) && typeof item.manager === 'boolean' && Array.isArray(item.parent_ids), 'Invalid hierarchy observation');
    need(item.parent_ids.every(cid), 'Invalid manager ID');
    need(!byId.has(item.customer_id) || same(byId.get(item.customer_id), item), 'Conflicting customer observations');
    byId.set(item.customer_id, item);
  }
  const reached = new Set(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of byId.values()) {
      if (!reached.has(item.customer_id) && item.parent_ids.some(id => reached.has(id) && byId.get(id)?.manager === true)) {
        reached.add(item.customer_id); changed = true;
      }
    }
  }
  const selected = byId.get(input.selected_customer_id);
  if (!selected || !reached.has(input.selected_customer_id)) return { state: 'needs_target_evidence', clients: [...byId.values()].filter(item => reached.has(item.customer_id) && !item.manager) };
  need(!selected.manager, 'A manager is not a campaign target client');
  account(selected);
  const login = input.login_customer_id ?? null;
  if (login !== null) {
    need(cid(login) && reached.has(login) && byId.get(login)?.manager === true, 'Unverified login manager');
    const ancestors = new Set(selected.parent_ids);
    for (const id of ancestors) for (const parent of byId.get(id)?.parent_ids || []) ancestors.add(parent);
    need(ancestors.has(login), 'Login manager is not an observed ancestor of target');
  } else need(roots.includes(selected.customer_id), 'Indirect client requires a verified login manager');
  return { state: 'bound', customer_id: selected.customer_id, login_customer_id: login, currency: selected.currency, timezone: selected.timezone, request_ref: input.request_ref, source_mode: input.source_mode };
}

function pages(input) {
  if (!Array.isArray(input.pages)) return { state: 'missing', rows: [] };
  const rows = [];
  let complete = input.complete === true && input.pages.length > 0;
  for (let i = 0; i < input.pages.length; i++) {
    const page = input.pages[i];
    if (input.transport === 'search' && page.nextPageToken && input.pages[i + 1]?.request_page_token !== page.nextPageToken) complete = false;
    if (input.transport === 'search' && i > 0 && input.pages[i - 1]?.nextPageToken !== page.request_page_token) complete = false;
    // An omitted repeated field is empty only when the host verified protobuf defaults.
    if (!Array.isArray(page.results)) {
      if (page.results === undefined && input.protobuf_defaults_verified === true) continue;
      complete = false; continue;
    }
    rows.push(...page.results);
  }
  return { state: complete ? rows.length ? 'complete' : 'empty' : 'incomplete', rows };
}

export function normalizeCampaignReport(input) {
  observation(input); account(input);
  if (input.error) return { state: 'blocked', rows: [], totals: null, error: input.error, request_ref: input.request_ref };
  need(['search', 'search_stream'].includes(input.transport), 'Unknown reporting transport');
  need(calendarDate(input.date_from) && calendarDate(input.date_to) && input.date_from <= input.date_to, 'Explicit inclusive report dates required');
  need(input.grain === 'campaign_total', 'This normalizer accepts only unsegmented campaign totals');
  const result = pages(input);
  const seen = new Set();
  const rows = result.rows.map(row => {
    const c = row.campaign;
    need(new RegExp(`^customers/${input.customer_id}/campaigns/\\d+$`).test(c?.resourceName || ''), 'Campaign belongs to another customer or is malformed');
    need(c.id === undefined || precise(c.id) === c.resourceName.split('/').at(-1), 'Campaign ID disagrees with its resource name');
    need(!row.segments || Object.keys(row.segments).length === 0, 'Segmented rows cannot be added as campaign totals');
    need(!seen.has(c.resourceName), 'Duplicate campaign row or overlapping pages');
    seen.add(c.resourceName);
    const m = row.metrics || {};
    const budget = c.campaignBudget ?? null;
    if (budget) need(new RegExp(`^customers/${input.customer_id}/campaignBudgets/\\d+$`).test(budget), 'Budget belongs to another customer');
    return { resource_name: c.resourceName, id: precise(c.id), name: c.name ?? null, status: c.status ?? null, budget_resource_name: budget, budget_micros: money(row.campaignBudget?.amountMicros), impressions: precise(m.impressions), clicks: precise(m.clicks), cost_micros: money(m.costMicros), conversions: decimal(m.conversions) };
  });
  const aggregate = key => rows.some(row => row[key] === null) ? null : rows.reduce((sum, row) => sum + BigInt(row[key]), 0n).toString();
  const totals = ['complete', 'empty'].includes(result.state) ? { impressions: aggregate('impressions'), clicks: aggregate('clicks'), cost_micros: aggregate('cost_micros'), conversions: sumDecimal(rows.map(row => row.conversions)) } : null;
  return { state: result.state, customer_id: input.customer_id, currency: input.currency, timezone: input.timezone, date_from: input.date_from, date_to: input.date_to, rows, totals, provenance: { source_mode: input.source_mode, request_ref: input.request_ref, observed_at: input.observed_at, query_ref: input.query_ref ?? null }, warnings: ['Conversion attribution may be delayed; conversions are not revenue.'] };
}

export function normalizeKeywordIdeas(input) {
  observation(input); account(input);
  const request = input.request || {};
  need(request.customerId === input.customer_id && input.targeting_resolved === true, 'Keyword targeting must be resolved for selected customer');
  need(/^languageConstants\/\d+$/.test(request.language || ''), 'Resolved language resource required');
  need(Array.isArray(request.geoTargetConstants) && request.geoTargetConstants.length > 0 && request.geoTargetConstants.every(value => /^geoTargetConstants\/\d+$/.test(value)), 'Resolved geographies required for this targeted workflow');
  need(['GOOGLE_SEARCH', 'GOOGLE_SEARCH_AND_PARTNERS'].includes(request.keywordPlanNetwork), 'Explicit keyword network required');
  const seeds = ['keywordSeed', 'urlSeed', 'keywordAndUrlSeed', 'siteSeed'].filter(key => request[key] !== undefined);
  need(seeds.length === 1, 'Exactly one documented keyword seed is required');
  if (input.error) return { state: 'blocked', rows: [], error: input.error, request_ref: input.request_ref };
  const result = pages({ ...input, transport: 'search' });
  const rows = result.rows.map(row => {
    need(nonempty(row.text), 'Keyword text is missing');
    const metrics = row.keywordIdeaMetrics;
    const monthly = metrics?.monthlySearchVolumes;
    need(monthly === undefined || monthly === null || Array.isArray(monthly), 'Monthly search volumes must be a series');
    return { text: row.text, close_variants: row.closeVariants ?? [], avg_monthly_searches: precise(metrics?.avgMonthlySearches), competition: metrics?.competition ?? null, competition_index: precise(metrics?.competitionIndex), low_top_of_page_bid_micros: money(metrics?.lowTopOfPageBidMicros), high_top_of_page_bid_micros: money(metrics?.highTopOfPageBidMicros), monthly_search_volumes: monthly?.map(item => ({ year: precise(item.year), month: item.month ?? null, monthly_searches: precise(item.monthlySearches) })) ?? null };
  });
  return { state: result.state, rows, provenance: { customer_id: input.customer_id, currency: input.currency, language: request.language, geo_target_constants: request.geoTargetConstants, keyword_plan_network: request.keywordPlanNetwork, seed: { kind: seeds[0], value: request[seeds[0]] }, observed_at: input.observed_at, source_mode: input.source_mode, request_ref: input.request_ref, historical_period: input.historical_period ?? 'provider_default_not_a_forecast' } };
}

export function buildPausedSearchPlan(input) {
  account(input);
  need(input.login_customer_id === undefined || input.login_customer_id === null || cid(input.login_customer_id), 'Malformed login customer ID');
  need(nonempty(input.plan_id) && Number.isInteger(input.revision) && input.revision > 0, 'Plan identity/revision required');
  need(input.requested_status === undefined || input.requested_status === 'PAUSED', 'This narrow creation workflow only creates paused campaigns');
  need(input.bidding_strategy === 'MANUAL_CPC', 'Only explicitly selected Manual CPC is covered by this workflow');
  const budget = decimalToMicros(input.daily_budget);
  const bid = decimalToMicros(input.max_cpc);
  need(BigInt(budget) > 0n && BigInt(bid) > 0n, 'Positive budget and bid required');
  need(input.targeting_resolved === true, 'Resolve targeting before building operations');
  need(Array.isArray(input.geographies) && input.geographies.length > 0 && input.geographies.every(value => /^geoTargetConstants\/\d+$/.test(value)), 'Resolved geographies required');
  need(Array.isArray(input.languages) && input.languages.length > 0 && input.languages.every(value => /^languageConstants\/\d+$/.test(value)), 'Resolved languages required');
  need(new Set(input.geographies).size === input.geographies.length && new Set(input.languages).size === input.languages.length, 'Duplicate targeting');
  need(['GOOGLE_SEARCH', 'GOOGLE_SEARCH_AND_PARTNERS'].includes(input.network), 'Explicit Search network required');
  need(input.geo_target_type === undefined || ['PRESENCE', 'PRESENCE_OR_INTEREST'].includes(input.geo_target_type), 'Unsupported positive geographic targeting type');
  need(['CONTAINS_EU_POLITICAL_ADVERTISING', 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'].includes(input.political_declaration), 'Owner political advertising declaration required');
  let url;
  try { url = new URL(input.landing_page); } catch { fail('Valid final URL required'); }
  need(url.protocol === 'https:' && !url.username && !url.password, 'This narrow workflow requires an HTTPS final URL without credentials');
  need(Array.isArray(input.keywords) && input.keywords.length > 0 && input.keywords.every(item => nonempty(item.text) && ['EXACT', 'PHRASE', 'BROAD'].includes(item.match_type)), 'Explicit keyword text and match type required');
  for (const [key, minimum, maximum] of [['headlines', 3, 15], ['descriptions', 2, 4]]) need(Array.isArray(input[key]) && input[key].length >= minimum && input[key].length <= maximum && input[key].every(nonempty) && new Set(input[key]).size === input[key].length, `Distinct ${key} required`);
  const ops = [];
  const add = (kind, key, depends_on, fields) => ops.push({ key, kind, customer_id: input.customer_id, action: 'create', depends_on, fields });
  const label = `${input.plan_id}-r${input.revision}`;
  add('campaign_budget', 'budget', [], { name: `${label}-budget`, amount_micros: budget, explicitly_shared: false, delivery_method: 'STANDARD' });
  add('campaign', 'campaign', ['budget'], { name: label, status: 'PAUSED', advertising_channel_type: 'SEARCH', campaign_budget_ref: 'budget', bidding_strategy: 'MANUAL_CPC', target_google_search: true, target_search_network: input.network === 'GOOGLE_SEARCH_AND_PARTNERS', target_content_network: false, positive_geo_target_type: input.geo_target_type ?? 'PRESENCE', contains_eu_political_advertising: input.political_declaration });
  input.geographies.forEach((geo, i) => add('geo_criterion', `geo-${i}`, ['campaign'], { campaign_ref: 'campaign', geo_target_constant: geo, negative: false }));
  input.languages.forEach((language, i) => add('language_criterion', `language-${i}`, ['campaign'], { campaign_ref: 'campaign', language_constant: language, negative: false }));
  add('ad_group', 'ad-group', ['campaign'], { name: `${label}-group`, campaign_ref: 'campaign', status: 'PAUSED', type: 'SEARCH_STANDARD', cpc_bid_micros: bid });
  input.keywords.forEach((keyword, i) => add('keyword_criterion', `keyword-${i}`, ['ad-group'], { ad_group_ref: 'ad-group', status: 'ENABLED', text: keyword.text, match_type: keyword.match_type, negative: false }));
  add('responsive_search_ad', 'ad', ['ad-group'], { ad_group_ref: 'ad-group', status: 'PAUSED', final_urls: [url.href], headlines: [...input.headlines], descriptions: [...input.descriptions] });
  const plan = { plan_id: input.plan_id, revision: input.revision, customer_id: input.customer_id, login_customer_id: input.login_customer_id ?? null, currency: input.currency, timezone: input.timezone, daily_budget_micros: budget, requested_status: 'PAUSED', operation_count: ops.length, operations: ops, validate_only: true, partial_failure: false, state: 'draft' };
  plan.plan_digest = createHash('sha256').update(canonical(plan)).digest('hex');
  return plan;
}

function freshEvidence(item, now, age) {
  return item?.provenance === 'host_tool' && nonempty(item.tool_call_ref) && Number.isFinite(Date.parse(item.observed_at)) && Date.parse(item.observed_at) <= now && now - Date.parse(item.observed_at) <= age;
}

function planIntact(plan) {
  const { plan_digest, ...content } = plan;
  return plan_digest === createHash('sha256').update(canonical(content)).digest('hex');
}

export function assessSubmission(plan, evidence, { now = Date.now(), max_age_ms = 300000 } = {}) {
  const reasons = [];
  if (!planIntact(plan)) reasons.push('plan_digest_mismatch');
  if (plan.state !== 'draft' || plan.requested_status !== 'PAUSED') reasons.push('unsupported_plan');
  const bind = item => scopeFields.every(key => item?.[key] === plan[key]);
  for (const key of ['identity', 'validation', 'approval', 'claim', 'boundary']) if (!freshEvidence(evidence[key], now, max_age_ms)) reasons.push(`${key}_evidence_missing_or_stale`);
  const { identity, validation, approval, claim, boundary } = evidence;
  if (['identity', 'validation', 'approval', 'claim'].some(key => !nonempty(evidence[key]?.session_ref) || evidence[key].session_ref !== boundary?.session_ref)) reasons.push('host_session_mismatch');
  if (!nonempty(boundary?.execution_actor_ref) || ['identity', 'validation', 'approval', 'claim'].some(key => evidence[key]?.execution_actor_ref !== boundary.execution_actor_ref) || claim?.owner_ref !== boundary?.execution_actor_ref) reasons.push('execution_actor_or_claim_owner_mismatch');
  if (!identity || identity.customer_id !== plan.customer_id || identity.currency !== plan.currency || identity.timezone !== plan.timezone || identity.manager !== false || identity.login_customer_id !== plan.login_customer_id) reasons.push('identity_mismatch');
  if (!bind(validation) || validation?.ok !== true || validation?.validate_only !== true || validation?.partial_failure !== false || validation?.operation_count !== plan.operation_count || !nonempty(validation?.wire_digest) || validation?.validated_against_provider !== true || (validation?.errors?.length ?? 0) !== 0) reasons.push('exact_provider_validation_required');
  if (!bind(approval) || approval?.active !== true || approval?.operation !== 'create_paused_search' || approval?.wire_digest !== validation?.wire_digest || !int64(approval?.max_daily_budget_micros) || BigInt(approval.max_daily_budget_micros) < BigInt(plan.daily_budget_micros)) reasons.push('approval_scope_mismatch');
  if (!bind(claim) || claim?.owned !== true || claim?.state !== 'claimed' || !nonempty(claim?.operation_id) || claim?.wire_digest !== validation?.wire_digest || claim?.unresolved_previous_attempt === true) reasons.push('owned_fresh_claim_required');
  if (boundary?.enforced !== true || boundary?.input_isolation !== true || boundary?.durable_records !== true || boundary?.customer_id !== plan.customer_id || !nonempty(boundary?.session_ref)) reasons.push('host_enforcement_required');
  return { decision: reasons.length ? 'do_not_submit' : 'eligible_for_host_submission', reasons, creates_resources: false, plan_id: plan.plan_id, revision: plan.revision };
}

function resolveRefs(value, resources) {
  if (Array.isArray(value)) return value.map(item => resolveRefs(item, resources));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => key.endsWith('_ref') ? [key.slice(0, -4) + '_resource_name', resources[item]] : [key, resolveRefs(item, resources)]));
  return value;
}

function resourceMatches(plan, op, name) {
  const suffix = ['campaignCriteria', 'adGroupCriteria', 'adGroupAds'].includes(collections[op.kind]) ? '\\d+~\\d+' : '\\d+';
  return new RegExp(`^customers/${plan.customer_id}/${collections[op.kind]}/${suffix}$`).test(name || '');
}

export function reconcileMutation(plan, result, { now = Date.now(), max_age_ms = 300000 } = {}) {
  need(planIntact(plan), 'Plan changed after digest');
  if (result?.provenance !== 'host_tool' || !['live', 'test', 'synthetic'].includes(result.source_mode) || !['plan_id', 'revision', 'customer_id', 'plan_digest'].every(key => result[key] === plan[key]) || !nonempty(result.request_ref) || !nonempty(result.wire_digest)) return { state: 'unverified', next: 'obtain_matching_host_evidence', retry_create: false };
  if (result.validate_only === true) return result.outcome === 'validated' && result.validated_against_provider === true && result.operation_count === plan.operation_count && Array.isArray(result.errors) && result.errors.length === 0 && !result.error
    ? { state: 'validated', next: 'obtain_scope_and_claim', retry_create: false }
    : { state: 'unverified', next: 'inspect_provider_validation_failure', retry_create: false };
  if (result.outcome === 'timeout' || result.outcome === 'unknown') return { state: 'unknown_outcome', next: 'retain_claim_and_reconcile', retry_create: false };
  const receipt = result.submission_receipt;
  if (!freshEvidence(receipt, now, max_age_ms) || !scopeFields.every(key => receipt?.[key] === plan[key]) || ['wire_digest', 'operation_id', 'session_ref', 'execution_actor_ref'].some(key => !nonempty(result[key]) || receipt?.[key] !== result[key]) || receipt?.state !== 'submitted' || !Number.isFinite(Date.parse(result.submitted_at)) || Date.parse(result.submitted_at) > now) return { state: 'unverified', next: 'obtain_matching_submission_receipt', retry_create: false };
  if (result.outcome === 'partial_failure') {
    const applied = [], failed = [], invalid = [], seen = new Set();
    for (const item of result.operation_results || []) {
      const op = plan.operations.find(candidate => candidate.key === item.key);
      if (!op || seen.has(item.key) || item.customer_id !== plan.customer_id || !['applied', 'failed'].includes(item.status) || (item.status === 'applied' && !resourceMatches(plan, op, item.resource_name))) invalid.push(item.key ?? 'missing_key');
      else (item.status === 'applied' ? applied : failed).push(item);
      seen.add(item.key);
    }
    return { state: 'partial_failure', applied, failed, invalid, next: invalid.length ? 'obtain_matching_per_operation_evidence' : 'reconcile_each_operation_then_revalidate_unapplied_only', retry_create: false };
  }
  if (result.outcome !== 'applied' || result.validate_only !== false || result.error || (result.errors?.length ?? 0) > 0) return { state: 'unverified', next: 'inspect_provider_result', retry_create: false };
  const resources = {};
  const errors = [];
  const results = result.operation_results || [];
  if (results.length !== plan.operations.length) errors.push('incomplete_operation_results');
  for (const op of plan.operations) {
    const found = results.filter(item => item.key === op.key);
    const name = found[0]?.resource_name;
    if (found.length !== 1 || found[0]?.status !== 'applied' || found[0]?.customer_id !== plan.customer_id || !resourceMatches(plan, op, name)) errors.push(`resource_result:${op.key}`);
    else resources[op.key] = name;
  }
  if (new Set(Object.values(resources)).size !== Object.values(resources).length) errors.push('duplicate_created_resource');
  for (const op of plan.operations) {
    const readbacks = (result.readbacks || []).filter(item => item.resource_name === resources[op.key]);
    const read = readbacks[0];
    if (readbacks.length !== 1 || read?.provenance !== 'host_tool' || read?.customer_id !== plan.customer_id || !nonempty(read?.request_ref) || ['wire_digest', 'operation_id', 'session_ref', 'execution_actor_ref'].some(key => read?.[key] !== result[key]) || !Number.isFinite(Date.parse(read?.observed_at)) || Date.parse(read.observed_at) < Date.parse(result.submitted_at) || Date.parse(read.observed_at) > now || now - Date.parse(read.observed_at) > max_age_ms || !same(read?.fields, resolveRefs(op.fields, resources))) errors.push(`readback_mismatch:${op.key}`);
  }
  return { state: errors.length ? 'unverified' : 'verified', source_mode: result.source_mode ?? 'unspecified', applied_operation_count: Object.keys(resources).length, resources, errors, next: errors.length ? 'reconcile_fields_without_automatic_rollback' : 'report_verified_paused_resources', retry_create: false };
}

export function proposeOptimization(input) {
  const { report, policy, campaign } = input;
  if (report?.state !== 'complete' || !policy || !campaign || policy.customer_id !== report.customer_id || policy.currency !== report.currency || policy.timezone !== report.timezone || campaign.customer_id !== report.customer_id) return { decision: 'collect_evidence', reasons: ['incomplete_or_mismatched_scope'] };
  const row = report.rows.find(item => item.resource_name === campaign.resource_name);
  if (input.requested_change?.operation === 'set_non_shared_campaign_budget') {
    if (!row?.budget_resource_name || row.budget_resource_name !== campaign.budget_resource_name || campaign.budget_shared !== false || input.current_before_state_verified !== true || !int64(campaign.budget_micros) || row.budget_micros !== campaign.budget_micros) return { decision: 'collect_evidence', reasons: ['verified_non_shared_budget_required'] };
    const next = decimalToMicros(input.requested_change.amount_decimal);
    if (BigInt(next) === 0n || !int64(policy.max_daily_budget_micros) || BigInt(next) > BigInt(policy.max_daily_budget_micros)) return { decision: 'outside_scope', reasons: ['explicit_budget_limit_exceeded_or_missing'] };
    return { decision: 'propose', operation: 'set_non_shared_campaign_budget', resource_name: campaign.budget_resource_name, before: { amount_micros: campaign.budget_micros }, after: { amount_micros: next }, update_mask: ['amount_micros'], requires: ['new_plan_revision', 'exact_provider_validation', 'scoped_approval', 'owned_claim', 'readback'], executes: false };
  }
  if (!row || [row.cost_micros, row.clicks, row.conversions].includes(null) || !int64(policy.minimum_clicks) || !int64(policy.pause_cost_micros) || input.attribution_window_closed !== true || input.current_before_state_verified !== true) return { decision: 'collect_evidence', reasons: ['thresholds_sample_lag_or_current_state_missing'] };
  if (BigInt(row.clicks) < BigInt(policy.minimum_clicks)) return { decision: 'observe', reasons: ['sample_below_owner_threshold'] };
  if (campaign.status === 'ENABLED' && BigInt(row.cost_micros) >= BigInt(policy.pause_cost_micros) && /^0(?:\.0+)?$/.test(row.conversions)) return { decision: 'propose', operation: 'pause_campaign', resource_name: campaign.resource_name, before: { status: 'ENABLED' }, after: { status: 'PAUSED' }, update_mask: ['status'], requires: ['new_plan_revision', 'exact_provider_validation', 'scoped_approval', 'owned_claim', 'readback'], executes: false };
  return { decision: 'observe', reasons: ['owner_pause_threshold_not_met'] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const contract = JSON.parse(readFileSync(new URL('../skills/adspilot/contracts/google-ads.json', import.meta.url), 'utf8'));
  const result = validateGoogleContract(contract);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}
