import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { affiliateContractPath, validateAffiliateContract, affiliateMissingInputs, decimal, addDecimals, selectOffer, bindTrackingLink, normalizeCommissionPage, reconcileCommissions, nextImportWindow, buildConversionDraft, uploadBatchFingerprint, applyUploadResults, recommendOptimization, runAffiliateScenario } from '../../scripts/verify-affiliate-workflows.mjs';

const contract = JSON.parse(readFileSync(affiliateContractPath, 'utf8'));
const source = JSON.parse(readFileSync(new URL('./fixtures/affiliate-loop-v3.json', import.meta.url), 'utf8'));
const fixture = () => structuredClone(source);
const binding = s => ({ ...contract.cj_publisher_commission_binding, ...s.binding });
const pages = s => s.pages.map(p => normalizeCommissionPage(p, binding(s)));
const reconcile = s => reconcileCommissions(pages(s), { mappings: s.mappings });
const draft = (s, order = reconcile(s).orders[0], extra = {}) => buildConversionDraft(order, { mapping: s.mappings.find(m => m.mapping_ref === order.mapping_ref), action: s.action, policy: s.policy, now: s.now, ...extra });
const observationFor = (drafts, extra = {}) => ({ mode: 'synthetic', route: drafts[0].route, response_received: true, request_id: 'synthetic-ingestion-1', batch_fingerprint: uploadBatchFingerprint(drafts), request_binding_ref: 'synthetic-request-bound-to-batch', ...extra });
const confirmedObservation = drafts => observationFor(drafts, { item_results: drafts.map((d, index) => ({ index, destination_key: d.destination_key, plan_fingerprint: d.plan_fingerprint, owner_customer_id: d.normalized.owner_customer_id, conversion_action_id: d.normalized.conversion_action_id, diagnostics_final: true, accepted: true, evidence_ref: `synthetic-diagnostic-item-${index}` })) });

test('affiliate contract validates domain invariants and rejects incorrect correction/accounting semantics', () => {
  assert.equal(validateAffiliateContract(contract).ok, true);
  const invalid = structuredClone(contract);
  invalid.imports.correction_model = 'latest_order_wins';
  invalid.conversion_routes.data_manager.failure_model = 'partial_failure';
  assert.equal(validateAffiliateContract(invalid).ok, false);
  assert.equal(validateAffiliateContract(invalid).errors.length, 2);
});

test('conditional intake asks only missing facts and assigns connector gaps to host', () => {
  const result = affiliateMissingInputs(contract, { business_goal: 'existing brief', publisher_property_choice: '910001' }, ['business_goal', 'publisher_property_choice', 'value_semantics', 'conversion_connector']);
  assert.deepEqual(result.map(r => [r.field, r.actor]), [['value_semantics', 'owner'], ['conversion_connector', 'host']]);
});

test('plain decimal parsing and arbitrarily large totals never use binary float or currency rounding', () => {
  assert.equal(decimal('-000.0000'), '0');
  assert.equal(addDecimals('0.1', '0.2', '-0.00001'), '0.29999');
  assert.equal(addDecimals('9007199254740993.001', '0.009'), '9007199254740993.01');
  assert.throws(() => decimal(0.1));
  assert.throws(() => decimal('1e3'));
  assert.throws(() => decimal('1,000.00'));
});

test('offer eligibility inspects actual relationship, terms, requested brand/direct linking and geography', () => {
  const s = fixture();
  assert.equal(selectOffer(s.offer, s.request, s.now).eligible, true);
  assert.deepEqual(selectOffer(s.offer, { ...s.request, brand_bidding: true }, s.now).reasons, ['brand_bidding_not_allowed']);
  s.offer.relationship = 'pending'; s.offer.terms.valid_until = '2026-08-01T00:00:00Z';
  assert.equal(selectOffer(s.offer, { ...s.request, country: 'JP' }, s.now).eligible, false);
});

test('tracking requires actual network-issued evidence and durable scoped opaque mapping', () => {
  const s = fixture();
  assert.equal(bindTrackingLink(s.offer, s.link, s.mappings[0]).status, 'tracked_link_bound');
  assert.equal(bindTrackingLink(s.offer, { ...s.link, network_issued: false }, s.mappings[0]).status, 'untracked_link_draft');
  assert.equal(bindTrackingLink(s.offer, s.link, { ...s.mappings[0], durable: false }).attribution_available, false);
  assert.ok(bindTrackingLink(s.offer, s.link, { ...s.mappings[0], advertiser_id: 'different' }).reasons.includes('advertiser_id_mismatch'));
});

test('first-party-shaped synthetic page maps exact documented fields without guessing API values', () => {
  const s = fixture(); const page = pages(s)[0]; const row = page.records[0];
  assert.equal(row.commission_id, '1001'); assert.equal(row.original_action_id, '5001');
  assert.equal(row.commission, '10.125'); assert.equal(row.sale, '100.1');
  assert.equal(row.currency, 'USD'); assert.equal(row.tracking_token, 'opaque_event_0001');
  assert.equal(row.posted_at, '2026-09-02T12:01:00Z');
  assert.equal(page.next_cursor, '1002'); assert.equal(page.complete, false);
});

test('normalization rejects unverified schema, numeric money, GraphQL errors, and publisher mismatch', () => {
  const s = fixture();
  assert.throws(() => normalizeCommissionPage(s.pages[0], { ...binding(s), schema_verified: false }));
  assert.throws(() => normalizeCommissionPage({ ...s.pages[0], errors: [{ message: 'bad field' }] }, binding(s)));
  assert.throws(() => normalizeCommissionPage(s.pages[0], { ...binding(s), publisher_id: 'not-this-publisher' }));
  s.pages[0].data.publisherCommissions.records[0].pubCommissionAmountUsd = 10.125;
  assert.throws(() => pages(s), /decimal string/);
});

test('posting window, actual row count and advancing cursor must hold before checkpoint', () => {
  const s = fixture();
  s.pages[0].window.from = '2026-01-01T00:00:00Z'; assert.throws(() => pages(s), /31 days/);
  const b = fixture(); b.pages[0].data.publisherCommissions.count = 9; assert.throws(() => pages(b), /count/);
  const c = fixture(); c.pages[0].cursor = '1002'; assert.throws(() => pages(c), /advancing/);
});

test('delta correction adds distinct commission IDs; exact net values and totals are asserted', () => {
  const result = reconcile(fixture());
  assert.equal(result.ledger.length, 3); assert.equal(result.orders.length, 2);
  assert.equal(result.orders[0].commission, '9'); assert.equal(result.orders[0].sale, '90');
  assert.deepEqual(result.totals, { USD: { commission: '11.3333', sale: '110' } });
  assert.equal(result.checkpoint.watermark, '2026-09-07T00:00:00Z');
});

test('overlapping reimport is idempotent and does not double-count commissions', () => {
  const s = fixture(); const first = reconcile(s);
  const again = reconcileCommissions(pages(s), { mappings: s.mappings, previous: first });
  assert.deepEqual(again.totals, first.totals); assert.equal(again.duplicates, 3);
  assert.equal(again.ledger.length, 3);
});

test('checkpoint resumes incomplete page window without advancing final watermark', () => {
  const s = fixture(); const p = pages(s);
  const partial = reconcileCommissions([p[0]], { mappings: s.mappings });
  assert.equal(partial.checkpoint.complete, false); assert.equal(partial.checkpoint.cursor, '1002');
  assert.equal(partial.checkpoint.watermark, null); assert.equal(partial.orders[0].eligible, false);
  const resumed = reconcileCommissions([p[1]], { mappings: s.mappings, previous: partial });
  assert.deepEqual(resumed.totals, reconcile(s).totals); assert.equal(resumed.checkpoint.complete, true);
  assert.throws(() => reconcileCommissions([p[1]], { mappings: s.mappings }), /sequence/);
});

test('next window retains policy overlap and partitions at 31 days, never resumes wrong cursor', () => {
  const result = nextImportWindow(reconcile(fixture()).checkpoint, { until: '2026-12-01T00:00:00Z', overlap_ms: 86400000 });
  assert.deepEqual(result, { from: '2026-09-06T00:00:00.000Z', to: '2026-10-07T00:00:00.000Z', cursor: null, resumed: false });
  const partial = reconcileCommissions([pages(fixture())[0]]);
  assert.equal(nextImportWindow(partial.checkpoint, { until: '2026-09-08T00:00:00Z', overlap_ms: 0 }).cursor, '1002');
});

test('changed same-ID money is quarantined instead of replacing an order or adding it twice', () => {
  const s = fixture(); const first = reconcile(s);
  s.pages[0].data.publisherCommissions.records[0].pubCommissionAmountUsd = '99';
  const result = reconcileCommissions(pages(s), { mappings: s.mappings, previous: first });
  assert.equal(result.totals.USD.commission, '11.3333');
  assert.equal(result.quarantined.length, 1); assert.equal(result.orders[0].eligible, false);
  assert.ok(result.orders[0].reasons.includes('conflicting_snapshot'));
});

test('status-only revisions are newer observations, not financial deltas', () => {
  const s = fixture(); s.pages[0].data.publisherCommissions.records[1].actionStatus = 'new';
  const first = reconcile(s); assert.ok(first.orders[1].reasons.includes('commission_pending'));
  const refreshed = fixture(); refreshed.pages[0].observed_at = '2026-09-07T11:00:00Z';
  const result = reconcileCommissions(pages(refreshed), { mappings: s.mappings, previous: first });
  assert.equal(result.revisions, 1); assert.equal(result.orders[1].eligible, true);
  assert.deepEqual(result.totals, first.totals);
});

test('unmatched and ambiguous tokens stay accounted but cannot be attributed to convenient account', () => {
  const s = fixture(); s.mappings.pop(); const result = reconcile(s);
  assert.ok(result.orders[1].reasons.includes('unmatched_tracking')); assert.equal(result.totals.USD.commission, '11.3333');
  s.mappings.push({ ...s.mappings[0], mapping_ref: 'another-map', customer_id: '9999999999' });
  assert.ok(reconcile(s).orders[0].reasons.includes('ambiguous_tracking'));
});

test('reversal can arrive before original; it remains isolated until original is recovered', () => {
  const s = fixture(); const p = pages(s)[1]; p.cursor = null;
  const result = reconcileCommissions([p], { mappings: s.mappings });
  assert.equal(result.totals.USD.commission, '-1.125');
  assert.ok(result.orders[0].reasons.includes('original_record_missing'));
});

test('currency conflict is not summed or implicitly FX-converted', () => {
  const s = fixture(); const p = pages(s); p[1].records[0].currency = 'EUR';
  const result = reconcileCommissions(p, { mappings: s.mappings });
  assert.deepEqual(result.totals, { USD: { commission: '12.4583', sale: '120.1' }, EUR: { commission: '-1.125', sale: '-10.1' } });
  assert.equal(result.orders[0].commission, null); assert.ok(result.orders[0].reasons.includes('currency_conflict'));
});

test('conversion draft uses approved commission semantics and correct conversion owner, not serving customer', () => {
  const d = draft(fixture()); assert.equal(d.state, 'draft');
  assert.equal(d.normalized.value, '9'); assert.equal(d.normalized.value_semantics, 'affiliate_commission');
  assert.equal(d.normalized.owner_customer_id, '2222222222'); assert.equal(d.normalized.serving_customer_id, '1111111111');
  assert.equal(d.normalized.route, 'data_manager'); assert.equal(d.provider_payload, null);
  assert.equal(d.normalized.click_ref, 'host-reference-not-a-real-gclid-1');
});

test('sale value is distinct from commission and requires explicit matching action semantics', () => {
  const s = fixture(); s.policy.value_semantics = 'sale_revenue';
  assert.ok(draft(s).reasons.includes('value_semantics_unapproved'));
  s.action.value_semantics = 'sale_revenue'; assert.equal(draft(s).normalized.value, '90');
  s.policy.authoritative_values = false; assert.ok(draft(s).reasons.includes('authoritative_value_semantics_missing'));
});

test('new integrations use Data Manager; legacy Ads upload needs current eligibility evidence', () => {
  const s = fixture(); s.policy.route = 'google_ads_legacy';
  assert.ok(draft(s).reasons.includes('legacy_upload_restricted_use_data_manager'));
  s.policy.legacy_upload_eligible = true; assert.equal(draft(s).state, 'draft');
});

test('conversion holds wrong action owner, denied consent, unsupported clicks and future event times', () => {
  const s = fixture(); s.action.owner_customer_id = '1111111111';
  assert.ok(draft(s).reasons.includes('conversion_action_owner_or_type'));
  const b = fixture(); b.mappings[0].consent_status = 'DENIED'; assert.ok(draft(b).reasons.includes('source_or_consent_not_permitted'));
  const c = fixture(); c.mappings[0].click_type = 'CJ_SID'; assert.ok(draft(c).reasons.includes('unsupported_click_path'));
  const d = fixture(); d.mappings[0].click_at = '2026-09-08T12:00:00Z'; assert.ok(draft(d).reasons.includes('invalid_event_or_click_time'));
});

test('late posting is imported but never changes event time to evade upload window', () => {
  const s = fixture(); for (const p of s.pages) for (const row of p.data.publisherCommissions.records) if (row.originalActionId === '5001') row.eventDate = '2026-01-01T12:00:00Z';
  s.mappings[0].click_at = '2026-01-01T11:00:00Z';
  const result = reconcile(s); assert.equal(result.orders[0].event_at, '2026-01-01T12:00:00Z');
  assert.ok(draft(s, result.orders[0]).reasons.includes('late_outside_upload_window'));
});

test('unknown and accepted-pending upload outcomes cannot be resubmitted', () => {
  const s = fixture(); const d = draft(s);
  for (const state of ['submitted_unknown', 'accepted_pending_diagnostics']) {
    const held = draft(s, undefined, { receipt: { destination_key: d.destination_key, state } });
    assert.equal(held.state, 'reconcile_existing_upload'); assert.equal(held.retry_allowed, false);
  }
});

test('restatement uses absolute revised amount, full cancellation uses retraction, not a new positive conversion', () => {
  const s = fixture(); const d = draft(s); const prior = { destination_key: d.destination_key, state: 'confirmed', order_revision: 'prior-original', value: '10.125', currency: 'USD' };
  const adjust = draft(s, undefined, { receipt: prior });
  assert.equal(adjust.operation, 'restate'); assert.equal(adjust.normalized.value, '9');
  assert.equal(adjust.route, 'google_ads_adjustment');
  s.pages[1].data.publisherCommissions.records[0].pubCommissionAmountUsd = '-10.125';
  s.pages[1].data.publisherCommissions.records[0].saleAmountUsd = '-100.10';
  assert.ok(draft(s, undefined, { receipt: prior }).reasons.includes('zero_value_not_confirmed_cancellation'));
  s.policy.cancellation_confirmed = true;
  assert.equal(draft(s, undefined, { receipt: prior }).operation, 'retract');
  assert.ok(draft(s).reasons.includes('zero_net_order_no_new_conversion'));
});

test('adjustment cannot reuse WBRAID, expired window, or another destination receipt', () => {
  const s = fixture(); const d = draft(s); const receipt = { destination_key: d.destination_key, state: 'confirmed', order_revision: 'older', value: '10', currency: 'USD' };
  s.mappings[0].click_type = 'wbraid'; assert.ok(draft(s, undefined, { receipt }).reasons.includes('adjustment_path_not_supported'));
  s.policy.adjustment_window_days = 1; assert.ok(draft(s, undefined, { receipt }).reasons.includes('adjustment_window_unavailable_or_expired'));
  assert.ok(draft(s, undefined, { receipt: { ...receipt, destination_key: 'other-account' } }).reasons.includes('receipt_destination_mismatch'));
});

test('Data Manager request acceptance and dry-run are not per-item confirmed upload or attribution', () => {
  const s = fixture(); const d = draft(s);
  const pending = applyUploadResults([d], observationFor([d]))[0];
  assert.equal(pending.state, 'accepted_pending_diagnostics'); assert.equal(pending.attribution_confirmed, false); assert.equal(pending.synthetic, true);
  const validated = applyUploadResults([d], observationFor([d], { validate_only: true }))[0];
  assert.equal(validated.state, 'validated');
  const timeout = applyUploadResults([d], { mode: 'synthetic', route: 'data_manager', response_received: false })[0];
  assert.equal(timeout.state, 'submitted_unknown'); assert.equal(timeout.retry_allowed, false);
});

test('Data Manager required-field rejection applies to entire batch; final diagnostics need item correlation', () => {
  const s = fixture(); const ds = reconcile(s).orders.map(o => draft(s, o));
  const failure = applyUploadResults(ds, observationFor(ds, { required_field_failure: true }));
  assert.ok(failure.every(r => r.state === 'rejected_unapplied'));
  const result = applyUploadResults(ds, confirmedObservation(ds));
  assert.ok(result.every(r => r.state === 'confirmed' && r.attribution_confirmed === false));
  assert.equal(applyUploadResults(ds, confirmedObservation(ds), result).length, 2);
  const wrong = confirmedObservation(ds); wrong.item_results[0].destination_key = 'wrong';
  assert.equal(applyUploadResults(ds, wrong)[0].state, 'accepted_pending_diagnostics');
});

test('legacy Ads partial success preserves each item and rejects duplicate result indices', () => {
  const s = fixture(); s.policy.route = 'google_ads_legacy'; s.policy.legacy_upload_eligible = true;
  const ds = reconcile(s).orders.map(o => draft(s, o));
  const response = confirmedObservation(ds); response.item_results[1].accepted = false; response.item_results[1].unapplied = true;
  const result = applyUploadResults(ds, response);
  assert.deepEqual(result.map(r => r.state), ['confirmed', 'rejected_unapplied']);
  response.item_results[1].index = 0; assert.throws(() => applyUploadResults(ds, response), /indices/);
});

test('offline offer -> link -> commission -> conversion draft -> simulated receipts -> recommendation loop', () => {
  const s = fixture(); const initial = runAffiliateScenario(s, contract);
  assert.equal(initial.mode, 'synthetic_offline_no_provider_calls'); assert.equal(initial.offer.eligible, true);
  assert.equal(initial.tracking.attribution_available, true); assert.equal(initial.drafts.length, 2);
  assert.equal(initial.recommendation.recommendation, 'hold_and_collect_evidence');
  const receipts = applyUploadResults(initial.drafts, confirmedObservation(initial.drafts), initial.receipts);
  const recommendation = recommendOptimization(initial.reconciliation, { ...s.optimization, receipts });
  assert.equal(recommendation.recommendation, 'review_reduce_or_pause');
  assert.equal(recommendation.affiliate_commission, '11.3333'); assert.equal(recommendation.net_before_other_costs, '-0.6667');
  assert.equal(recommendation.synthetic, true); assert.equal(recommendation.automatic_mutation, false);
  assert.equal(draft(s, initial.reconciliation.orders[0], { receipt: receipts[0] }).state, 'already_confirmed');
});

test('receipt application ignores wrong batch, stale plan, wrong owner and action despite success text', () => {
  const d = draft(fixture());
  const wrongBatch = confirmedObservation([d]); wrongBatch.batch_fingerprint = 'stale';
  assert.equal(applyUploadResults([d], wrongBatch)[0].state, 'submitted_unknown');
  for (const [field, value] of [['plan_fingerprint', 'older-plan'], ['owner_customer_id', '9999999999'], ['conversion_action_id', 'other-action']]) {
    const wrong = confirmedObservation([d]); wrong.item_results[0][field] = value;
    assert.equal(applyUploadResults([d], wrong)[0].state, 'accepted_pending_diagnostics');
  }
  assert.throws(() => applyUploadResults([d], { ...confirmedObservation([d]), mode: undefined, provenance: 'user_text' }), /Trusted host/);
});

test('existing confirmed receipt never hides changed consent or mismatched destination', () => {
  const s = fixture(); const d = draft(s); const receipt = applyUploadResults([d], confirmedObservation([d]))[0];
  const wrong = draft(s, undefined, { receipt: { ...receipt, destination_key: 'different-owner' } });
  assert.equal(wrong.state, 'held'); assert.ok(wrong.reasons.includes('receipt_destination_mismatch'));
  s.mappings[0].consent_status = 'DENIED';
  assert.equal(draft(s, undefined, { receipt }).state, 'held');
});

test('stale draft response cannot overwrite a later confirmed revision or an unresolved other plan', () => {
  const d = draft(fixture());
  const current = { ...applyUploadResults([d], confirmedObservation([d]))[0], order_revision: 'newer', plan_fingerprint: 'newer-plan', value: '8' };
  assert.deepEqual(applyUploadResults([d], confirmedObservation([d]), [current]), [current]);
  const unknown = { ...current, state: 'submitted_unknown' };
  assert.deepEqual(applyUploadResults([d], confirmedObservation([d]), [unknown]), [unknown]);
});

test('optimization excludes unrelated, stale and wrong-currency receipts and deduplicates orders', () => {
  const s = fixture(); const r = reconcile(s); const ds = r.orders.map(o => draft(s, o));
  const receipts = applyUploadResults(ds, confirmedObservation(ds));
  const bad = [receipts[0], receipts[0], { ...receipts[1], order_revision: 'old' }, { ...receipts[1], currency: 'JPY' }, { ...receipts[1], order_key: 'other-order' }];
  const rec = recommendOptimization(r, { ...s.optimization, receipts: bad });
  assert.equal(rec.confirmed_receipts, 1); assert.equal(rec.recommendation, 'hold_and_collect_evidence');
  const mismatch = recommendOptimization(r, { ...s.optimization, spend_scope: { ...s.optimization.spend_scope, customer_id: 'different' }, receipts });
  assert.equal(mismatch.net_before_other_costs, null); assert.equal(mismatch.confirmed_receipts, 0);
});

test('ineligible offer or missing network link blocks downstream upload drafts in full loop', () => {
  const s = fixture(); s.offer.terms.paid_search = false;
  const r = runAffiliateScenario(s, contract);
  assert.ok(r.drafts.every(d => d.state === 'held')); assert.equal(r.receipts.length, 0);
  const b = fixture(); b.link.network_issued = false;
  assert.ok(runAffiliateScenario(b, contract).drafts.every(d => d.state === 'held'));
});

test('bonus commission is accounted but cannot silently become a sale conversion', () => {
  const s = fixture(); s.pages[0].data.publisherCommissions.records[1].actionType = 'bonus';
  const r = reconcile(s); assert.equal(r.totals.USD.commission, '11.3333');
  assert.ok(draft(s, r.orders[1]).reasons.includes('event_type_not_eligible'));
});

test('non-synthetic observations require independently supplied submitted-request context', () => {
  const d = draft(fixture());
  const observation = { ...confirmedObservation([d]), mode: undefined, provenance: 'host_tool', tool_call_ref: 'host-tool-call' };
  assert.equal(applyUploadResults([d], observation)[0].state, 'submitted_unknown');
  const context = { request_binding_ref: observation.request_binding_ref, batch_fingerprint: observation.batch_fingerprint };
  assert.equal(applyUploadResults([d], observation, [], { ...context, request_binding_ref: 'another-request' })[0].state, 'submitted_unknown');
  assert.equal(applyUploadResults([d], observation, [], context)[0].state, 'confirmed');
});

test('optional field warnings remain in receipts and require review before evidence threshold', () => {
  const s = fixture(); const r = reconcile(s); const ds = r.orders.map(o => draft(s, o));
  const observation = { ...confirmedObservation(ds), field_warnings: [{ field: 'synthetic.optional.field', reason: 'synthetic-invalid-optional-field' }] };
  const receipts = applyUploadResults(ds, observation);
  assert.equal(receipts[0].warnings.length, 1);
  assert.equal(recommendOptimization(r, { ...s.optimization, receipts }).confirmed_receipts, 0);
});
