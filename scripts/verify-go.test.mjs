import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { checkInventory, parseOptions, selectModules, variantsFor } from './verify-go.mjs';

function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'adspilot-inventory-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const inventory = () => ({
  schemaVersion: 1,
  modules: [{ path: 'services/adscenter', status: 'optional-adapter', variants: ['default', 'ads_live'] }],
  unownedSourceRoots: [{ path: 'tools/old', reason: 'Frozen historical example.' }],
});

test('inventory rejects a new module omitted from developer checks', (t) => {
  const root = fixture(t, {
    'services/adscenter/go.mod': 'module example/adscenter\n',
    'services/new/go.mod': 'module example/new\n',
    'tools/old/main.go': 'package main\n',
  });
  assert.throws(() => checkInventory(root, inventory()), /Unlisted Go module: services\/new/);
});

test('inventory requires a reason for source not owned by any module', (t) => {
  const root = fixture(t, {
    'services/adscenter/go.mod': 'module example/adscenter\n',
    'services/adscenter/main.go': 'package main\n',
    'tools/old/main.go': 'package main\n',
    'pkg/unowned/file.go': 'package unowned\n',
  });
  assert.throws(() => checkInventory(root, inventory()), /Unlisted source outside a Go module: pkg\/unowned\/file.go/);
});

test('inventory accepts explicit exclusions and ignores dependency/vendor trees', (t) => {
  const root = fixture(t, {
    'services/adscenter/go.mod': 'module example/adscenter\n',
    'services/adscenter/main.go': 'package main\n',
    'tools/old/main.go': 'package main\n',
    'node_modules/example/go.mod': 'module external\n',
    'vendor/old/unowned.go': 'package external\n',
  });
  const result = checkInventory(root, inventory());
  assert.deepEqual(result.modules, ['services/adscenter']);
  assert.deepEqual(result.unowned, ['tools/old/main.go']);
});

test('inventory fails closed on stale, duplicate, or unsafe records', (t) => {
  const root = fixture(t, { 'services/adscenter/go.mod': 'module example/adscenter\n' });
  const records = inventory();
  records.modules.push({ path: '../outside', status: 'optional-adapter' });
  records.modules.push(records.modules[0]);
  assert.throws(() => checkInventory(root, records), /Unsafe inventory path/);
  assert.throws(() => checkInventory(root, records), /Duplicate inventory path/);
  assert.throws(() => checkInventory(root, records), /Stale unowned-source exclusion/);
});

test('default adapter selection includes both AdsCenter build variants', () => {
  const options = parseOptions([]);
  const records = inventory();
  records.modules.push({ path: 'services/console', status: 'frozen-service' });
  assert.equal(options.test, true);
  assert.equal(options.build, true);
  assert.equal(selectModules(records, options).length, 1);
  assert.deepEqual(variantsFor(records.modules[0], options), ['default', 'ads_live']);
});

test('explicit module checks cannot silently fall back to the default scope', () => {
  const options = parseOptions(['--module', 'services/missing', '--test']);
  assert.throws(() => selectModules(inventory(), options), /Module is not in inventory/);
  assert.throws(() => parseOptions(['--scope', 'unknown']), /Unknown scope/);
  assert.throws(() => parseOptions(['--tags', 'integration']), /integration tests are deliberately excluded/);
  assert.throws(() => parseOptions(['--module']), /requires a value/);
});

test('format-only and build-only checks do not imply tests', () => {
  assert.equal(parseOptions(['--format']).test, false);
  assert.equal(parseOptions(['--format']).build, false);
  assert.equal(parseOptions(['--build']).test, false);
  assert.equal(parseOptions(['--build']).build, true);
});
