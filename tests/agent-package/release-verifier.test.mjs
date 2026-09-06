import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReleaseOptions, releaseChecks, runReleaseChecks } from '../../scripts/verify-release.mjs';

test('release verifier fails fast and never claims skipped checks passed', () => {
  let calls = 0;
  const checks = [{ name: 'first', command: 'fixture', args: [] }, { name: 'second', command: 'fixture', args: [] }];
  const result = runReleaseChecks(checks, { runner: () => { calls++; return { status: 7 }; } });
  assert.equal(calls, 1); assert.equal(result.ok, false); assert.deepEqual(result.skipped, ['second']);
  assert.equal(result.results[0].exit_code, 7);
});
test('missing command, signal and timeout are not successful completion', () => {
  for (const output of [{ status: null, error: new Error('ENOENT') }, { status: null, signal: 'SIGTERM' }, { status: 0, error: new Error('ETIMEDOUT') }]) {
    assert.equal(runReleaseChecks([{ name: 'fixture', command: 'fixture', args: [] }], { runner: () => output }).ok, false);
  }
});
test('release command includes discovered tests and strict Python gates without install or packaging', () => {
  const checks = releaseChecks(parseReleaseOptions(['--python', 'custom-python', '--ilang-cache', 'cached-spec']));
  assert.equal(checks.length, 5);
  assert.ok(checks[2].args.includes('tests/agent-package/host-contract.test.mjs'));
  assert.deepEqual(checks[3].args, ['scripts/verify-ilang.py', '--cache', 'cached-spec']);
  assert.equal(checks[3].command, 'custom-python');
  assert.ok(checks.every(c => !c.args.some(a => ['install', 'package-agent.py', 'tidy'].includes(a))));
});
test('optional adapter checks are explicit and CLI rejects misspelled options', () => {
  const checks = releaseChecks(parseReleaseOptions(['--adapters', '--go', 'portable-go']));
  assert.equal(checks.length, 6); assert.equal(checks[5].args.at(-1), 'portable-go');
  assert.throws(() => parseReleaseOptions(['--adapter']));
  assert.throws(() => parseReleaseOptions(['--python']));
});
test('release runner uses argument arrays without a shell and preserves output evidence', () => {
  const outputs = [];
  const result = runReleaseChecks([{ name: 'fixture', command: 'path with spaces', args: ['a b'] }], {
    runner(command, args, options) { assert.equal(options.shell, false); assert.deepEqual(args, ['a b']); return { status: 0, stdout: 'passed', stderr: '' }; },
    onOutput: (...args) => outputs.push(args)
  });
  assert.equal(result.ok, true); assert.deepEqual(outputs, [['fixture', 'passed', '']]);
});
