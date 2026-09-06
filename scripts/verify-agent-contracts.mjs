#!/usr/bin/env node
// Developer-only contract policy checks. This does not execute or certify an AI
// agent, implement a Google connector, or form part of the shipped skill runtime.
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const contractRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../skills/adspilot/contracts');
const secretNames = ['password', 'two_factor_code', 'access_token', 'refresh_token',
  'developer_token', 'client_secret', 'private_key', 'authorization_code'];
const actors = new Set(['owner', 'agent', 'host']);
const classifications = new Set(['non_secret', 'opaque_reference', 'secret_reference']);
const retryOperations = new Set(['read', 'validate_only', 'confirmed_rejected_mutation']);
const retryStrategies = new Set(['refresh_once', 'wait_for_corrected_grant', 'wait_for_configuration',
  'wait_for_authority', 'wait_for_consent', 'diagnose_before_retry', 'repair_binding_then_read_once',
  'wait_for_scoped_authority', 'wait_for_account_state', 'wait_for_connector_credentials',
  'wait_for_provider_review', 'wait_for_project_configuration', 'exponential_backoff_with_jitter',
  'classify_then_defer', 'classify_before_retry', 'conditional_exponential_backoff',
  'bounded_read_retry_or_reconcile', 'conditional_read_retry_or_reconcile', 'read_only_reconciliation',
  'repair_draft_then_validate', 'refresh_state_then_revalidate', 'correct_scoped_read_target_once',
  'compliant_draft_then_validate', 'per_operation_recovery', 'wait_for_supported_binding',
  'wait_for_capability', 'wait_for_secure_capability', 'wait_for_write_boundary', 'evidence_only', 'wait_for_planning_access']);
const prohibitedActions = ['elevate_permissions', 'switch_account', 'replace_identity', 'raise_budget',
  'disable_safeguards', 'collect_raw_secrets', 'bypass_policy', 'repeat_unknown_mutation', 'retry_entire_partial_batch'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string' && value.trim().length > 0;
const isStrings = value => Array.isArray(value) && value.every(isText) && new Set(value).size === value.length;

function officialSource(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['developers.google.com', 'support.google.com',
      'cloud.google.com', 'docs.cloud.google.com', 'ads-developers.googleblog.com'].includes(url.hostname)
      && !url.username && !url.password && url.pathname !== '/';
  } catch { return false; }
}

function validateIntake(intake, errors) {
  const check = (condition, message) => { if (!condition) errors.push(`intake: ${message}`); };
  check(isObject(intake), 'must be an object');
  if (!isObject(intake)) return;
  check(intake.schema_version === 1 && intake.kind === 'conditional-intake-contract', 'unsupported schema/kind');
  check(/^\d+\.\d+\.\d+$/.test(intake.version ?? ''), 'version must be semver');
  check(intake.discovery_first === true, 'discovery must precede owner questions');
  check(intake.secret_collection === 'host_secret_store_only', 'raw credentials must remain in host storage');
  check(isStrings(intake.forbidden_chat_fields)
    && secretNames.every(name => intake.forbidden_chat_fields.includes(name)), 'forbidden credential fields are incomplete');
  check(isObject(intake.fields) && Object.keys(intake.fields).length > 0, 'field definitions missing');
  const fields = isObject(intake.fields) ? intake.fields : {};
  for (const [name, field] of Object.entries(fields)) {
    check(/^[a-z][a-z0-9_]*$/.test(name), `invalid field name ${name}`);
    check(!secretNames.includes(name), `raw credential field ${name} is forbidden`);
    check(isObject(field), `${name} must be a field definition`);
    if (!isObject(field)) continue;
    check(actors.has(field.actor), `${name} actor must be owner, agent, or host`);
    check(classifications.has(field.classification), `${name} classification must not expose raw secrets`);
    check(isText(field.ask), `${name} needs an actionable prompt`);
    if (field.classification === 'secret_reference') {
      check(field.actor === 'host' && name.endsWith('_ref'), `${name} secret reference must be host-owned and opaque`);
    }
    if (field.actor === 'owner') check(field.classification === 'non_secret', `${name} owner fields must be non-secret facts`);
    if (/(?:password|token|secret|private_key|authorization_code|two_factor)/.test(name)) {
      check(field.classification === 'secret_reference' && name.endsWith('_ref'), `${name} cannot collect a raw credential`);
    }
  }
  function referencedRows(rows, label) {
    check(Array.isArray(rows) && rows.length > 0, `${label} must not be empty`);
    const ids = new Set();
    for (const row of Array.isArray(rows) ? rows : []) {
      check(isObject(row), `${label} row must be an object`);
      if (!isObject(row)) continue;
      check(isText(row.id) && !ids.has(row.id), `${label} duplicate or absent ID ${row.id}`);
      ids.add(row.id);
      check(isStrings(row.requires) && row.requires.length > 0, `${row.id} requires must be unique field names`);
      for (const name of Array.isArray(row.requires) ? row.requires : []) {
        check(Object.hasOwn(fields, name), `${row.id} refers to unknown field ${name}`);
      }
    }
  }
  referencedRows(intake.auth_routes, 'auth_routes');
  referencedRows(intake.api_access_modes, 'api_access_modes');
  const routes = Array.isArray(intake.auth_routes) ? intake.auth_routes : [];
  for (const id of ['existing_connector', 'host_managed_oauth']) {
    const route = routes.find(row => row?.id === id);
    check(Boolean(route), `${id} route missing`);
    if (route) {
      check(route.user_api_project_required === false && route.user_developer_token_required === false,
        `${id} must not require a user API project or developer token`);
      check(JSON.stringify(route.requires) === '["connection_ref"]', `${id} must require only the host connection reference, not an MCC or raw credentials`);
      check(route.api_access === undefined, `${id} must reuse the connector's access, not enroll a second API project`);
    }
  }
  const modes = Array.isArray(intake.api_access_modes) ? intake.api_access_modes : [];
  const approved = modes.find(row => row?.id === 'approved_cloud_managed');
  check(Array.isArray(approved?.requires) && approved.requires.includes('cloud_access_approval_ref'), 'Cloud-managed pilot access needs explicit enrollment evidence');
  check(isObject(intake.task_inputs), 'task_inputs must map task types to field names');
  for (const [task, names] of Object.entries(isObject(intake.task_inputs) ? intake.task_inputs : {})) {
    check(isStrings(names), `${task} task input fields must be unique`);
    for (const name of Array.isArray(names) ? names : []) {
      check(Object.hasOwn(fields, name), `${task} task refers to unknown field ${name}`);
    }
  }
  for (const key of ['owner_handoffs', 'provider_handoffs', 'capability_request', 'result_fields']) {
    check(isStrings(intake[key]) && intake[key].length > 0, `${key} must contain unique non-empty values`);
  }
  check(isStrings(intake.sources) && intake.sources.length > 0 && intake.sources.every(officialSource), 'sources must be specific official Google HTTPS documents');
}

/** Resolve only declared field dependencies; values/secrets never enter this API. */
export function resolveIntakeRequirements(intake, { route, task_type = 'onboarding', known_fields = [], api_access_mode } = {}) {
  const errors = [];
  validateIntake(intake, errors);
  if (errors.length) throw new Error(errors.join('; '));
  if (!isStrings(known_fields) || known_fields.some(name => !Object.hasOwn(intake.fields, name))) {
    throw new Error('known_fields must be unique declared field names, never raw credentials');
  }
  const selected = intake.auth_routes.find(item => item.id === route);
  if (!selected) throw new Error(`Unknown authentication route: ${route}`);
  if (!Object.hasOwn(intake.task_inputs, task_type)) throw new Error(`Unknown task type: ${task_type}`);
  const required = [...selected.requires, ...intake.task_inputs[task_type]];
  let accessModeUnresolved = false;
  if (selected.api_access === 'resolve_access_mode') {
    if (!api_access_mode) accessModeUnresolved = true;
    else {
      const access = intake.api_access_modes.find(item => item.id === api_access_mode);
      if (!access) throw new Error(`Unknown API access mode: ${api_access_mode}`);
      required.push(...access.requires);
    }
  } else if (api_access_mode) {
    throw new Error('Existing/host-managed connectors must not request a separate user API access mode');
  }
  const missingByActor = { owner: [], agent: [], host: [] };
  for (const name of new Set(required)) {
    if (!known_fields.includes(name)) missingByActor[intake.fields[name].actor].push(name);
  }
  return { route, task_type, required_fields: [...new Set(required)], missing_by_actor: missingByActor,
    api_access_mode_unresolved: accessModeUnresolved };
}

// Recovery validation/selection follows below. The same catalog drives tests;
// scenarios do not parse prose or treat API error messages as instructions.
function validateRecovery(recovery, errors) {
  const check = (condition, message) => { if (!condition) errors.push(`recovery: ${message}`); };
  check(isObject(recovery), 'must be an object');
  if (!isObject(recovery)) return;
  check(recovery.schema_version === 1, 'unsupported schema');
  check(/^\d+\.\d+\.\d+$/.test(recovery.version ?? ''), 'version must be semver');
  check(/^\d{4}-\d{2}-\d{2}$/.test(recovery.reviewed_at ?? ''), 'review date missing');
  check(isText(recovery.policy_origin), 'policy origin must identify advisory/host boundary');
  check(isStrings(recovery.prohibited_auto_actions)
    && prohibitedActions.every(action => recovery.prohibited_auto_actions.includes(action)), 'prohibited automatic action boundaries are incomplete');
  check(isStrings(recovery.matching_notes) && recovery.matching_notes.length > 0, 'matching notes missing');
  check(Array.isArray(recovery.rules) && recovery.rules.length > 0, 'rules missing');
  const ids = new Set();
  const matches = new Set();
  for (const rule of Array.isArray(recovery.rules) ? recovery.rules : []) {
    check(isObject(rule), 'rule must be an object');
    if (!isObject(rule)) continue;
    check(/^[a-z][a-z0-9_]*$/.test(rule.id ?? '') && !ids.has(rule.id), `duplicate/invalid rule ID ${rule.id}`);
    ids.add(rule.id);
    for (const field of ['diagnosis', 'action', 'stop_condition']) check(isText(rule[field]), `${rule.id} missing ${field}`);
    check(['agent', 'owner', 'provider', 'host'].includes(rule.actor), `${rule.id} invalid actor`);
    check(typeof rule.automatic === 'boolean', `${rule.id} automatic must be boolean`);
    if (['owner', 'provider'].includes(rule.actor)) check(rule.automatic === false, `${rule.id} cannot automatically perform owner/provider decisions`);
    check(['http', 'oauth', 'google_ads', 'host'].includes(rule.match?.kind), `${rule.id} invalid match kind`);
    check(isStrings(rule.match?.codes) && rule.match.codes.length > 0, `${rule.id} codes must be unique structured codes`);
    for (const code of Array.isArray(rule.match?.codes) ? rule.match.codes : []) {
      const kind = rule.match.kind;
      const valid = kind === 'http' ? /^[45]\d{2}$/.test(code)
        : kind === 'google_ads' ? /^[A-Z][A-Za-z0-9]*Error\.[A-Z][A-Z0-9_]*$/.test(code)
          : kind === 'oauth' ? /^[a-z][a-z0-9_]*$/.test(code) : /^HOST_[A-Z0-9_]+$/.test(code);
      check(valid, `${rule.id} code lacks its exact structured namespace: ${code}`);
      const key = `${kind}:${code}`;
      check(!matches.has(key), `ambiguous duplicate match ${key}`);
      matches.add(key);
    }
    const retry = rule.retry_policy;
    check(isObject(retry), `${rule.id} retry policy missing`);
    if (isObject(retry)) {
      check(retryStrategies.has(retry.strategy), `${rule.id} unknown retry strategy ${retry.strategy}`);
      check(Number.isInteger(retry.max_auto_retries) && retry.max_auto_retries >= 0 && retry.max_auto_retries <= 3,
        `${rule.id} retry cap must be between 0 and 3`);
      check(isStrings(retry.eligible_operations) && retry.eligible_operations.every(op => retryOperations.has(op)),
        `${rule.id} retry operations cannot broaden permissions, spend, or unknown writes`);
      check(isStrings(retry.constraints) && retry.constraints.length > 0, `${rule.id} retry constraints missing`);
      if (!rule.automatic) check(retry.max_auto_retries === 0, `${rule.id} manual recovery cannot automatically retry`);
      if (retry.max_auto_retries > 0) check(retry.eligible_operations?.length > 0, `${rule.id} bounded retries need eligible operations`);
      if (['read_only_reconciliation', 'per_operation_recovery', 'evidence_only'].includes(retry.strategy)) {
        check(retry.max_auto_retries === 0, `${rule.id} reconciliation/evidence must not retry original mutations`);
      }
    }
    check(isStrings(rule.sources) && rule.sources.length > 0 && rule.sources.every(officialSource), `${rule.id} sources must be official Google HTTPS documents`);
  }
}

export function validateContracts(intake, recovery) {
  const errors = [];
  validateIntake(intake, errors);
  validateRecovery(recovery, errors);
  if (isObject(intake) && isObject(recovery) && intake.version !== recovery.version) errors.push('contracts: versions must match');
  return { ok: errors.length === 0, errors,
    intake_routes: Array.isArray(intake?.auth_routes) ? intake.auth_routes.length : 0,
    recovery_rules: Array.isArray(recovery?.rules) ? recovery.rules.length : 0,
    scope: 'developer contract policy; not AI behavior or provider integration certification' };
}

const unknownWriteCodes = new Set(['HOST_MUTATION_OUTCOME_UNKNOWN', 'HOST_MUTATION_RESPONSE_LOST', 'HOST_MUTATION_SESSION_INTERRUPTED']);
const needsEvidence = reason => ({ decision: 'needs_evidence', auto_retry: false,
  automatic_action: false, reason, next_action: 'Gather redacted, request-correlated host evidence; continue independent safe work.' });

/**
 * A deterministic model of the documented policy, NOT a production authority
 * validator. Only the real host can establish provenance, time and counters.
 * `evidence` represents host-owned observations, never fields copied from an
 * error message. `message` is intentionally never inspected.
 */
export function selectRecovery(recovery, observation, { now = Date.now(), max_age_ms = 300_000 } = {}) {
  const errors = [];
  validateRecovery(recovery, errors);
  if (errors.length) throw new Error(errors.join('; '));
  if (!isObject(observation)) return needsEvidence('missing_observation');
  const o = observation;
  const isWrite = ['mutate', 'create'].includes(o.operation);
  const unknownWrite = isWrite && (o.submission_unknown === true || o.submission_state === 'unknown'
    || (o.kind === 'host' && unknownWriteCodes.has(o.code)));
  const partial = o.partial_failure === true || (o.kind === 'host' && o.code === 'HOST_GOOGLE_ADS_PARTIAL_FAILURE');
  if (o.user_cancelled === true) return { decision: 'stop', auto_retry: false, automatic_action: false,
    reason: 'user_cancelled', unresolved_state: unknownWrite ? 'unknown_outcome' : partial ? 'partial_failure' : undefined,
    next_action: 'Preserve any unresolved ledger state; do not resume execution or reconciliation automatically after the user stop.' };
  // An uncertain write cannot be made safe by matching a generic 503 or timeout.
  if (unknownWrite) return { decision: 'reconcile', auto_retry: false, automatic_action: false,
    reason: 'submitted_mutation_unknown_outcome', rule_id: 'submitted_mutation_unknown_outcome',
    next_action: 'Keep the operation claim; establish target/request evidence and perform read-only reconciliation before considering another write.' };
  if (partial) return { decision: 'per_operation_recovery', auto_retry: false, automatic_action: false,
    reason: 'partial_failure_never_whole_batch_retry', rule_id: 'partial_failure',
    next_action: 'Reconcile and preserve each successful item; repair only proved-unapplied independent items under a new validated plan.' };

  const evidence = o.evidence;
  const observedAt = Date.parse(evidence?.observed_at ?? '');
  const request = evidence?.request;
  if (!isObject(evidence) || evidence.provenance !== 'host_tool' || !isText(evidence.tool_call_ref)
    || !Number.isFinite(observedAt) || !Number.isFinite(now) || !Number.isFinite(max_age_ms) || max_age_ms <= 0
    || observedAt > now || now - observedAt > max_age_ms || !isObject(request)
    || !isText(request.scope_ref) || request.operation !== o.operation
    || (o.customer_id !== undefined && request.customer_id !== o.customer_id)) {
    return needsEvidence('missing_stale_or_mismatched_request_evidence');
  }
  if (o.canonical_status === 'DATA_LOSS' || o.permanent_failure === true) {
    return { decision: 'stop', auto_retry: false, automatic_action: false, reason: 'explicit_permanent_failure' };
  }
  const exactRule = item => recovery.rules.find(rule => rule.match.kind === item?.kind
    && typeof item?.code === 'string' && rule.match.codes.includes(item.code));
  let rule = exactRule(o);
  // Structured details outrank broad transport status. Unknown/conflicting
  // details require diagnosis, not a fallback that repeats a failed request.
  if (o.details !== undefined) {
    if (!Array.isArray(o.details)) return needsEvidence('malformed_structured_details');
    if (o.details.length) {
      const detailRules = o.details.map(exactRule);
      if (detailRules.some(item => !item) || new Set(detailRules.map(item => item.id)).size !== 1) {
        return needsEvidence('unknown_or_conflicting_structured_details');
      }
      rule = detailRules[0];
    }
  }
  if (!rule) return needsEvidence('unknown_structured_error');
  const result = { decision: rule.automatic ? 'diagnose_or_repair' : 'handoff', rule_id: rule.id,
    actor: rule.actor, auto_retry: false, automatic_action: rule.automatic,
    reason: rule.retry_policy.strategy, next_action: rule.action, stop_condition: rule.stop_condition };
  const retry = rule.retry_policy;
  if (!rule.automatic || retry.max_auto_retries === 0) return result;
  const attempt = o.auto_retries;
  if (!Number.isInteger(attempt) || attempt < 0) return { ...result, automatic_action: false, reason: 'missing_durable_retry_counter' };
  if (attempt >= retry.max_auto_retries) return { ...result, decision: 'stop', automatic_action: false, reason: 'retry_limit_reached' };
  let operation = o.operation;
  if (isWrite) {
    if (o.submission_state !== 'confirmed_rejected' || evidence.unapplied !== true) {
      return { ...result, decision: 'reconcile', automatic_action: false, reason: 'mutation_not_proved_unapplied' };
    }
    const validation = evidence.validation;
    const claim = evidence.operation_claim;
    const samePlan = item => isObject(item) && item.plan_ref === o.plan_ref
      && item.plan_revision === o.plan_revision && item.request_fingerprint === o.request_fingerprint;
    if (!isText(o.plan_ref) || !isText(o.plan_revision) || !isText(o.request_fingerprint)
      || !isText(o.execution_ref) || !samePlan(validation) || validation.outcome !== 'valid'
      || validation.exact_payload !== true || !samePlan(claim)
      || claim.state !== 'owned' || claim.owner_ref !== o.execution_ref) {
      return { ...result, automatic_action: false, reason: 'current_exact_validation_and_owned_claim_required' };
    }
    operation = 'confirmed_rejected_mutation';
  }
  if (!retry.eligible_operations.includes(operation)) return { ...result, reason: 'operation_not_retry_eligible' };
  if (o.within_existing_authority !== true || o.scope_unchanged !== true) {
    return { ...result, automatic_action: false, reason: 'authority_or_scope_not_confirmed' };
  }
  if (['repair_draft_then_validate', 'compliant_draft_then_validate', 'refresh_state_then_revalidate'].includes(retry.strategy)
    && o.corrected_request_revalidated !== true) return { ...result, reason: 'repair_and_revalidate_before_retry' };
  if (rule.id === 'http_service_failure' && o.transient_confirmed !== true) return { ...result, reason: 'http_failure_requires_transient_evidence' };
  return { ...result, decision: 'bounded_recovery', auto_retry: true,
    retries_remaining: retry.max_auto_retries - attempt, eligible_operation: operation };
}

export async function verifyAgentContracts(root = contractRoot) {
  const [intake, recovery] = await Promise.all(['intake.json', 'recovery-catalog.json']
    .map(name => readFile(resolve(root, name), 'utf8').then(JSON.parse)));
  return validateContracts(intake, recovery);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifyAgentContracts(process.argv[2]);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    process.stderr.write(`Agent contract verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
