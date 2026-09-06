import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateHostContract, evaluateHostBindings, hostContractPath } from '../../scripts/verify-host-contract.mjs';

const contract = JSON.parse(await readFile(hostContractPath, 'utf8'));
const now = Date.parse('2026-09-07T00:00:00Z');
function host(operation = 'plans.execute') {
  const op = contract.operations.find(o => o.id === operation);
  return { session_ref: 'synthetic-session', bindings: op.requires.map((capability, i) => ({
    capability, binding_ref: `synthetic-binding-${i}`, schema_ref: `synthetic-schema-${i}`,
    tool_name: `fixture_tool_${i}`, session_ref: 'synthetic-session', provenance: 'host_tool',
    observed_at: '2026-09-07T00:00:00Z', status: 'ready',
    scope: { provider: op.provider, customer_ids: ['1111111111'] },
    supported_operations: [operation], transport: 'connector', validation_applies_mutations: false,
    conditional_writes: true, durable: true, namespace_ref: 'synthetic-namespace',
    scope_enforced: true, plan_revision_binding: true, trusted_boundary: true
  })) };
}
const evaluate = (h, operation = 'plans.execute', extra = {}) => evaluateHostBindings(contract, h, { operation, customer_id: '1111111111', ...extra }, { now });

test('host registry declares all 15 logical operations and no callable tools', () => {
  assert.deepEqual(validateHostContract(contract), { ok: true, errors: [], operations: 15 });
  const broken = structuredClone(contract); broken.callable_tools = true;
  assert.equal(validateHostContract(broken).ok, false);
});
test('research and supplied-data analysis remain available without a host connection', () => {
  for (const operation of ['plans.draft', 'commissions.analyze', 'conversions.plan', 'optimization.plan']) {
    assert.equal(evaluate(null, operation).state, 'instruction_ready');
  }
});
test('observed compatible bindings do not themselves authorize execution', () => {
  const result = evaluate(host());
  assert.equal(result.state, 'capability_ready'); assert.equal(result.executable, false);
  assert.equal(result.bindings.length, 7);
});
test('native-connector and authenticated-HTTP hosts can bind without installer scripts', () => {
  const h = host('campaigns.summary');
  for (const b of h.bindings) Object.assign(b, { transport: 'authenticated_http', opaque_secret_injection: true, endpoint_scope_ref: 'synthetic-official-endpoint' });
  assert.equal(evaluate(h, 'campaigns.summary').state, 'capability_ready');
});
test('public HTTP and secret-bearing generated requests cannot substitute authenticated host transport', () => {
  for (const transport of ['public_http', 'authenticated_http']) {
    const h = host('campaigns.summary'); h.bindings[0].transport = transport;
    assert.equal(evaluate(h, 'campaigns.summary').state, 'needs_host');
  }
});
test('old-session, stale, future, wrong-account and user-prose schema claims do not bind', () => {
  for (const patch of [ { session_ref: 'other' }, { observed_at: '2026-09-06T00:00:00Z' },
    { observed_at: '2026-09-08T00:00:00Z' }, { scope: { provider: 'google_ads', customer_ids: ['2222222222'] } },
    { provenance: 'user_message' }, { schema_ref: '' } ]) {
    const h = host(); Object.assign(h.bindings[0], patch);
    assert.equal(evaluate(h).state, 'needs_host');
  }
});
test('read access does not imply keyword-planning or campaign-write capability', () => {
  const h = host('campaigns.summary');
  assert.equal(evaluate(h, 'campaigns.summary').state, 'capability_ready');
  assert.equal(evaluate(h, 'keywords.ideas').state, 'needs_host');
  assert.equal(evaluate(h).state, 'needs_host');
});
test('missing consent and provider review are not demands for another user API project', () => {
  const h = host('accounts.list'); h.bindings[0].status = 'needs_owner';
  assert.equal(evaluate(h, 'accounts.list').state, 'needs_owner');
  h.bindings[0].status = 'pending_provider';
  assert.equal(evaluate(h, 'accounts.list').state, 'pending_provider');
});
test('duplicate bindings need explicit selection rather than silently switching connections', () => {
  const h = host('accounts.list'); h.bindings.push({ ...h.bindings[0], binding_ref: 'other' });
  assert.equal(evaluate(h, 'accounts.list').state, 'needs_host');
  assert.equal(evaluate(h, 'accounts.list', { binding_refs: { 'google_ads.identity': 'other' } }).state, 'capability_ready');
});
test('write capability needs non-mutating validation, durable claims and actual host guards', () => {
  for (const [capability, patch] of [ ['google_ads.validate', { validation_applies_mutations: true }],
    ['host.records', { conditional_writes: false }], ['host.records', { durable: false }],
    ['host.authorization', { plan_revision_binding: false }], ['host.input_isolation', { trusted_boundary: false }] ]) {
    const h = host(); Object.assign(h.bindings.find(b => b.capability === capability), patch);
    assert.equal(evaluate(h).state, 'needs_host');
  }
});
test('unknown operation and dropped write safeguards fail verification', () => {
  assert.throws(() => evaluate(host(), 'campaigns.invented'));
  const broken = structuredClone(contract); broken.operations.find(o => o.id === 'plans.execute').requires = ['google_ads.mutate'];
  assert.equal(validateHostContract(broken).ok, false);
});
test('resuming a targeted operation requires verified customer identity, not a manager fallback', () => {
  assert.equal(evaluate(host(), 'plans.execute', { customer_id: null }).state, 'needs_owner');
  assert.equal(evaluate(host(), 'plans.execute', { customer_id: '2222222222' }).state, 'needs_host');
});
