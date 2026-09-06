#!/usr/bin/env node
// Offline rehearsal only. No credentials, network, installed runtime or writes.
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCustomerHierarchy, normalizeCampaignReport, normalizeKeywordIdeas, buildPausedSearchPlan } from './verify-google-workflows.mjs';
import { runAffiliateScenario } from './verify-affiliate-workflows.mjs';

export async function runAcceptanceScenarios(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  const read = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
  const [google, affiliate, contract, manifest] = await Promise.all([
    read('tests/agent-package/fixtures/google-golden-path.json'), read('tests/agent-package/fixtures/affiliate-loop-v3.json'),
    read('skills/adspilot/contracts/affiliate.json'), read('skills/adspilot/manifest.json')
  ]);
  if (google.fixture_kind !== 'synthetic_not_provider_integration' || affiliate.synthetic !== true) throw new Error('Rehearsal accepts only marked synthetic fixtures');
  const identity = normalizeCustomerHierarchy({ ...google.observation, ...google.hierarchy });
  const report = normalizeCampaignReport({ ...google.observation, ...google.account, ...google.report });
  const keywords = normalizeKeywordIdeas({ ...google.observation, ...google.account, ...google.keywords });
  const plan = buildPausedSearchPlan({ ...google.account, ...google.search_plan });
  const loop = runAffiliateScenario(affiliate, contract);
  return {
    version: manifest.version, mode: 'synthetic_offline', external_calls: 0, external_mutations: 0,
    google: { identity, report: { state: report.state, totals: report.totals, currency: report.currency },
      keywords: { state: keywords.state, volumes: keywords.rows.map(row => ({ text: row.text, volume: row.avg_monthly_searches })) },
      campaign: { state: plan.state, operation_count: plan.operation_count, budget_micros: plan.daily_budget_micros, status: plan.requested_status, submitted: false } },
    affiliate: { offer: loop.offer, tracking: loop.tracking.status, totals: loop.reconciliation.totals,
      import_complete: loop.reconciliation.checkpoint.complete, draft_states: loop.drafts.map(d => d.state),
      simulated_receipt_states: loop.receipts.map(r => r.state), recommendation: loop.recommendation },
    limitations: ['Synthetic receipts are not provider evidence.', 'Submission/readback and adversarial branches are covered separately by regression tests.', 'Real host acceptance remains separately authorized.']
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(`${JSON.stringify(await runAcceptanceScenarios(), null, 2)}\n`); }
  catch (error) { process.stderr.write(`Acceptance rehearsal failed: ${error.message}\n`); process.exitCode = 1; }
}
