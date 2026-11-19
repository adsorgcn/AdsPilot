import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  apply,
  bookDefinition,
  bookPath,
  bookText,
  compareVersions,
  fetchLatestBook,
  handoffScriptPath,
  inject,
  mcpConfigPath,
  name,
  normalize,
  pages,
  part,
  sha256Lf,
  skillContent,
  skillDefinition,
  skillPath,
  splitBook,
  toc,
} from './index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const LIMIT = 8192;
const PART_LIMIT = 8000;
const MARKER = '::ILANG::v5.0::ENGINEERING_BOOK';

const FIXTURE = [
  MARKER,
  '[TYPE:engineering_book]',
  '[ID:FIXTURE-ADSPILOT]',
  '[VERSION:9.9.0]',
  '',
  '::STATE{@USER, role:decision_maker}',
  '',
  '::RULE{a then b|source:test}',
  '',
  '::MODULE{M0_FIRST|title:第一步}',
  '  [STEP] one',
  '',
  '::MODULE{M1_SECOND|title:第二步}',
  '  [STEP] two',
  '',
  '::RUBRIC{S1: ok|check:human}',
  MARKER,
  '',
].join('\n');

function fakeCtx() {
  const skills = [];
  const tools = [];
  let disposed = 0;
  const ctx = {
    skills: { register(s) { skills.push(s); return () => { disposed += 1; }; } },
    tools: { register(t) { tools.push(t); return () => { disposed += 1; }; } },
    logger: { info() {}, warn() {} },
    effect(fn) { ctx._dispose = fn(); },
  };
  return { ctx, skills, tools, disposed: () => disposed };
}

function repoVersion() {
  return fs.readFileSync(path.join(repoRoot, 'VERSION'), 'utf8').trim();
}

function shippedVersion() {
  return /^\[VERSION:([^\]]+)\]/m.exec(bookText())[1].trim();
}

function bump(v, by) {
  const p = v.split('.').map(Number);
  p[p.length - 1] += by;
  return p.join('.');
}

function edition(version, extra = '') {
  return bookText()
    .replace(/\r\n/g, '\n')
    .replace(/^\[VERSION:[^\]]*\]/m, `[VERSION:${version}]`)
    .replace('::MODULE{M0_SETUP', extra + '::MODULE{M0_SETUP');
}

function registryFor(text, over = {}) {
  const version = /^\[VERSION:([^\]]+)\]/m.exec(text)[1];
  return JSON.stringify({
    entries: [
      { kind: 'plugin', name: 'x' },
      { kind: 'book', name: 'adspilot-sem', version, sha256_lf: sha256Lf(text), ...over },
    ],
  });
}

function fakeFetch(site, calls = []) {
  return async (url) => {
    calls.push(url);
    const v = site[url];
    if (v instanceof Error) throw v;
    if (typeof v === 'number') return { ok: false, status: v, text: async () => '' };
    if (v === undefined) return { ok: false, status: 404, text: async () => '' };
    return { ok: true, status: 200, text: async () => v };
  };
}

function slow(fetchImpl, host, ms) {
  return async (url, init) => {
    if (String(url).includes(host)) await new Promise((r) => setTimeout(r, ms));
    return fetchImpl(url, init);
  };
}

test('module shape, package.json and cordis.patch.yml alignment', () => {
  assert.equal(name, 'adspilot');
  assert.deepEqual(inject, ['skills', 'tools']);

  const ver = repoVersion();
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'adspilot');
  assert.equal(pkg.version, ver);
  assert.equal(pkg.main, 'integrations/dsh/index.mjs');
  assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml');
  assert.ok(pkg.repository?.url?.startsWith('https://') || pkg.repository?.url?.startsWith('git+https://'));
  for (const required of ['BOOK.md', 'skills/*.md', 'cordis.patch.yml', 'integrations/dsh/index.mjs', 'LICENSE', 'VERSION']) {
    assert.ok(pkg.files.includes(required), `package.json files missing ${required}`);
  }

  const patch = fs.readFileSync(path.join(repoRoot, 'cordis.patch.yml'), 'utf8');
  assert.ok(patch.includes('- insert:') && patch.includes('id: adspilot') && patch.includes("name: 'adspilot'"));

  assert.ok(fs.existsSync(mcpConfigPath()), 'integrations/dsh/mcp.json missing');
  assert.ok(fs.existsSync(handoffScriptPath()), 'integrations/dsh/handoff.py missing');
  assert.ok(fs.existsSync(path.join(repoRoot, 'LICENSE')), 'root LICENSE missing');
});

test('skill definition is model-loadable, names triggers and keeps under limit', () => {
  const s = skillDefinition();
  const ver = repoVersion();
  assert.equal(s.name, 'sem');
  assert.match(s.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.deepEqual(s.say, ['SEM', '付费投流']);
  assert.equal(s.metadata.version, ver);
  assert.deepEqual(s.metadata.say, ['SEM', '付费投流']);
  assert.ok(s.description.includes('SEM') && s.description.includes('付费投流'));
  assert.ok(s.content.includes('adspilot_book') && s.content.includes('mcp-adspilot'));
  assert.ok(s.content.length > 400 && s.content.length < LIMIT, 'body size ' + s.content.length);
  assert.equal(s.content, skillContent());
  assert.equal(s.content, fs.readFileSync(skillPath(), 'utf8'));

  const kitSkillPath = path.join(repoRoot, '.dsh', 'skills', 'sem', 'SKILL.md');
  assert.ok(fs.existsSync(kitSkillPath), '.dsh/skills/sem/SKILL.md missing');
  const kitSkill = fs.readFileSync(kitSkillPath, 'utf8');
  assert.ok(kitSkill.includes('::ILANG::v5.0') && kitSkill.includes(`version: ${ver}`));
  assert.ok(kitSkill.includes('SEM') && kitSkill.includes('付费投流'));
});

test('shipped BOOK.md has exact double markers, matching version and no double em-dash', () => {
  const t = bookText();
  const ver = repoVersion();
  assert.ok(t.startsWith(MARKER));
  assert.ok(t.trimEnd().endsWith(MARKER));
  const markerLines = t.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() === MARKER);
  assert.equal(markerLines.length, 2, 'BOOK.md must carry exactly 2 ENGINEERING_BOOK markers');
  assert.ok(fs.statSync(bookPath()).size > 8000);
  assert.equal(shippedVersion(), ver);
  assert.ok(/^\[ID:ADSPILOT-SEM\]$/m.test(t));

  for (const rel of [
    'BOOK.md',
    'skills/sem.md',
    '.dsh/skills/sem/SKILL.md',
    'package.json',
    'cordis.patch.yml',
    'integrations/dsh/index.mjs',
    'integrations/dsh/plugin.test.mjs',
  ]) {
    const content = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    assert.ok(!content.includes('\u2014\u2014'), `${rel} must not contain double em-dash`);
  }
});

test('splitBook: head / modules / tail, nothing lost, every page under PART_LIMIT and joins back', () => {
  for (const text of [FIXTURE, bookText()]) {
    const b = splitBook(text);
    assert.ok(b.modules.length >= 2, 'modules ' + b.modules.length);
    assert.ok(b.head.includes('::') && b.tail.includes('::RUBRIC'));
    const rebuilt = [b.head, ...b.modules.map((m) => m.text), b.tail].join('\n');
    const norm = (s) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd()).filter(Boolean).join('\n');
    assert.equal(norm(rebuilt), norm(text), 'parts do not add up to the book');
    for (const [label, s] of [['head', b.head], ['tail', b.tail], ...b.modules.map((m) => [m.id, m.text])]) {
      const ps = pages(s);
      for (const p of ps) {
        assert.ok(p.length <= PART_LIMIT, `${label} page is ${p.length} chars`);
      }
      assert.equal(ps.join('\n'), s, `${label} pages do not join back`);
    }
  }
});

test('pages: a 20000-char module pages at block boundaries, toc labels pages, M#2 works, M#9 errors', () => {
  const steps = [];
  let n = 0;
  while (steps.join('\n').length < 20000) {
    n += 1;
    steps.push(`  [STEP] ${n} ${'x'.repeat(190)}`);
    steps.push('');
  }
  const text = `${MARKER}\n[TYPE:engineering_book]\n[ID:PAGES-BOOK]\n[VERSION:1.0.0]\n\n`
    + '::STATE{@USER}\n  role: user\n\n'
    + '::MODULE{M|title:很长的一段}\n' + steps.join('\n') + '\n'
    + `::RUBRIC{S1: ok|check:human}\n${MARKER}\n`;
  const b = splitBook(text);
  const M = b.modules.find((x) => x.id === 'M');
  assert.ok(M.text.length > PART_LIMIT, 'module should exceed the limit, got ' + M.text.length);
  const ps = pages(M.text);
  assert.ok(ps.length >= 2, 'pages ' + ps.length);
  assert.equal(ps.join('\n'), M.text, 'pages do not join back');
  const t = toc(b);
  assert.ok(t.includes(`${ps.length} 页 M#1 到 M#${ps.length}`), 'toc lacks page labels: ' + t);
  const p1 = part(b, 'M#1');
  const p2 = part(b, 'M#2');
  assert.ok(p1.length <= PART_LIMIT && p2.length <= PART_LIMIT, `pages over limit: ${p1.length}/${p2.length}`);
  const first = part(b, 'M');
  assert.ok(first.includes('这段共') && first.includes('接着取 M#2'), 'first page lacks the hint: ' + first.slice(0, 120));
  assert.throws(() => part(b, 'M#9'), /没有第 9 页/);
});

test('shipped BOOK.md modules are addressable and toc lists all six steps', () => {
  const b = splitBook(bookText());
  const wantIds = ['M0_SETUP', 'M1_LAUNCH_OFFER', 'M2_LP_CAMPAIGN', 'M3_DAILY_LOOP', 'M4_CALIBRATE_PLUGINS', 'M5_REPORT'];
  assert.deepEqual(b.modules.map((m) => m.id), wantIds);
  const t = toc(b, ['- extra line']);
  for (const id of ['head', ...wantIds, 'tail', 'extra line']) assert.ok(t.includes(id), 'toc lacks ' + id);
  assert.equal(part(b, 'toc'), null);
  assert.ok(part(b, 'm0_setup').startsWith('::MODULE{M0_SETUP'));
  assert.throws(() => part(b, 'NOPE'), /没有叫/);
});

test('normalize: defaults and https-only bookSources', () => {
  const o = normalize({});
  assert.equal(o.liveBook, true);
  assert.deepEqual(o.bookSources.map((s) => s.name), ['GitHub', 'Gitee']);
  for (const s of o.bookSources) {
    assert.ok(s.registry.endsWith('/docs/market/registry.json'));
    assert.ok(s.book.endsWith('/.dsh/books/adspilot-sem/BOOK.md'));
  }
  assert.throws(() => normalize({ bookSources: [{ name: 'x', registry: 'http://x/r.json', book: 'https://x/b.md' }] }), /https/);
  assert.throws(() => normalize({ bookSources: [{ name: 'x', registry: 'https://x/r.json', book: 'http://x/b.md' }] }), /https/);
});

test('apply registers one skill (sem) and one tool (adspilot_book), dispose removes both', () => {
  const { ctx, skills, tools, disposed } = fakeCtx();
  apply(ctx, { liveBook: false });
  assert.deepEqual(skills.map((s) => s.name), ['sem']);
  assert.deepEqual(tools.map((t) => t.name), ['adspilot_book']);
  ctx._dispose();
  assert.equal(disposed(), 2);
});

test('adspilot_book: offline toc by default, parts on request, renders paths and content', async () => {
  const tool = bookDefinition(normalize({ liveBook: false }), async () => {
    throw new Error('the switch is off, nothing may be fetched');
  });
  const t = (await tool.execute({}, {})).content[0].text;
  assert.ok(t.includes('M0_SETUP') && t.includes('M5_REPORT'));
  assert.ok(t.includes('插件里带的'), 'toc must say which copy is in use');
  assert.ok(t.includes(mcpConfigPath()) && t.includes(handoffScriptPath()));
  const head = (await tool.execute({ part: 'head' }, {})).content[0].text;
  assert.ok(head.startsWith(MARKER) && head.length < LIMIT);
  const ring = (await tool.execute({ part: 'M3_DAILY_LOOP' }, {})).content[0].text;
  assert.ok(ring.startsWith('::MODULE{M3_DAILY_LOOP') && ring.length < LIMIT);
  assert.equal(tool.output.render({}, { content: [{ type: 'text', text: 'x' }] })[0].text, 'x');
});

const SOURCES = [
  { name: 'A', registry: 'https://a.example/registry.json', book: 'https://a.example/BOOK.md' },
  { name: 'B', registry: 'https://b.example/registry.json', book: 'https://b.example/BOOK.md' },
];

test('compareVersions orders dotted numbers', () => {
  assert.equal(compareVersions('2.2.10', '2.2.9'), 1);
  assert.equal(compareVersions('2.2.0', '2.2.0'), 0);
  assert.equal(compareVersions('2.2', '2.2.1'), -1);
});

test('live book: a newer edition whose digest matches the registry is served, and fetched once', async () => {
  const nextVer = bump(shippedVersion(), 1);
  const newer = edition(nextVer, '::RULE{live_marker then 这一行只在新版里|source:test}\n\n');
  const calls = [];
  const site = {
    [SOURCES[0].registry]: registryFor(newer),
    [SOURCES[0].book]: newer,
    [SOURCES[1].registry]: new Error('offline'),
    [SOURCES[1].book]: new Error('offline'),
  };
  const tool = bookDefinition(normalize({ bookSources: SOURCES }), fakeFetch(site, calls));
  const t = (await tool.execute({}, {})).content[0].text;
  assert.ok(t.includes(`版本 ${nextVer}`), 'toc should show live version: ' + t.split('\n')[0]);
  assert.ok(t.includes('从 A 取的最新版') && t.includes('摘要核对过'));
  let head = (await tool.execute({ part: 'head' }, {})).content[0].text;
  if (head.includes('接着取 head#2')) head += (await tool.execute({ part: 'head#2' }, {})).content[0].text;
  assert.ok(head.includes('live_marker'));
  const n = calls.length;
  await tool.execute({ part: 'tail' }, {});
  assert.equal(calls.length, n, 'later parts come from the cache');
});

test('live book: a source whose book does not match its registry is refused, other source is used', async () => {
  const good = edition(bump(shippedVersion(), 2));
  const tampered = good.replace('::MODULE{M0_SETUP', '::RULE{x then 被改过|source:nobody}\n\n::MODULE{M0_SETUP');
  const site = {
    [SOURCES[0].registry]: registryFor(good),
    [SOURCES[0].book]: tampered,
    [SOURCES[1].registry]: registryFor(good),
    [SOURCES[1].book]: good,
  };
  const live = await fetchLatestBook(normalize({ bookSources: SOURCES }), fakeFetch(site));
  assert.equal(live.source, 'B');
  assert.equal(live.text, good);
});

test('live book: wrong version, incomplete book, missing row, bad json or HTTP error: each is refused', async () => {
  const good = edition(bump(shippedVersion(), 1));
  const o = normalize({ bookSources: [SOURCES[0]] });
  const cases = [
    [{ [SOURCES[0].registry]: registryFor(good, { version: '9.9.9' }), [SOURCES[0].book]: good }, /版本对不上/],
    [{ [SOURCES[0].registry]: registryFor(good), [SOURCES[0].book]: good.slice(0, 3000) }, /不是完整的工程书/],
    [{ [SOURCES[0].registry]: JSON.stringify({ entries: [] }), [SOURCES[0].book]: good }, /清单里没有这本书/],
    [{ [SOURCES[0].registry]: '<html>', [SOURCES[0].book]: good }, /清单没取到/],
    [{ [SOURCES[0].registry]: registryFor(good), [SOURCES[0].book]: 503 }, /书没取到（HTTP 503）/],
  ];
  for (const [site, pattern] of cases) {
    await assert.rejects(fetchLatestBook(o, fakeFetch(site)), pattern);
  }
});

test('live book: nothing reachable or older edition online falls back cleanly to shipped copy', async () => {
  const down = { [SOURCES[0].registry]: new Error('ENOTFOUND'), [SOURCES[1].registry]: 500 };
  const t1 = (await bookDefinition(normalize({ bookSources: SOURCES }), fakeFetch(down)).execute({}, {})).content[0].text;
  assert.ok(t1.includes(`版本 ${shippedVersion()}`) && t1.includes('这次没取到') && t1.includes('不影响照着做'));

  const older = edition('0.0.1');
  const old = { [SOURCES[0].registry]: registryFor(older), [SOURCES[0].book]: older, [SOURCES[1].registry]: 500 };
  const t2 = (await bookDefinition(normalize({ bookSources: SOURCES }), fakeFetch(old)).execute({}, {})).content[0].text;
  assert.ok(t2.includes(`版本 ${shippedVersion()}`) && t2.includes('比它旧'));
});

test('live book: of two verified sources, higher version wins; equal version picks first; graceMs caps slow mirrors', async () => {
  const older = edition(bump(shippedVersion(), 1));
  const newer = edition(bump(shippedVersion(), 2));
  const site = {
    [SOURCES[0].registry]: registryFor(older),
    [SOURCES[0].book]: older,
    [SOURCES[1].registry]: registryFor(newer),
    [SOURCES[1].book]: newer,
  };
  const o = normalize({ bookSources: SOURCES, graceMs: 2000 });
  const live = await fetchLatestBook(o, slow(fakeFetch(site), 'b.example', 40));
  assert.equal(live.source, 'B');
  assert.equal(live.version, bump(shippedVersion(), 2));

  const t0 = Date.now();
  const fastOnly = await fetchLatestBook(normalize({ bookSources: SOURCES, graceMs: 30 }), slow(fakeFetch(site), 'b.example', 600));
  assert.equal(fastOnly.source, 'A');
  assert.ok(Date.now() - t0 < 500);

  const same = {
    [SOURCES[0].registry]: registryFor(newer),
    [SOURCES[0].book]: newer,
    [SOURCES[1].registry]: registryFor(newer),
    [SOURCES[1].book]: newer,
  };
  const tie = await fetchLatestBook(normalize({ bookSources: SOURCES, graceMs: 2000 }), slow(fakeFetch(same), 'a.example', 40));
  assert.equal(tie.source, 'B');

  const t1 = Date.now();
  const lone = { [SOURCES[0].registry]: registryFor(newer), [SOURCES[0].book]: newer, [SOURCES[1].registry]: 500 };
  assert.equal((await fetchLatestBook(normalize({ bookSources: SOURCES, graceMs: 2000 }), fakeFetch(lone))).source, 'A');
  assert.ok(Date.now() - t1 < 1000);
});

test('live book: choice is cached one hour, then re-fetched after expiry', async () => {
  const newer = edition(bump(shippedVersion(), 1));
  const calls = [];
  const site = { [SOURCES[0].registry]: registryFor(newer), [SOURCES[0].book]: newer, [SOURCES[1].registry]: 500 };
  const tool = bookDefinition(normalize({ bookSources: SOURCES }), fakeFetch(site, calls));
  const realNow = Date.now;
  let fakeNow = realNow();
  Date.now = () => fakeNow;
  try {
    await tool.execute({}, {});
    const n = calls.length;
    fakeNow += 59 * 60 * 1000;
    await tool.execute({}, {});
    assert.equal(calls.length, n, 'within the hour the cached choice is used');
    fakeNow += 2 * 60 * 1000;
    await tool.execute({}, {});
    assert.ok(calls.length > n, 'after an hour the sources are asked again');
  } finally {
    Date.now = realNow;
  }
});
