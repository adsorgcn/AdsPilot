import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyAgentPackage, defaultRoot } from '../../scripts/verify-agent-package.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'adspilot-package-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(defaultRoot, directory, { recursive: true });
  return directory;
}

async function changeManifest(directory, change) {
  const path = join(directory, 'manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  change(manifest);
  await writeFile(path, JSON.stringify(manifest));
}

test('the shipped skill is self-contained and instruction-only', async () => {
  const result = await verifyAgentPackage();
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test('a hidden executable cannot enter the distribution', async t => {
  const directory = await fixture(t);
  await writeFile(join(directory, 'bootstrap.sh'), 'start-server');
  const result = await verifyAgentPackage(directory);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('Executable')));
});

test('declaring a daemon or runtime dependency violates product requirements', async t => {
  const directory = await fixture(t);
  await changeManifest(directory, m => { m.services = ['adscenter']; m.runtime_dependencies = ['go']; });
  const result = await verifyAgentPackage(directory);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.startsWith('services')));
  assert.ok(result.errors.some(e => e.startsWith('runtime_dependencies')));
});

test('paths cannot escape the package', async t => {
  const directory = await fixture(t);
  await changeManifest(directory, m => m.files.push('../credentials.json'));
  const result = await verifyAgentPackage(directory);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.startsWith('Unsafe package path')));
});

test('a copied skill cannot depend on a missing reference', async t => {
  const directory = await fixture(t);
  await writeFile(join(directory, 'SKILL.md'), `${await readFile(join(directory, 'SKILL.md'), 'utf8')}\n[Missing](references/missing.md)\n`);
  const result = await verifyAgentPackage(directory);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.startsWith('Missing reference')));
});

test('text alone cannot advertise L2 runtime enforcement', async t => {
  const directory = await fixture(t);
  await changeManifest(directory, m => { m.protocol.declared_conformance = 'L2'; });
  const result = await verifyAgentPackage(directory);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('cannot claim runtime enforcement')));
});

test('write capabilities cannot drop durable state or authorization', async t => {
  const directory = await fixture(t);
  await changeManifest(directory, m => { m.capabilities.find(c => c.id === 'campaigns.mutate').requires = ['google_ads.mutate']; });
  const result = await verifyAgentPackage(directory);
  assert.equal(result.ok, false);
  assert.equal(result.errors.filter(e => e.startsWith('Write capability lacks')).length, 3);
});

test('declared protocol revision cannot drift from the approved validators', async t => {
  const directory = await fixture(t);
  await changeManifest(directory, m => { m.protocol.source_commit = 'a'.repeat(40); });
  const result = await verifyAgentPackage(directory);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('hash-pinned I-Lang validators')));
});

test('the instruction profile cannot cite a different normative revision', async t => {
  const directory = await fixture(t);
  const path = join(directory, 'references', 'ilang.md');
  const text = await readFile(path, 'utf8');
  await writeFile(path, text.replaceAll(/[a-f0-9]{40}/g, 'a'.repeat(40)));
  const result = await verifyAgentPackage(directory);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('profile must cite')));
});
