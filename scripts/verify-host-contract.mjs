#!/usr/bin/env node
// Developer reference checks, not an installed connector or permission runtime.
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const hostContractPath = resolve(dirname(fileURLToPath(import.meta.url)), '../skills/adspilot/contracts/operations.json');
const text = value => typeof value === 'string' && value.trim().length > 0;
const strings = value => Array.isArray(value) && value.every(text) && new Set(value).size === value.length;
const guards = ['host.records', 'host.authorization', 'host.input_isolation'];
const knownOperations = ['auth.status', 'accounts.list', 'campaigns.summary', 'keywords.ideas',
  'plans.draft', 'plans.validate', 'plans.execute', 'execution.status', 'offers.search',
  'links.resolve', 'commissions.analyze', 'commissions.reconcile', 'conversions.plan',
  'conversions.upload', 'optimization.plan'];

export function validateHostContract(contract) {
  const errors = [];
  const check = (ok, reason) => { if (!ok) errors.push(`host contract: ${reason}`); };
  check(contract?.schema_version === 1 && contract?.kind === 'logical-host-operation-contract', 'unsupported schema/kind');
  check(/^\d+\.\d+\.\d+$/.test(contract?.version ?? ''), 'semver required');
  check(contract?.callable_tools === false, 'logical names are not callable tools');
  check(text(contract?.enforcement), 'host enforcement boundary missing');
  check(strings(contract?.write_guards) && guards.every(g => contract.write_guards.includes(g)), 'write guards missing');
  check(strings(contract?.capabilities), 'capability IDs must be unique');
  check(strings(contract?.binding_evidence) && ['session_ref', 'schema_ref', 'provenance', 'observed_at', 'scope'].every(k => contract.binding_evidence.includes(k)), 'binding evidence incomplete');
  check(Array.isArray(contract?.operations), 'operations missing');
  const ids = new Set();
  for (const op of Array.isArray(contract?.operations) ? contract.operations : []) {
    check(text(op?.id) && !ids.has(op.id), 'duplicate/missing operation ID');
    ids.add(op?.id);
    check(['instruction', 'read', 'validate', 'write'].includes(op?.mode), `${op?.id}: unknown mode`);
    check(['google_ads', 'cj'].includes(op?.provider), `${op?.id}: provider missing`);
    check(typeof op?.target_required === 'boolean', `${op?.id}: target requirement missing`);
    check(strings(op?.requires) && op.requires.every(c => contract?.capabilities?.includes(c)), `${op?.id}: unknown capability requirement`);
    check(strings(op?.inputs) && strings(op?.outputs) && op.outputs.length > 0, `${op?.id}: input/output shape missing`);
    check(/^references\/[a-z-]+\.md$/.test(op?.reference ?? ''), `${op?.id}: package reference invalid`);
    if (op?.mode === 'write') check(guards.every(g => op.requires?.includes(g)) && op.target_required === true, `${op.id}: write boundary incomplete`);
    if (op?.mode === 'instruction') check(op.requires?.length === 0, `${op.id}: offline draft cannot require a provider`);
  }
  check(knownOperations.every(id => ids.has(id)), 'required product operation missing');
  return { ok: errors.length === 0, errors, operations: ids.size };
}

/** Models only discovery evidence. Host attestation is input, not proved here.
 * Capability-ready is not an authorization, provider result or ready-to-submit.
 * Opaque schema refs must come from actual host discovery in real execution.
 */
export function evaluateHostBindings(contract, host, request, { now = Date.now(), max_age_ms = 300_000 } = {}) {
  const validation = validateHostContract(contract);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const operation = contract.operations.find(op => op.id === request?.operation);
  if (!operation) throw new Error('Unsupported logical operation');
  if (operation.mode === 'instruction') return { operation: operation.id, state: 'instruction_ready', executable: false, missing: [], bindings: [] };
  const base = { operation: operation.id, executable: false, bindings: [], missing: [] };
  if (!text(host?.session_ref) || !Array.isArray(host?.bindings) || !Number.isFinite(now)
    || !Number.isFinite(max_age_ms) || max_age_ms <= 0) return { ...base, state: 'not_checked', missing: ['host_discovery_evidence'] };
  if (operation.target_required && !/^\d{10}$/.test(request?.customer_id ?? '')) {
    return { ...base, state: 'needs_owner', missing: ['resolved_target_customer'] };
  }
  const pending = [];
  for (const capability of operation.requires) {
    const candidates = host.bindings.filter(b => b?.capability === capability
      && (!request.binding_refs?.[capability] || b.binding_ref === request.binding_refs[capability]));
    const valid = candidates.filter(b => {
      const at = Date.parse(b.observed_at ?? '');
      return b.provenance === 'host_tool' && text(b.binding_ref) && text(b.schema_ref)
        && b.session_ref === host.session_ref && Number.isFinite(at) && at <= now && now - at <= max_age_ms
        && b.scope && (capability.startsWith('host.') || b.scope.provider === operation.provider)
        && (!operation.target_required || (Array.isArray(b.scope.customer_ids) && b.scope.customer_ids.includes(request.customer_id)));
    });
    if (valid.length !== 1) { base.missing.push(`${capability}:${valid.length > 1 ? 'ambiguous_binding' : 'fresh_scoped_schema'}`); continue; }
    const b = valid[0];
    if (b.status !== 'ready') { pending.push(['needs_owner', 'pending_provider', 'unsupported'].includes(b.status) ? b.status : 'not_checked'); base.missing.push(capability); continue; }
    if (!capability.startsWith('host.')) {
      if (!text(b.tool_name) || !Array.isArray(b.supported_operations) || !b.supported_operations.includes(operation.id)) { base.missing.push(`${capability}:observed_tool_method`); continue; }
      if (!['connector', 'authenticated_http'].includes(b.transport)) { base.missing.push(`${capability}:authenticated_transport`); continue; }
      if (b.transport === 'authenticated_http' && (b.opaque_secret_injection !== true || !text(b.endpoint_scope_ref))) { base.missing.push(`${capability}:protected_credential_transport`); continue; }
      if (capability === 'google_ads.validate' && b.validation_applies_mutations !== false) { base.missing.push(`${capability}:non_mutating_validation`); continue; }
    }
    if (capability === 'host.records' && (b.conditional_writes !== true || b.durable !== true || !text(b.namespace_ref))) { base.missing.push(`${capability}:durable_conditional_records`); continue; }
    if (capability === 'host.authorization' && (b.scope_enforced !== true || b.plan_revision_binding !== true)) { base.missing.push(`${capability}:exact_scope_enforcement`); continue; }
    if (capability === 'host.input_isolation' && b.trusted_boundary !== true) { base.missing.push(`${capability}:trusted_boundary`); continue; }
    base.bindings.push({ capability, binding_ref: b.binding_ref, tool_name: b.tool_name ?? null, schema_ref: b.schema_ref });
  }
  const state = base.missing.length === 0 ? 'capability_ready'
    : pending.includes('needs_owner') ? 'needs_owner'
      : pending.includes('pending_provider') ? 'pending_provider'
        : pending.includes('unsupported') ? 'unsupported' : 'needs_host';
  return { ...base, state, next: state === 'capability_ready'
    ? 'Check task inputs and exact workflow validation/authorization; this discovery result does not permit a write.'
    : 'Resolve only listed missing evidence or capability; retain the draft and known user facts.' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = validateHostContract(JSON.parse(await readFile(process.argv[2] ?? hostContractPath, 'utf8')));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
