/**
 * adspilot — SEM / 付费投流 for DeepSeek Harness.
 *
 * Registers one runtime skill (`sem`, loaded when the user says SEM or 付费投流)
 * and one Engineering Book pagination tool (`adspilot_book`), following DSH's
 * 8192-character tool-output ceiling and Toolkit 3.1 credential-isolation model.
 * No user secrets live inside this package; execution scripts stay in the
 * user's cloned AdsPilot repository and run via `mcp-adspilot` or CLI.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'adspilot';
export const inject = ['skills', 'tools'];

const SKILL_NAME = 'sem';
const BOOK_NAME = 'adspilot-sem';
const MARKER = '::ILANG::v5.0::ENGINEERING_BOOK';
const PART_LIMIT = 8000;
const LIVE_MS = 60 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 8_000;
const GRACE_MS = 1_500;

const DEFAULT_BOOK_SOURCES = [
  {
    name: 'GitHub',
    registry: 'https://raw.githubusercontent.com/adsorgcn/DeepSeekHarness/main/docs/market/registry.json',
    book: 'https://raw.githubusercontent.com/adsorgcn/DeepSeekHarness/main/.dsh/books/adspilot-sem/BOOK.md',
  },
  {
    name: 'Gitee',
    registry: 'https://gitee.com/monetize/DeepSeekHarness/raw/main/docs/market/registry.json',
    book: 'https://gitee.com/monetize/DeepSeekHarness/raw/main/.dsh/books/adspilot-sem/BOOK.md',
  },
];

function here() {
  return path.dirname(fileURLToPath(import.meta.url));
}

function pkgRoot() {
  return path.resolve(here(), '..', '..');
}

function readVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(pkgRoot(), 'package.json'), 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const VERSION = readVersion();

export function bookPath() {
  return path.join(pkgRoot(), 'BOOK.md');
}

export function skillPath() {
  return path.join(pkgRoot(), 'skills', `${SKILL_NAME}.md`);
}

export function mcpConfigPath() {
  return path.join(pkgRoot(), 'integrations', 'dsh', 'mcp.json');
}

export function handoffScriptPath() {
  return path.join(pkgRoot(), 'integrations', 'dsh', 'handoff.py');
}

export function bookText() {
  return fs.readFileSync(bookPath(), 'utf8');
}

export function skillContent() {
  return fs.readFileSync(skillPath(), 'utf8');
}

export function normalize(config = {}) {
  const liveBook = config.liveBook !== false;
  const bookSources = Array.isArray(config.bookSources) && config.bookSources.length
    ? config.bookSources
    : DEFAULT_BOOK_SOURCES;
  for (const s of bookSources) {
    if (!/^https:\/\//.test(String(s?.registry)) || !/^https:\/\//.test(String(s?.book))) {
      throw new Error('adspilot: bookSources must be https');
    }
  }
  const timeoutMs = Number(config.timeoutMs ?? TIMEOUT_MS);
  const graceMs = Number(config.graceMs ?? GRACE_MS);
  return {
    liveBook,
    bookSources,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : TIMEOUT_MS,
    graceMs: Number.isFinite(graceMs) && graceMs >= 0 ? graceMs : GRACE_MS,
  };
}

/* ---------- book splitting & pagination ---------- */

export function splitBook(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('::') && !l.startsWith(MARKER)) starts.push(i);
  }
  const blocks = starts.map((s, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    const header = lines[s];
    const m = /^::([A-Z]+)\{([^|}]*)/.exec(header);
    return {
      kind: m ? m[1] : 'BLOCK',
      id: m ? m[2].trim() : header.slice(2, 40),
      start: s,
      end,
      text: lines.slice(s, end).join('\n').replace(/\n+$/, ''),
    };
  });
  const firstModule = blocks.findIndex((b) => b.kind === 'MODULE');
  const lastModule = blocks.map((b) => b.kind).lastIndexOf('MODULE');
  const preamble = lines.slice(0, blocks.length ? blocks[0].start : lines.length).join('\n').replace(/\n+$/, '');
  const headBlocks = firstModule < 0 ? blocks : blocks.slice(0, firstModule);
  const modules = firstModule < 0 ? [] : blocks.slice(firstModule, lastModule + 1).filter((b) => b.kind === 'MODULE');
  const tailBlocks = firstModule < 0 ? [] : blocks.slice(lastModule + 1);
  const head = [preamble, ...headBlocks.map((b) => b.text)].filter(Boolean).join('\n\n');
  const tail = tailBlocks.map((b) => b.text).join('\n\n');
  const title = (/^\[ID:([^\]]+)\]/m.exec(text) || [])[1] || '';
  const version = (/^\[VERSION:([^\]]+)\]/m.exec(text) || [])[1] || '';
  return { title, version, head, modules, tail, chars: text.length };
}

function moduleTitle(b) {
  const m = /\|title:([^|}]*)/.exec(b.text.split('\n')[0]);
  return m ? m[1].trim() : '';
}

export function pages(text) {
  if (text.length <= PART_LIMIT) return [text];
  const lines = text.split('\n');
  const out = [];
  let cur = [];
  let curLen = 0;
  const flush = () => {
    if (cur.length) {
      out.push(cur.join('\n'));
      cur = [];
      curLen = 0;
    }
  };
  for (const line of lines) {
    const lineLen = line.length + 1;
    const isBoundary = line.startsWith('::') || line.trim() === '';
    if (cur.length && curLen + lineLen > PART_LIMIT) {
      if (isBoundary) {
        flush();
      } else {
        let k = cur.length - 1;
        while (k >= 0 && cur[k].trim() !== '') k--;
        if (k >= 0) {
          const carry = cur.slice(k);
          cur = cur.slice(0, k);
          flush();
          cur = carry.slice();
          curLen = carry.reduce((a, l) => a + l.length + 1, 0);
        } else {
          out.push(cur.join('\n') + '\n[adspilot: 本页在块中间切开 下一页接着]');
          cur = [];
          curLen = 0;
        }
      }
    }
    cur.push(line);
    curLen += lineLen;
  }
  flush();
  return out;
}

export function toc(book, extra = []) {
  const out = [];
  out.push(`书：${book.title || '?'}  版本 ${book.version || '?'}  共 ${book.chars} 字符；一次取一段，part 填下面的名字。`);
  const headPages = pages(book.head);
  const headInfo = headPages.length > 1 ? `，${headPages.length} 页 head#1 到 head#${headPages.length}` : '';
  out.push(`- head  （${book.head.length} 字符${headInfo}）：角色、目标、边界、规矩。先读它。`);
  for (const b of book.modules) {
    const t = moduleTitle(b);
    const ps = pages(b.text);
    const pageInfo = ps.length > 1 ? `，${ps.length} 页 ${b.id}#1 到 ${b.id}#${ps.length}` : '';
    out.push(`- ${b.id}  （${b.text.length} 字符${pageInfo}）${t ? '：' + t : ''}`);
  }
  const tailPages = pages(book.tail);
  const tailInfo = tailPages.length > 1 ? `，${tailPages.length} 页 tail#1 到 tail#${tailPages.length}` : '';
  out.push(`- tail  （${book.tail.length} 字符${tailInfo}）：验收项（RUBRIC）、兜底（FALLBACK）、优先级。每一环做完对照一次。`);
  for (const line of extra) out.push(line);
  out.push('顺序：head → 模块按列出的次序 → tail。');
  return out.join('\n');
}

export function part(book, which) {
  const w = String(which || 'toc').trim();
  if (w === 'toc') return null;
  const hashIdx = w.indexOf('#');
  const base = (hashIdx < 0 ? w : w.slice(0, hashIdx)).trim();
  const pageNo = hashIdx < 0 ? null : parseInt(w.slice(hashIdx + 1).trim(), 10);
  let full;
  if (base === 'head') full = book.head;
  else if (base === 'tail') full = book.tail;
  else {
    const b = book.modules.find((x) => x.id === base || x.id.toLowerCase() === base.toLowerCase());
    full = b ? b.text : undefined;
  }
  if (full === undefined) {
    const ids = book.modules.map((x) => x.id).join('、');
    throw new Error(`adspilot: 没有叫「${w}」的段。可取的是 toc、head、tail 和模块：${ids}`);
  }
  const ps = pages(full);
  if (pageNo !== null) {
    if (!Number.isInteger(pageNo) || pageNo < 1 || pageNo > ps.length) {
      throw new Error(`adspilot: 没有第 ${pageNo} 页。可取的是 ${base}#1 到 ${base}#${ps.length}。`);
    }
    return ps[pageNo - 1];
  }
  if (ps.length > 1) return ps[0] + `\n[adspilot: 这段共 ${ps.length} 页 接着取 ${base}#2]`;
  return ps[0];
}

function render(text, segment) {
  const limit = PART_LIMIT + 100;
  if (text.length > limit) {
    return text.slice(0, PART_LIMIT) + `\n\n[adspilot: ${segment} 超过 ${PART_LIMIT} 字符，这里截断了；请按 toc 一段一段取]`;
  }
  return text;
}

/* ---------- integrity & live edition check ---------- */

export function sha256Lf(text) {
  return createHash('sha256').update(String(text).replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

function bookVersion(text) {
  return (/^\[VERSION:([^\]\n]+)\]/m.exec(text) || [])[1]?.trim() || '';
}

export function compareVersions(a, b) {
  const pa = String(a).split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

async function getText(url, fetchImpl, timeoutMs, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'text/plain, application/json;q=0.9, */*;q=0.1', 'User-Agent': 'adspilot/' + VERSION },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } catch (err) {
    const cause = err?.cause?.code ?? err?.code ?? (err?.name === 'AbortError' ? '超时' : err?.message ?? String(err));
    throw new Error(String(cause));
  } finally {
    clearTimeout(timer);
  }
}

async function bookFromSource(source, fetchImpl, timeoutMs, signal) {
  let row;
  try {
    const reg = JSON.parse(await getText(source.registry, fetchImpl, timeoutMs, signal));
    row = (Array.isArray(reg?.entries) ? reg.entries : []).find((e) => e?.kind === 'book' && e?.name === BOOK_NAME);
  } catch (err) {
    throw new Error(`${source.name} 清单没取到（${err.message}）`);
  }
  if (!row || typeof row.sha256_lf !== 'string' || typeof row.version !== 'string') {
    throw new Error(`${source.name} 清单里没有这本书`);
  }
  let text;
  try {
    text = await getText(source.book, fetchImpl, timeoutMs, signal);
  } catch (err) {
    throw new Error(`${source.name} 书没取到（${err.message}）`);
  }
  const t = text.replace(/\r\n/g, '\n');
  if (!t.startsWith(MARKER) || !t.trimEnd().endsWith(MARKER)) {
    throw new Error(`${source.name} 取回的不是完整的工程书`);
  }
  if (bookVersion(t) !== row.version) {
    throw new Error(`${source.name} 书和清单的版本对不上`);
  }
  if (sha256Lf(t) !== row.sha256_lf) {
    throw new Error(`${source.name} 书的摘要和清单对不上`);
  }
  return { text: t, version: row.version, source: source.name };
}

export async function fetchLatestBook(options, fetchImpl = globalThis.fetch, signal) {
  const tries = options.bookSources.map((s) => bookFromSource(s, fetchImpl, options.timeoutMs, signal));
  const verified = [];
  const settled = Promise.all(tries.map((p) => p.then((v) => { verified.push(v); }, () => {})));
  try {
    await Promise.any(tries);
  } catch (err) {
    const reasons = (err?.errors ?? [err]).map((e) => e?.message ?? String(e));
    throw new Error(reasons.join('；'));
  }
  if (tries.length > 1) {
    let timer;
    const grace = new Promise((resolve) => { timer = setTimeout(resolve, options.graceMs ?? GRACE_MS); });
    await Promise.race([settled, grace]);
    clearTimeout(timer);
  }
  let best = verified[0];
  for (const v of verified) {
    if (compareVersions(v.version, best.version) > 0) best = v;
  }
  return best;
}

/* ---------- tool + skill + cordis entry ---------- */

export function bookDefinition(options = normalize({}), fetchImpl) {
  let cached = null; // { at, ttl, text, note }
  async function current(signal) {
    if (cached && Date.now() - cached.at < cached.ttl) return cached;
    const shipped = bookText();
    const shippedVersion = bookVersion(shipped);
    let pick = { ttl: LIVE_MS, text: shipped, note: `- 这本书用的是插件里带的 ${shippedVersion} 版。` };
    if (options.liveBook) {
      try {
        const live = await fetchLatestBook(options, fetchImpl ?? globalThis.fetch, signal);
        if (compareVersions(live.version, shippedVersion) >= 0) {
          pick = {
            ttl: LIVE_MS,
            text: live.text,
            note: `- 这本书是刚从 ${live.source} 取的最新版 ${live.version}，摘要核对过；插件里带的是 ${shippedVersion}。`,
          };
        } else {
          pick.note = `- 这本书用的是插件里带的 ${shippedVersion} 版（在线的 ${live.version} 比它旧）。`;
        }
      } catch (err) {
        pick = {
          ttl: RETRY_MS,
          text: shipped,
          note: `- 这本书用的是插件里带的 ${shippedVersion} 版；在线的最新版这次没取到（${err.message}），不影响照着做。`,
        };
      }
    }
    cached = { at: Date.now(), ...pick };
    return cached;
  }

  return {
    name: 'adspilot_book',
    description: '取「SEM / 付费投流」工程书（AdsPilot：装机与凭据账本、建落地位与选品第一条、建系列与点击闭环、无人值守日循环与双轨哨兵、7 天验收与校准、状态汇报）。书随包带着；联网时可从镜像核对清单摘要取最新版，取不到就用包内自带的那份。先 part=toc 看目录，再按段取：head、M0_SETUP..M5_REPORT、tail。只在 sem 技能让你取的时候调用。',
    parameters: {
      type: 'object',
      properties: {
        part: {
          type: 'string',
          description: 'toc（目录，默认）、head、tail，或模块名（如 M0_SETUP）；多页时写 段名#页号',
        },
      },
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: { content: { type: 'array', items: {} } },
        required: ['content'],
        additionalProperties: false,
      },
      render(_args, value) { return value.content; },
    },
    async execute(args, exec) {
      const cur = await current(exec?.signal);
      const book = splitBook(cur.text);
      const which = args?.part;
      const extra = [
        cur.note,
        `- 本地 MCP 配置模板在：${mcpConfigPath()}（需接入 mcp-adspilot，指向用户自己克隆的 AdsPilot/core/agent/mcp_server.py）。`,
        `- DSH 记忆交接脚本在：${handoffScriptPath()}（或调用 mcp-adspilot 工具 dsh.handoff）。`,
      ];
      const text = part(book, which);
      return { content: [{ type: 'text', text: text === null ? toc(book, extra) : render(text, String(which)) }] };
    },
  };
}

export function skillDefinition() {
  return {
    name: SKILL_NAME,
    description: 'SEM 与付费投流（AdsPilot）：用户说「SEM」或「付费投流」、想在自有 Google Ads 与联盟账号下做落地页、选品投放、转化回传与无人值守日循环时加载。通过 adspilot_book 按环推进，结合本地 mcp-adspilot 或脚本执行。',
    whenToUse: '用户提到 SEM、付费投流、AdsPilot、Google Ads 联盟投放、开局建站或日常循环时。',
    say: ['SEM', '付费投流'],
    source: 'runtime',
    content: skillContent(),
    metadata: { plugin: 'adspilot', version: VERSION, say: ['SEM', '付费投流'] },
  };
}

export function apply(ctx, config = {}) {
  const options = normalize(config);
  ctx.effect(() => {
    const disposers = [];
    try {
      disposers.push(ctx.skills.register(skillDefinition()));
      disposers.push(ctx.tools.register(bookDefinition(options)));
      ctx.logger?.info?.('adspilot: skill ' + SKILL_NAME + ' and tool adspilot_book registered');
    } catch (err) {
      for (const d of disposers) { try { d(); } catch { /* ignore */ } }
      throw err;
    }
    return () => { for (const d of disposers) { try { d(); } catch { /* ignore */ } } };
  });
}
