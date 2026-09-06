import test from 'node:test';
import assert from 'node:assert/strict';
import { runAcceptanceScenarios } from '../../scripts/run-acceptance-scenarios.mjs';

test('integrated release rehearsal keeps exact Google amounts and affiliate economics in separate currencies', async () => {
  const result = await runAcceptanceScenarios();
  assert.equal(result.google.report.currency, 'JPY');
  assert.equal(result.google.report.totals.cost_micros, '9007199254741000');
  assert.equal(result.google.report.totals.conversions, '0.75');
  assert.equal(result.affiliate.totals.USD.commission, '11.3333');
  assert.equal(result.affiliate.totals.USD.sale, '110');
  assert.equal(result.affiliate.recommendation.spend, '12');
  assert.equal(result.affiliate.recommendation.net_before_other_costs, '-0.6667');
});
test('integrated rehearsal does not turn draft or simulated provider receipts into real execution', async () => {
  const result = await runAcceptanceScenarios();
  assert.equal(result.mode, 'synthetic_offline');
  assert.equal(result.external_calls, 0); assert.equal(result.external_mutations, 0);
  assert.equal(result.google.campaign.state, 'draft'); assert.equal(result.google.campaign.status, 'PAUSED');
  assert.equal(result.google.campaign.submitted, false);
  assert.equal(result.affiliate.recommendation.automatic_mutation, false);
  assert.equal(result.affiliate.recommendation.synthetic, true);
});
