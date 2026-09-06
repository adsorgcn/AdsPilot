// Developer-only reference transformations and policy tests. Never a provider
// client, live response, runtime dependency, or host-enforcement implementation.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const affiliateContractPath = fileURLToPath(new URL('../skills/adspilot/contracts/affiliate.json', import.meta.url));
const text = v => typeof v === 'string' && v.length > 0;
const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const key = (...v) => JSON.stringify(v);
const instant = v => text(v) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };

// Decimal strings are kept exact, including fractional commissions smaller than
// currency minor units. Display rounding belongs to a separate explicit policy.
export function decimal(value) {
  requireValue(typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value), 'Money must be a plain decimal string');
  const negative = value.startsWith('-');
  let [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  whole = whole.replace(/^0+(?=\d)/, '');
  fraction = fraction.replace(/0+$/, '');
  const nonzero = /[1-9]/.test(whole + fraction);
  return `${negative && nonzero ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}
export function addDecimals(...values) {
  const parts = values.map(v => decimal(v).split('.'));
  const scale = Math.max(0, ...parts.map(p => (p[1] || '').length));
  const total = parts.reduce((sum, [whole, fraction = '']) => {
    const negative = whole.startsWith('-');
    const units = BigInt(whole.replace('-', '') + fraction.padEnd(scale, '0'));
    return sum + (negative ? -units : units);
  }, 0n);
  const digits = (total < 0n ? -total : total).toString().padStart(scale + 1, '0');
  return decimal(`${total < 0n ? '-' : ''}${scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits}`);
}
const negative = v => decimal(v).startsWith('-');
const subtract = (a, b) => addDecimals(a, decimal(b) === '0' ? '0' : b.startsWith('-') ? b.slice(1) : `-${b}`);

export function validateAffiliateContract(contract) {
  const errors = [];
  const check = (test, message) => { if (!test) errors.push(message); };
  check(contract?.schema_version === 1 && contract?.kind === 'affiliate-feedback-contract', 'affiliate contract header');
  check(/^\d+\.\d+\.\d+$/.test(contract?.version || ''), 'affiliate contract version');
  check(contract?.execution === 'instruction_only_host_capabilities' && contract?.provider_schema === false, 'instruction-only normalized boundary');
  check(contract?.intake?.discover_first === true && contract?.intake?.secret_collection === 'host_secret_store_only', 'conditional intake boundary');
  for (const field of ['commission_id', 'original_action_id', 'publisher_id', 'advertiser_id', 'action_id', 'event_at', 'posted_at', 'commission', 'sale', 'tracking_token']) check(text(contract?.cj_publisher_commission_binding?.fields?.[field]), `missing mapping ${field}`);
  check(contract?.imports?.correction_model === 'add_distinct_commission_delta_records', 'CJ correction deltas');
  check(contract?.imports?.query_max_days === 31, 'CJ query window');
  check(contract?.imports?.decimal_model === 'arbitrary_precision_decimal_strings_no_implicit_rounding_or_fx', 'exact monetary accounting');
  check(contract?.tracking?.network_sid_is_not_google_click_id === true, 'tracking ID separation');
  check(contract?.conversion_routes?.data_manager?.developer_token_required === false, 'Data Manager token separation');
  check(contract?.conversion_routes?.data_manager?.failure_model === 'request_fast_fail_then_asynchronous_destination_diagnostics', 'Data Manager result lifecycle');
  check(contract?.conversion_routes?.adjustment?.restatement === 'new_absolute_total_not_delta', 'adjustment value semantics');
  check(contract?.conversion_routes?.adjustment?.wbraid_supported === false, 'adjustment identifier support');
  check(contract?.receipt_states?.includes('submitted_unknown') && contract?.receipt_states?.includes('accepted_pending_diagnostics'), 'honest receipt states');
  check(Array.isArray(contract?.sources) && contract.sources.length >= 7 && contract.sources.every(s => /^https:\/\/(docs\.cj\.com|developers\.google\.com)\//.test(s)), 'official contract sources');
  return { ok: errors.length === 0, errors, scope: 'offline_affiliate_reference_policy_not_live_integration' };
}

export function affiliateMissingInputs(contract, known = {}, required = []) {
  return required.filter(field => !(field in known) || known[field] === null || known[field] === '')
    .map(field => ({ field, actor: field in contract.intake.owner_fields ? 'owner' : 'host', prompt: contract.intake.owner_fields[field] || `Discover or bind ${field}; do not ask for plaintext credentials.` }));
}

export function selectOffer(offer, request, now) {
  const reasons = [];
  if (offer.relationship !== 'joined') reasons.push('relationship_not_joined');
  if (!offer.terms?.evidence_ref || !instant(offer.terms.valid_until) || Date.parse(offer.terms.valid_until) < Date.parse(now)) reasons.push('current_terms_missing');
  if (offer.terms?.paid_search !== true) reasons.push('paid_search_not_allowed');
  if (request.brand_bidding && offer.terms?.brand_bidding !== true) reasons.push('brand_bidding_not_allowed');
  if (request.direct_linking && offer.terms?.direct_linking !== true) reasons.push('direct_linking_not_allowed');
  if (!offer.terms?.countries?.includes(request.country)) reasons.push('country_not_allowed');
  return { eligible: reasons.length === 0, reasons, offer_id: offer.offer_id, advertiser_id: offer.advertiser_id };
}

export function bindTrackingLink(offer, link, mapping) {
  const reasons = [];
  if (!link?.network_issued || !link?.evidence_ref || !/^https:\/\//.test(link?.url || '')) reasons.push('network_link_evidence_missing');
  for (const field of ['publisher_id', 'property_id', 'advertiser_id']) if (!offer[field] || offer[field] !== link?.[field] || offer[field] !== mapping?.[field]) reasons.push(`${field}_mismatch`);
  if (link?.destination !== offer.destination) reasons.push('destination_mismatch');
  if (mapping?.durable !== true || !mapping?.mapping_ref) reasons.push('durable_mapping_unavailable');
  if (!/^[A-Za-z0-9_-]{12,80}$/.test(mapping?.tracking_token || '') || mapping.tracking_token !== link?.tracking_token || !link?.sub_id_format_verified) reasons.push('opaque_tracking_token_unverified');
  return { status: reasons.length ? 'untracked_link_draft' : 'tracked_link_bound', attribution_available: reasons.length === 0, reasons, link_url: link?.url, mapping_ref: reasons.length ? null : mapping.mapping_ref };
}

export function normalizeCommissionPage(envelope, binding) {
  requireValue(binding?.schema_verified === true && text(binding?.schema_ref), 'Discover and verify the publisher schema before mapping');
  requireValue(binding.amount_semantics === 'delta' && /^[A-Z]{3}$/.test(binding.currency || ''), 'Verified delta semantics and explicit currency are required');
  requireValue(instant(envelope.observed_at), 'Host observation time required');
  requireValue(text(envelope.source_ref), 'Source evidence reference required');
  const page = envelope?.data?.publisherCommissions;
  requireValue(!envelope.errors?.length && page && Array.isArray(page.records), 'GraphQL errors or missing commission envelope');
  requireValue(page.count === page.records.length && typeof page.payloadComplete === 'boolean', 'Page count/completeness missing or inconsistent');
  requireValue(instant(envelope.window?.from) && instant(envelope.window?.to), 'Explicit posting window required');
  const span = Date.parse(envelope.window.to) - Date.parse(envelope.window.from);
  requireValue(span > 0 && span <= 31 * 86400000, 'CJ query window must be greater than zero and at most 31 days');
  const f = binding.fields;
  const records = page.records.map(row => {
    const out = Object.fromEntries(Object.entries(f).map(([target, source]) => [target, row[source] ?? null]));
    for (const field of ['commission_id', 'original_action_id', 'publisher_id', 'advertiser_id', 'action_id', 'action_type']) requireValue(text(out[field]), `Missing identity ${field}`);
    requireValue(out.publisher_id === binding.publisher_id, 'Publisher scope mismatch');
    requireValue(typeof out.original === 'boolean', 'Original/correction flag must be a boolean');
    requireValue(instant(out.event_at) && instant(out.posted_at), 'Event/posting timestamps need explicit timezone');
    requireValue(Date.parse(out.posted_at) >= Date.parse(envelope.window.from) && Date.parse(out.posted_at) < Date.parse(envelope.window.to), 'Record outside requested posting window');
    out.commission = decimal(out.commission);
    out.sale = out.sale === null ? null : decimal(out.sale);
    return { ...out, network: 'CJ', currency: binding.currency, observed_at: envelope.observed_at, source_ref: envelope.source_ref, schema_ref: binding.schema_ref };
  });
  if (!page.payloadComplete) requireValue(text(page.maxCommissionId) && page.maxCommissionId !== envelope.cursor, 'Incomplete page requires advancing cursor');
  return { records, complete: page.payloadComplete, next_cursor: page.maxCommissionId || null, cursor: envelope.cursor || null, window: envelope.window, observed_at: envelope.observed_at, source_ref: envelope.source_ref };
}

export function reconcileCommissions(pages, { mappings = [], previous = null } = {}) {
  requireValue(pages.length > 0, 'At least one complete or checkpointable page is required');
  const ledger = new Map((previous?.ledger || []).map(r => [key(r.network, r.publisher_id, r.commission_id), r]));
  const quarantined = [...(previous?.quarantined || [])];
  let duplicates = 0, revisions = 0, expected = previous?.checkpoint?.complete === false ? previous.checkpoint.cursor : null;
  const window = pages[0].window;
  if (previous?.checkpoint?.complete === false) requireValue(JSON.stringify(window) === JSON.stringify(previous.checkpoint.window), 'Resume must retain the unfinished window');
  let complete = false;
  for (const page of pages) {
    requireValue(!complete && JSON.stringify(page.window) === JSON.stringify(window) && page.cursor === expected, 'Page sequence/window gap');
    for (const row of page.records) {
      const id = key(row.network, row.publisher_id, row.commission_id);
      const old = ledger.get(id);
      const financial = r => [r.order_id, r.original_action_id, r.original, r.advertiser_id, r.action_id, r.action_type, r.event_at, r.posted_at, r.commission, r.sale, r.currency, r.tracking_token, r.property_id];
      if (old && digest(financial(old)) !== digest(financial(row))) {
        quarantined.push({ commission_key: id, order_key: key(row.network, row.publisher_id, row.advertiser_id, row.action_id, row.original_action_id), reason: 'same_id_conflicting_financial_snapshot', source_ref: row.source_ref });
        continue;
      }
      if (old && old.status === row.status && old.validation_status === row.validation_status) { duplicates++; continue; }
      if (old && Date.parse(row.observed_at) <= Date.parse(old.observed_at)) { duplicates++; continue; }
      if (old) revisions++;
      ledger.set(id, row);
    }
    complete = page.complete;
    expected = page.next_cursor;
  }
  const grouped = new Map();
  for (const row of ledger.values()) {
    const id = key(row.network, row.publisher_id, row.advertiser_id, row.action_id, row.original_action_id);
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(row);
  }
  const orders = [...grouped.entries()].map(([order_key, records]) => {
    const first = records.find(r => r.original) || records[0];
    const reasons = [];
    if (!records.some(r => r.original)) reasons.push('original_record_missing');
    for (const f of ['currency', 'order_id', 'tracking_token', 'property_id', 'event_at']) if (new Set(records.map(r => r[f])).size !== 1) reasons.push(`${f}_conflict`);
    if (!first.order_id) reasons.push('order_id_missing');
    if (quarantined.some(q => q.order_key === order_key)) reasons.push('conflicting_snapshot');
    const candidates = mappings.filter(m => ['network', 'publisher_id', 'property_id', 'advertiser_id', 'tracking_token'].every(f => m[f] && m[f] === first[f]));
    if (candidates.length !== 1) reasons.push(candidates.length ? 'ambiguous_tracking' : 'unmatched_tracking');
    if (!complete) reasons.push('import_incomplete');
    if (records.some(r => !['locked', 'closed'].includes(r.status))) reasons.push('commission_pending');
    // Account for known values exactly even when attribution is quarantined.
    // Never add unlike currencies into a single total.
    const currencies = [...new Set(records.map(r => r.currency))];
    const commission_by_currency = Object.fromEntries(currencies.map(c => [c, addDecimals(...records.filter(r => r.currency === c).map(r => r.commission))]));
    const sale_by_currency = Object.fromEntries(currencies.map(c => [c, records.filter(r => r.currency === c).some(r => r.sale === null) ? null : addDecimals(...records.filter(r => r.currency === c).map(r => r.sale))]));
    return { order_key, network: first.network, publisher_id: first.publisher_id, advertiser_id: first.advertiser_id, action_id: first.action_id, order_id: first.order_id, original_action_id: first.original_action_id, event_at: first.event_at, currency: currencies.length === 1 ? first.currency : null, commission: currencies.length === 1 ? commission_by_currency[first.currency] : null, sale: currencies.length === 1 ? sale_by_currency[first.currency] : null, commission_by_currency, sale_by_currency, records, mapping_ref: candidates.length === 1 ? candidates[0].mapping_ref : null, customer_id: candidates.length === 1 ? candidates[0].customer_id : null, campaign_id: candidates.length === 1 ? candidates[0].campaign_id : null, reasons, eligible: reasons.length === 0, revision: digest(records.map(r => [r.commission_id, r.commission, r.sale, r.status, r.validation_status]).sort()) };
  });
  const currencies = [...new Set([...ledger.values()].map(r => r.currency))];
  const totals = Object.fromEntries(currencies.map(currency => [currency, { commission: addDecimals(...[...ledger.values()].filter(r => r.currency === currency).map(r => r.commission)), sale: [...ledger.values()].filter(r => r.currency === currency).some(r => r.sale === null) ? null : addDecimals(...[...ledger.values()].filter(r => r.currency === currency).map(r => r.sale)) }]));
  return { ledger: [...ledger.values()], orders, totals, duplicates, revisions, quarantined, checkpoint: { window, complete, cursor: complete ? null : expected, watermark: complete ? window.to : previous?.checkpoint?.watermark || null }, live_provider_evidence: false };
}

export function nextImportWindow(checkpoint, { until, overlap_ms }) {
  requireValue(instant(until) && Number.isSafeInteger(overlap_ms) && overlap_ms >= 0, 'Explicit until and overlap required');
  if (checkpoint.complete === false) return { ...checkpoint.window, cursor: checkpoint.cursor, resumed: true };
  requireValue(instant(checkpoint.watermark), 'Completed watermark required');
  const from = new Date(Date.parse(checkpoint.watermark) - overlap_ms).toISOString();
  const to = new Date(Math.min(Date.parse(until), Date.parse(from) + 31 * 86400000)).toISOString();
  requireValue(Date.parse(from) < Date.parse(to), 'Nonempty next window required');
  return { from, to, cursor: null, resumed: false };
}

export function buildConversionDraft(order, { mapping, action, policy, receipt = null, now } = {}) {
  const reasons = [...(order.reasons || [])];
  if (order.eligible !== true) reasons.push('reconciliation_not_eligible');
  if (!mapping?.durable || mapping.mapping_ref !== order.mapping_ref || !mapping.source_ref || !mapping.click_ref) reasons.push('durable_click_source_missing');
  if (!mapping?.upload_allowed || !mapping?.consent_ref || mapping?.consent_status !== 'GRANTED') reasons.push('source_or_consent_not_permitted');
  if (!['gclid', 'gbraid', 'wbraid'].includes(mapping?.click_type)) reasons.push('unsupported_click_path');
  if (!action?.evidence_ref || action.status !== 'ENABLED' || action.type !== 'UPLOAD_CLICKS' || mapping?.conversion_customer_id !== action.owner_customer_id || !action.serving_customer_ids?.includes(mapping?.customer_id)) reasons.push('conversion_action_owner_or_type');
  if (!policy?.approved_ref || !['sale_revenue', 'affiliate_commission'].includes(policy.value_semantics) || policy.value_semantics !== action?.value_semantics) reasons.push('value_semantics_unapproved');
  if (!policy?.source_evidence_ref || policy?.authoritative_values !== true) reasons.push('authoritative_value_semantics_missing');
  if (!Array.isArray(policy?.eligible_action_types) || order.records.some(r => !policy.eligible_action_types.includes(r.action_type)) || (policy.value_semantics === 'sale_revenue' && order.records.some(r => !['sim_sale', 'item_sale'].includes(r.action_type)))) reasons.push('event_type_not_eligible');
  const value = policy?.value_semantics === 'affiliate_commission' ? order.commission : order.sale;
  if (value === null || value === undefined || !order.currency) reasons.push('money_or_currency_unavailable');
  if (!instant(now) || !instant(order.event_at) || !instant(mapping?.click_at) || Date.parse(mapping.click_at) > Date.parse(order.event_at) || Date.parse(order.event_at) > Date.parse(now)) reasons.push('invalid_event_or_click_time');
  if (!Number.isFinite(policy?.upload_window_days) || !policy?.window_evidence_ref) reasons.push('upload_window_unverified');
  else if (Date.parse(now) - Date.parse(mapping?.click_at) > policy.upload_window_days * 86400000) reasons.push('late_outside_upload_window');
  let route = policy?.route || 'data_manager';
  if (!['data_manager', 'google_ads_legacy'].includes(route) || !policy?.route_evidence_ref) reasons.push('conversion_route_unverified');
  if (route === 'google_ads_legacy' && policy?.legacy_upload_eligible !== true) reasons.push('legacy_upload_restricted_use_data_manager');
  const destination_key = key(action?.owner_customer_id, action?.id, order.order_key);
  if (receipt && receipt.destination_key !== destination_key) reasons.push('receipt_destination_mismatch');
  if (receipt && ['submitted_unknown', 'accepted_pending_diagnostics'].includes(receipt.state)) return { state: 'reconcile_existing_upload', reasons: [...new Set(reasons)], destination_key, retry_allowed: false, provider_payload: null };
  let operation = 'upload';
  if (receipt?.state === 'confirmed') {
    if (reasons.length) return { state: 'held', reasons: [...new Set(reasons)], destination_key, retry_allowed: false, provider_payload: null };
    if (receipt.order_revision === order.revision) return { state: 'already_confirmed', destination_key, retry_allowed: false, provider_payload: null };
    if (receipt.value === value && receipt.currency === order.currency) return { state: 'no_value_change', destination_key, retry_allowed: false, provider_payload: null };
    operation = value === '0' ? 'retract' : 'restate';
    if (mapping?.click_type === 'wbraid' || !policy?.adjustment_supported || !policy?.adjustment_evidence_ref) reasons.push('adjustment_path_not_supported');
    if (!Number.isFinite(policy?.adjustment_window_days) || Date.parse(now) - Date.parse(order.event_at) > policy.adjustment_window_days * 86400000) reasons.push('adjustment_window_unavailable_or_expired');
    if (receipt.currency !== order.currency) reasons.push('adjustment_currency_change');
    if (operation === 'retract' && policy?.cancellation_confirmed !== true) reasons.push('zero_value_not_confirmed_cancellation');
    route = 'google_ads_adjustment';
  } else if (receipt && receipt.state !== 'rejected_unapplied') reasons.push('existing_receipt_not_resolved');
  if (value !== null && value !== undefined && negative(value)) reasons.push('negative_net_value_requires_review');
  if (operation === 'upload' && value === '0') reasons.push('zero_net_order_no_new_conversion');
  if (reasons.length) return { state: 'held', reasons: [...new Set(reasons)], destination_key, retry_allowed: false, provider_payload: null };
  const normalized = { destination_key, order_key: order.order_key, mapping_ref: mapping.mapping_ref, campaign_id: mapping.campaign_id, owner_customer_id: action.owner_customer_id, serving_customer_id: mapping.customer_id, conversion_action_id: action.id, order_id: order.order_id, order_revision: order.revision, previous_receipt_fingerprint: receipt ? receiptFingerprint(receipt) : null, transaction_id: digest(destination_key), value, currency: order.currency, value_semantics: policy.value_semantics, event_at: order.event_at, adjustment_at: operation === 'upload' ? null : now, click_type: mapping.click_type, click_ref: mapping.click_ref, consent_ref: mapping.consent_ref, source_ref: mapping.source_ref, event_source: mapping.event_source, route, operation };
  if (!['WEB', 'APP', 'IN_STORE', 'PHONE', 'OTHER'].includes(normalized.event_source)) return { state: 'held', reasons: ['event_source_missing'], destination_key, retry_allowed: false, provider_payload: null };
  return { state: 'draft', normalized, plan_fingerprint: digest(normalized), destination_key, operation, route, retry_allowed: false, provider_payload: null, next: 'bind_discovered_schema_validate_exact_payload_and_reuse_or_request_scoped_authority_then_owned_claim' };
}

// Input responses are observations supplied by a host adapter, never invented
// Google fields. Data Manager and Ads batch semantics remain intentionally distinct.
export const uploadBatchFingerprint = drafts => digest(drafts.map(d => [d.destination_key, d.plan_fingerprint]));
const receiptFingerprint = r => digest([r.destination_key, r.order_revision, r.plan_fingerprint, r.value, r.currency, r.state]);
export function applyUploadResults(drafts, observation, previous = [], requestContext = null) {
  const ledger = new Map(previous.map(r => [r.destination_key, r]));
  requireValue(drafts.every(d => d.state === 'draft'), 'Only validated draft-shaped records can be modelled');
  const synthetic = observation?.mode === 'synthetic';
  requireValue(synthetic || (observation?.provenance === 'host_tool' && text(observation.tool_call_ref)), 'Trusted host observation or explicit synthetic mode required');
  const routes = new Set(drafts.map(d => d.route));
  requireValue(routes.size === 1 && routes.has(observation.route), 'Response route does not match batch');
  const correlated = observation.batch_fingerprint === uploadBatchFingerprint(drafts) && text(observation.request_binding_ref) && (synthetic || (requestContext?.request_binding_ref === observation.request_binding_ref && requestContext?.batch_fingerprint === observation.batch_fingerprint));
  if (observation.item_results) requireValue(new Set(observation.item_results.map(r => r.index)).size === observation.item_results.length && observation.item_results.every(r => Number.isInteger(r.index) && r.index >= 0 && r.index < drafts.length), 'Item result indices must be unique and in range');
  for (const [index, draft] of drafts.entries()) {
    const prior = ledger.get(draft.destination_key);
    if (prior?.state === 'confirmed' && prior.order_revision === draft.normalized.order_revision) continue;
    if (prior && ['confirmed', 'submitted_unknown', 'accepted_pending_diagnostics'].includes(prior.state) && prior.plan_fingerprint !== draft.plan_fingerprint && draft.normalized.previous_receipt_fingerprint !== receiptFingerprint(prior)) continue;
    let state = 'submitted_unknown', evidence_ref = observation.evidence_ref || null;
    if (!correlated) { /* Never apply a stale/unbound batch response. */ }
    else if (observation.validate_only === true) state = 'validated';
    else if (observation.route === 'data_manager') {
      if (observation.required_field_failure === true && observation.response_received === true) state = 'rejected_unapplied';
      else if (observation.request_id && observation.response_received === true) state = 'accepted_pending_diagnostics';
      // Batch diagnostics without item correlation cannot certify every item.
      const item = observation.item_results?.find(r => r.index === index);
      if (state === 'accepted_pending_diagnostics' && item?.diagnostics_final && item?.destination_key === draft.destination_key && item?.plan_fingerprint === draft.plan_fingerprint && item?.owner_customer_id === draft.normalized.owner_customer_id && item?.conversion_action_id === draft.normalized.conversion_action_id && item?.evidence_ref) {
        state = item.accepted === true ? 'confirmed' : item.accepted === false ? 'rejected_unapplied' : state;
        evidence_ref = item.evidence_ref;
      }
    } else {
      const item = observation.item_results?.find(r => r.index === index);
      if (item?.destination_key === draft.destination_key && item?.plan_fingerprint === draft.plan_fingerprint && item?.owner_customer_id === draft.normalized.owner_customer_id && item?.conversion_action_id === draft.normalized.conversion_action_id && item?.evidence_ref) {
        state = item.accepted === true ? 'confirmed' : item.accepted === false && item.unapplied === true ? 'rejected_unapplied' : state;
        evidence_ref = item.evidence_ref;
      }
    }
    ledger.set(draft.destination_key, { destination_key: draft.destination_key, order_key: draft.normalized.order_key, mapping_ref: draft.normalized.mapping_ref, serving_customer_id: draft.normalized.serving_customer_id, owner_customer_id: draft.normalized.owner_customer_id, conversion_action_id: draft.normalized.conversion_action_id, campaign_id: draft.normalized.campaign_id, order_revision: draft.normalized.order_revision, plan_fingerprint: draft.plan_fingerprint, transaction_id: draft.normalized.transaction_id, value: draft.normalized.value, value_semantics: draft.normalized.value_semantics, currency: draft.normalized.currency, route: draft.route, operation: draft.operation, state, request_id: correlated ? observation.request_id || null : null, evidence_ref: correlated ? evidence_ref : null, warnings: correlated ? observation.field_warnings || [] : [], warning_review_ref: observation.warning_review_ref || null, synthetic, attribution_confirmed: false, retry_allowed: state === 'rejected_unapplied' ? 'only_after_revalidation_and_authority_check' : false });
  }
  return [...ledger.values()];
}

export function recommendOptimization(reconciliation, { currency, spend, spend_evidence_ref, spend_scope, window_complete, min_confirmed_orders = 3, receipts = [] }) {
  const reasons = [];
  if (!reconciliation.checkpoint.complete || !window_complete) reasons.push('incomplete_observation_window');
  if (reconciliation.orders.some(o => !o.eligible)) reasons.push('unresolved_attribution_or_pending_orders');
  if (!spend_evidence_ref || reconciliation.totals[currency]?.commission === undefined) reasons.push('comparable_cost_or_currency_missing');
  const current = receipts.filter(r => r.state === 'confirmed' && r.evidence_ref && (!r.warnings?.length || r.warning_review_ref) && r.currency === currency && r.value_semantics === 'affiliate_commission' && r.serving_customer_id === spend_scope?.customer_id && spend_scope?.campaign_ids?.includes(r.campaign_id) && reconciliation.orders.some(o => o.eligible && o.order_key === r.order_key && o.revision === r.order_revision && o.currency === r.currency && o.commission === r.value && o.mapping_ref === r.mapping_ref));
  const confirmed = new Set(current.map(r => r.order_key)).size;
  const scopeMatched = spend_scope?.cohort_verified === true && spend_scope.from === reconciliation.checkpoint.window.from && spend_scope.to === reconciliation.checkpoint.window.to && reconciliation.orders.every(o => o.eligible && o.currency === currency && o.customer_id === spend_scope.customer_id && spend_scope.campaign_ids.includes(o.campaign_id) && Date.parse(o.event_at) >= Date.parse(spend_scope.from) && Date.parse(o.event_at) < Date.parse(spend_scope.to));
  if (!scopeMatched || confirmed < reconciliation.orders.filter(o => o.eligible).length) reasons.push('cost_and_commission_scope_not_reconciled');
  if (confirmed < min_confirmed_orders) reasons.push('sample_below_declared_threshold');
  const net = scopeMatched && reconciliation.totals[currency]?.commission !== undefined && spend_evidence_ref ? subtract(reconciliation.totals[currency].commission, decimal(spend)) : null;
  return { state: 'recommendation_only', recommendation: reasons.length ? 'hold_and_collect_evidence' : negative(net) ? 'review_reduce_or_pause' : 'review_bounded_experiment', reasons, currency, affiliate_commission: reconciliation.totals[currency]?.commission || null, spend: decimal(spend), net_before_other_costs: net, confirmed_receipts: confirmed, automatic_mutation: false, synthetic: receipts.some(r => r.synthetic), note: 'Commission minus matched-window ad cost is not merchant revenue, causal lift, or guaranteed profit.' };
}

export function runAffiliateScenario(scenario, contract) {
  requireValue(scenario.synthetic === true, 'Offline scenario must explicitly identify synthetic data');
  const binding = { ...contract.cj_publisher_commission_binding, ...scenario.binding };
  const offer = selectOffer(scenario.offer, scenario.request, scenario.now);
  const tracking = bindTrackingLink(scenario.offer, scenario.link, scenario.mappings[0]);
  const pages = scenario.pages.map(page => normalizeCommissionPage(page, binding));
  const reconciliation = reconcileCommissions(pages, { mappings: scenario.mappings });
  const drafts = reconciliation.orders.map(order => offer.eligible && tracking.attribution_available ? buildConversionDraft(order, { mapping: scenario.mappings.find(m => m.mapping_ref === order.mapping_ref), action: scenario.action, policy: scenario.policy, now: scenario.now }) : ({ state: 'held', reasons: ['offer_or_tracking_not_eligible'], provider_payload: null }));
  const eligible = drafts.filter(d => d.state === 'draft');
  // This fixture marker explicitly generates a simulated host batch binding,
  // never an assertion that a real request or provider response exists.
  const observation = scenario.simulated_response.bind_current_synthetic_batch === true ? { ...scenario.simulated_response, batch_fingerprint: uploadBatchFingerprint(eligible), request_binding_ref: 'synthetic-only-current-batch' } : scenario.simulated_response;
  const receipts = eligible.length ? applyUploadResults(eligible, observation) : [];
  const recommendation = recommendOptimization(reconciliation, { ...scenario.optimization, receipts });
  return { mode: 'synthetic_offline_no_provider_calls', offer, tracking, reconciliation, drafts, receipts, recommendation };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateAffiliateContract(JSON.parse(readFileSync(affiliateContractPath, 'utf8')));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
