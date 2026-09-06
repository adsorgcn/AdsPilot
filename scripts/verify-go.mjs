#!/usr/bin/env node
// Developer-only checks. The AdsPilot agent skill has no Node or Go runtime.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'vendor', '.gocache', '.gomodcache', '.next', 'dist', 'build', 'coverage']);
const validStatuses = new Set(['optional-adapter', 'legacy-support', 'frozen-service', 'frozen-tool']);
const normalize = (path) => path.split(sep).join('/');
const isInside = (path, parent) => path === parent || path.startsWith(`${parent}/`);

export function scanGoFiles(root) {
  const modules = [];
  const sources = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) walk(path);
      } else if (entry.name === 'go.mod') {
        modules.push(normalize(relative(root, directory)) || '.');
      } else if (entry.name.endsWith('.go')) {
        sources.push(normalize(relative(root, path)));
      }
    }
  }
  walk(root);
  return { modules: modules.sort(), sources: sources.sort() };
}

export function checkInventory(root, inventory) {
  if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.modules) || !Array.isArray(inventory.unownedSourceRoots)) {
    throw new Error('Unsupported or malformed Go module inventory');
  }
  const errors = [];
  const paths = new Set();
  for (const entry of [...inventory.modules, ...inventory.unownedSourceRoots]) {
    if (typeof entry.path !== 'string' || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(entry.path)) {
      errors.push(`Unsafe inventory path: ${entry.path}`);
    }
    if (paths.has(entry.path)) errors.push(`Duplicate inventory path: ${entry.path}`);
    paths.add(entry.path);
  }
  for (const entry of inventory.modules) {
    if (!validStatuses.has(entry.status)) errors.push(`Unknown status for ${entry.path}: ${entry.status}`);
    if (entry.variants && (!Array.isArray(entry.variants) || entry.variants.length === 0 || entry.variants.some((tag) => !['default', 'ads_live'].includes(tag)))) {
      errors.push(`Unsupported variants for ${entry.path}`);
    }
  }
  for (const entry of inventory.unownedSourceRoots) {
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) errors.push(`Missing exclusion reason for ${entry.path}`);
  }
  const actual = scanGoFiles(root);
  const expected = new Set(inventory.modules.map((entry) => entry.path));
  for (const path of actual.modules) if (!expected.has(path)) errors.push(`Unlisted Go module: ${path}`);
  for (const path of expected) if (!actual.modules.includes(path)) errors.push(`Missing Go module: ${path}`);
  const unowned = actual.sources.filter((path) => !actual.modules.some((module) => module === '.' || isInside(path, module)));
  for (const path of unowned) {
    if (!inventory.unownedSourceRoots.some((entry) => isInside(path, entry.path))) errors.push(`Unlisted source outside a Go module: ${path}`);
  }
  for (const entry of inventory.unownedSourceRoots) {
    if (!unowned.some((path) => isInside(path, entry.path))) errors.push(`Stale unowned-source exclusion: ${entry.path}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { ...actual, unowned };
}

export function parseOptions(args) {
  const options = { scope: 'adapters', modules: [], tags: null, test: false, build: false, format: false, list: false, inventoryOnly: false, go: process.env.ADSPILOT_GO || 'go' };
  const takeValue = (index, name) => {
    if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${name} requires a value`);
    return args[index + 1];
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--scope') options.scope = takeValue(i++, arg);
    else if (arg === '--module') options.modules.push(takeValue(i++, arg).replaceAll('\\', '/').replace(/^\.\//, ''));
    else if (arg === '--tags') options.tags = takeValue(i++, arg);
    else if (arg === '--go') options.go = takeValue(i++, arg);
    else if (arg === '--test') options.test = true;
    else if (arg === '--build') options.build = true;
    else if (arg === '--format') options.format = true;
    else if (arg === '--list') options.list = true;
    else if (arg === '--inventory-only') options.inventoryOnly = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!['adapters', 'libraries', 'services', 'tools', 'all'].includes(options.scope)) throw new Error(`Unknown scope: ${options.scope}`);
  if (options.tags && !['default', 'ads_live', 'both'].includes(options.tags)) throw new Error('--tags must be default, ads_live, or both (integration tests are deliberately excluded)');
  if (!options.test && !options.build && !options.format) options.test = options.build = true;
  return options;
}

export function selectModules(inventory, options) {
  if (options.modules.length) {
    return [...new Set(options.modules)].map((path) => {
      const entry = inventory.modules.find((module) => module.path === path);
      if (!entry) throw new Error(`Module is not in inventory: ${path}`);
      return entry;
    });
  }
  return inventory.modules.filter((entry) => {
    if (options.scope === 'all') return true;
    if (options.scope === 'adapters') return entry.status === 'optional-adapter';
    if (options.scope === 'libraries') return entry.path.startsWith('pkg/');
    if (options.scope === 'services') return entry.path.startsWith('services/');
    return entry.path.startsWith('tools/');
  });
}

export function variantsFor(entry, options) {
  return options.tags === 'both' ? ['default', 'ads_live'] : options.tags ? [options.tags] : entry.variants || ['default'];
}

function manifestSnapshot(root) {
  const snapshot = new Map();
  const modules = scanGoFiles(root).modules;
  for (const module of modules) {
    for (const name of ['go.mod', 'go.sum']) {
      const path = join(root, module, name);
      snapshot.set(normalize(relative(root, path)), existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null);
    }
  }
  for (const name of ['go.work', 'go.work.sum']) {
    const path = join(root, name);
    snapshot.set(name, existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null);
  }
  return snapshot;
}

function assertUnchanged(before, root) {
  const after = manifestSnapshot(root);
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter((path) => before.get(path) !== after.get(path));
  if (changed.length) throw new Error(`Verification changed module manifests; inspect these changes (nothing was restored):\n${changed.join('\n')}`);
}

function run(command, args, cwd, env) {
  console.log(`> ${normalize(relative(repoRoot, cwd)) || '.'}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  return result.status === 0;
}

function checkToolchain(go, minimum, env) {
  const result = spawnSync(go, ['version'], { env, encoding: 'utf8', shell: false });
  if (result.error) throw new Error(`Go is unavailable. Optional adapter verification requires Go ${minimum}+; the agent skill does not. ${result.error.message}`);
  const match = result.stdout.match(/go(\d+)\.(\d+)(?:\.(\d+))?/);
  if (result.status !== 0 || !match) throw new Error(`Cannot determine Go version: ${result.stderr || result.stdout}`);
  const current = match.slice(1).map((value) => Number(value || 0));
  const required = minimum.split('.').map(Number);
  const comparison = current.map((value, index) => value - required[index]).find((value) => value !== 0) || 0;
  if (comparison < 0) throw new Error(`Go ${minimum}+ is required; found ${match[0]}. Automatic toolchain downloads are disabled.`);
  console.log(result.stdout.trim());
}

export function main(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  if (options.help) {
    console.log(`Developer-only legacy Go verification (no npm install required):
  node scripts/verify-go.mjs [--scope adapters|libraries|services|tools|all]
       [--module services/adscenter] [--test] [--build] [--format]
       [--tags default|ads_live|both] [--go /path/to/go] [--list] [--inventory-only]

Default: test and build optional adapters, including AdsCenter default + ads_live.
--module is repeatable and overrides --scope. --format alone only checks gofmt.
--list and --inventory-only need Node only; both verify inventory completeness.
Commands use GOWORK=off, GOTOOLCHAIN=local, and -mod=readonly. No tidy/sync is run.
Build outputs go to a temporary directory; manifest changes fail verification.
Frozen services, tools, frontend, and unowned Go examples are not product gates.`);
    return 0;
  }
  const inventory = JSON.parse(readFileSync(join(repoRoot, 'config/go-module-inventory.json'), 'utf8'));
  const actual = checkInventory(repoRoot, inventory);
  console.log(`Inventory OK: ${actual.modules.length} Go modules; ${actual.unowned.length} explicitly excluded legacy source files.`);
  if (options.inventoryOnly) return 0;
  const selected = selectModules(inventory, options);
  if (!selected.length) throw new Error('No modules selected; refusing an empty verification run');
  for (const entry of selected) console.log(`${entry.path} [${entry.status}] variants=${variantsFor(entry, options).join(',')}`);
  console.log(`Selected ${selected.length}/${inventory.modules.length} modules. Other modules are not claimed as tested.`);
  if (options.list) return 0;
  const env = { ...process.env, GOWORK: 'off', GOTOOLCHAIN: 'local', GOFLAGS: '' };
  checkToolchain(options.go, inventory.minimumGoVersion, env);
  const before = manifestSnapshot(repoRoot);
  const outputRoot = mkdtempSync(join(tmpdir(), 'adspilot-go-verify-'));
  const failures = [];
  try {
    for (const [index, entry] of selected.entries()) {
      const cwd = join(repoRoot, entry.path);
      if (options.format) {
        const gofmt = options.go === 'go' ? 'gofmt' : join(dirname(resolve(options.go)), process.platform === 'win32' ? 'gofmt.exe' : 'gofmt');
        const files = actual.sources.filter((path) => isInside(path, entry.path) && !actual.modules.some((module) => module !== entry.path && isInside(module, entry.path) && isInside(path, module)));
        for (const path of files) {
          const source = readFileSync(join(repoRoot, path), 'utf8').replaceAll('\r\n', '\n');
          // Compare canonical text so Git's Windows CRLF checkout is not a
          // formatting failure. gofmt reads stdin and never rewrites a file.
          const result = spawnSync(gofmt, [], { input: source, env, encoding: 'utf8', shell: false, maxBuffer: 8 * 1024 * 1024 });
          if (result.error) throw result.error;
          if (result.status !== 0 || result.stdout.replaceAll('\r\n', '\n') !== source) {
            console.error(result.stderr || `Not gofmt formatted: ${path}`);
            failures.push(`${path}: gofmt`);
          }
        }
      }
      for (const variant of variantsFor(entry, options)) {
        const common = ['-mod=readonly', ...(variant === 'default' ? [] : ['-tags', variant])];
        if (options.test && !run(options.go, ['test', ...common, '-count=1', '-timeout=120s', './...'], cwd, env)) failures.push(`${entry.path} (${variant}): test`);
        if (options.build) {
          const output = join(outputRoot, String(index), variant);
          mkdirSync(output, { recursive: true });
          // -o <directory> prevents executable artifacts in the checkout, but
          // Go rejects that flag when a module contains libraries only.
          const packages = spawnSync(options.go, ['list', ...common, '-f', '{{.Name}}', './...'], { cwd, env, encoding: 'utf8', shell: false });
          if (packages.error) throw packages.error;
          if (packages.status !== 0) {
            console.error(packages.stderr || packages.stdout);
            failures.push(`${entry.path} (${variant}): package discovery`);
            continue;
          }
          const hasMain = packages.stdout.trim().split(/\s+/).includes('main');
          if (!hasMain) console.log(`${entry.path}: library-only module (not a runnable service)`);
          if (!run(options.go, ['build', ...common, ...(hasMain ? ['-o', output + sep] : []), './...'], cwd, env)) failures.push(`${entry.path} (${variant}): build`);
        }
      }
    }
  } finally {
    // Only this verifier's mkdtemp-created directory is removed.
    rmSync(outputRoot, { recursive: true, force: true });
    assertUnchanged(before, repoRoot);
  }
  if (failures.length) {
    console.error(`Verification failed (${failures.length}):\n${failures.join('\n')}`);
    return 1;
  }
  console.log(`Passed selected checks for ${selected.length} modules; module manifests unchanged.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
