#!/usr/bin/env node
// Developer packaging check. Not part of the shipped, instruction-only skill.
import { readFile, readdir, lstat, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, extname, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContracts } from './verify-agent-contracts.mjs';

export const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../skills/adspilot');
const validatorPinPath = resolve(dirname(fileURLToPath(import.meta.url)), '../config/ilang-validator-pin.json');
const allowedModes = new Set(['instruction', 'read', 'validate', 'write']);
const requiredWriteGuards = ['host.records', 'host.authorization', 'host.input_isolation'];

function inside(root, path) {
  const rel = relative(root, path);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

export async function verifyAgentPackage(root = defaultRoot) {
  root = await realpath(root);
  const errors = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };
  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
  const intake = JSON.parse(await readFile(resolve(root, 'contracts/intake.json'), 'utf8'));
  const recovery = JSON.parse(await readFile(resolve(root, 'contracts/recovery-catalog.json'), 'utf8'));
  const contracts = validateContracts(intake, recovery);
  errors.push(...contracts.errors);
  require(intake.version === manifest.version && recovery.version === manifest.version,
    'Intake/recovery contracts must match the shipped package version');
  const validatorPin = JSON.parse(await readFile(validatorPinPath, 'utf8'));
  require(validatorPin.schema_version === 1 && /^[a-f0-9]{40}$/.test(validatorPin.revision ?? ''),
    'Approved I-Lang validator pin is malformed');
  require(manifest.schema_version === 1, 'Unsupported package schema');
  require(manifest.name === 'adspilot', 'Package name must be adspilot');
  require(/^\d+\.\d+\.\d+$/.test(manifest.version ?? ''), 'Package version must be semver');
  require(manifest.kind === 'instruction-only-agent-skill', 'Package must be instruction-only');
  require(manifest.entrypoint === 'SKILL.md', 'Entrypoint must be SKILL.md');
  for (const key of ['runtime_dependencies', 'install_commands', 'services']) {
    require(Array.isArray(manifest[key]) && manifest[key].length === 0,
      `${key} must be an empty array: users must not run infrastructure`);
  }
  require(manifest.credential_storage === 'host-secret-store', 'Credentials belong to host secret storage');
  require(manifest.protocol?.name === 'I-Lang' && manifest.protocol?.version === '5.0', 'I-Lang v5 profile missing');
  require(manifest.protocol?.source_commit === validatorPin.revision,
    'Protocol source must match the approved, hash-pinned I-Lang validators');
  require(manifest.protocol?.declared_conformance === 'L1', 'Instruction-only package cannot claim runtime enforcement');
  require(manifest.protocol?.enforcement === 'host-provided-not-claimed-by-skill', 'Missing host enforcement boundary');

  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      const rel = relative(root, path).split(sep).join('/');
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) { errors.push(`Symlink is not portable: ${rel}`); continue; }
      if (stat.isDirectory()) { await walk(path); continue; }
      require(stat.isFile(), `Unsupported file type: ${rel}`);
      require(['.md', '.json'].includes(extname(path)), `Executable or unsupported payload: ${rel}`);
      require(stat.size < 1024 * 1024, `Oversized instruction file: ${rel}`);
      files.push(rel);
    }
  }
  await walk(root);
  require(Array.isArray(manifest.files), 'Manifest files must be an array');
  const listed = Array.isArray(manifest.files) ? manifest.files : [];
  require(new Set(listed).size === listed.length, 'Duplicate manifest paths');
  for (const file of listed) {
    require(typeof file === 'string' && !file.includes('\\') && !isAbsolute(file)
      && inside(root, resolve(root, file)), `Unsafe package path: ${file}`);
  }
  require(JSON.stringify([...listed].sort()) === JSON.stringify([...files].sort()),
    'Manifest inventory must exactly match package files');

  const entry = await readFile(resolve(root, 'SKILL.md'), 'utf8');
  const protocolProfile = await readFile(resolve(root, 'references/ilang.md'), 'utf8');
  require(protocolProfile.includes(`\`${validatorPin.revision}\``)
    && protocolProfile.includes(`/blob/${validatorPin.revision}/SPEC.md`),
  'I-Lang profile must cite the approved validator revision');
  const frontmatter = entry.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  require(Boolean(frontmatter), 'Missing YAML frontmatter');
  require(/^name: adspilot\s*$/m.test(frontmatter ?? ''), 'Skill name does not match package');
  require(/^description: .{20,1024}$/m.test(frontmatter ?? ''), 'Missing discriminating description');
  require(frontmatter?.includes(`version: ${manifest.version}`), 'Skill and manifest versions differ');

  for (const file of files.filter(f => f.endsWith('.md'))) {
    const text = await readFile(resolve(root, file), 'utf8');
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = match[1].split('#')[0];
      if (!link || /^https:\/\//.test(link)) continue;
      const target = resolve(root, dirname(file), link);
      require(!isAbsolute(link) && inside(root, target), `Reference escapes package: ${file} -> ${link}`);
      if (inside(root, target)) {
        try { require((await lstat(target)).isFile(), `Missing reference: ${file} -> ${link}`); }
        catch { errors.push(`Missing reference: ${file} -> ${link}`); }
      }
    }
  }

  require(Array.isArray(manifest.capabilities) && manifest.capabilities.length > 0, 'Capabilities missing');
  const capabilityIDs = new Set();
  for (const capability of manifest.capabilities ?? []) {
    require(typeof capability.id === 'string' && !capabilityIDs.has(capability.id), 'Invalid or duplicate capability ID');
    capabilityIDs.add(capability.id);
    require(allowedModes.has(capability.mode), `Unknown mode: ${capability.id}`);
    require(Array.isArray(capability.requires), `Requirements missing: ${capability.id}`);
    if (capability.mode === 'write') {
      for (const guard of requiredWriteGuards) {
        require(capability.requires?.includes(guard), `Write capability lacks ${guard}: ${capability.id}`);
      }
    }
  }
  return { ok: errors.length === 0, errors, files: files.length, version: manifest.version };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifyAgentPackage(process.argv[2]);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    process.stderr.write(`Agent package verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
