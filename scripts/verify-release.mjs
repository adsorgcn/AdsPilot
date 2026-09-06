#!/usr/bin/env node
// One non-installing developer verification entrypoint; never a user runtime.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const releaseRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function parseReleaseOptions(args) {
  const options = { python: process.env.ADSPILOT_PYTHON || 'python', adapters: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--adapters') options.adapters = true;
    else if (['--python', '--ilang-cache', '--go'].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      options[arg.slice(2).replace('-', '_')] = value;
    } else throw new Error(`Unknown release verification option: ${arg}`);
  }
  return options;
}

export function releaseChecks(options, root = releaseRoot) {
  const node = process.execPath;
  const tests = readdirSync(resolve(root, 'tests/agent-package')).filter(n => n.endsWith('.test.mjs'))
    .sort().map(n => `tests/agent-package/${n}`);
  if (tests.length === 0) throw new Error('No primary regression tests discovered');
  const checks = [
    { name: 'Instruction package and all contracts', command: node, args: ['scripts/verify-agent-package.mjs'] },
    { name: 'Complete Go source inventory', command: node, args: ['scripts/verify-go.mjs', '--inventory-only'] },
    { name: 'Node workflow and failure-handling tests', command: node, args: ['--test', ...tests, 'scripts/verify-go.test.mjs'] },
    { name: 'Pinned official I-Lang validators', command: options.python, args: ['scripts/verify-ilang.py', ...(options.ilang_cache ? ['--cache', options.ilang_cache] : [])] },
    { name: 'I-Lang gate failure-handling tests', command: options.python, args: ['-B', '-m', 'unittest', 'discover', '-s', 'tests/agent-package', '-p', 'test_*.py'] }
  ];
  if (options.adapters) checks.push({ name: 'Optional active Go adapters, default and live', command: node,
    args: ['scripts/verify-go.mjs', '--scope', 'adapters', ...(options.go ? ['--go', options.go] : [])] });
  return checks;
}

export function runReleaseChecks(checks, { runner = spawnSync, root = releaseRoot, onOutput = () => {} } = {}) {
  const results = [];
  for (const check of checks) {
    const result = runner(check.command, check.args, { cwd: root, shell: false, encoding: 'utf8',
      timeout: 15 * 60_000, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, GOMAXPROCS: process.env.GOMAXPROCS || '2' } });
    onOutput(check.name, result.stdout || '', result.stderr || '');
    const passed = !result.error && !result.signal && result.status === 0;
    results.push({ name: check.name, passed, exit_code: result.status ?? null,
      ...(result.error ? { error: result.error.message } : {}), ...(result.signal ? { signal: result.signal } : {}) });
    if (!passed) return { ok: false, results, skipped: checks.slice(results.length).map(c => c.name),
      scope: 'development verification only; no live provider or universal host certification' };
  }
  return { ok: true, results, skipped: [], scope: 'development verification only; no live provider or universal host certification' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = runReleaseChecks(releaseChecks(parseReleaseOptions(process.argv.slice(2))), {
      onOutput(name, stdout, stderr) {
        process.stdout.write(`\n${name}\n${stdout}`);
        if (stderr) process.stderr.write(stderr);
      }
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) { process.stderr.write(`Release verification failed: ${error.message}\n`); process.exitCode = 1; }
}
