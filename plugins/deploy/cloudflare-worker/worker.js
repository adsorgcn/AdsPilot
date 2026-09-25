/*
 * AdsPilot 中转（Cloudflare Worker）· 部署在用户自有域名下
 *
 * 三个路由，不多不少：
 *   GET /go?o=<offer_ref>&gclid=..&gbraid=..&wbraid=..&c=..&a=..&k=..&n=..&p=..
 *       铸一个 20 位 token，把映射（token -> gclid、campaign、adgroup、keyword、network、page、ts、offer）存进 KV，
 *       然后 302 到该 offer 的联盟链接并带上 <param>=<token>（CJ 是 sid）。对所有访客一视同仁，不看 UA，不看 IP，不改去向。
 *   GET /export?since=<ISO>            Authorization: Bearer <EXPORT_KEY>，返回 JSONL，主干 subid.py pull 拉回本地账本
 *   GET /health                        {"ok":true,"version":"2.0.0"}
 *
 * 绑定（wrangler.toml）：KV 命名空间 MAPPINGS；变量 OFFERS（JSON 字符串）；secret EXPORT_KEY。
 * OFFERS 形如 {"cj:100001:12345":{"url":"https://www.anrdoezrs.net/click-PID-LINKID?url=https%3A%2F%2Fbrand.example","param":"sid"}}
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOKEN_LEN = 20;
const TTL_SECONDS = 100 * 86400;
const VERSION = "2.0.0";

function mint() {
  const buf = new Uint8Array(TOKEN_LEN);
  crypto.getRandomValues(buf);
  let t = "";
  for (let i = 0; i < TOKEN_LEN; i++) t += ALPHABET[buf[i] % ALPHABET.length];
  return t;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function withParam(url, param, value) {
  const u = new URL(url);
  u.searchParams.set(param, value);
  return u.toString();
}

async function handleGo(req, env) {
  const q = new URL(req.url).searchParams;
  const offer = q.get("o") || "";
  let offers = {};
  try { offers = JSON.parse(env.OFFERS || "{}"); } catch (e) { return json({ error: "OFFERS not valid JSON" }, 500); }
  const target = offers[offer];
  if (!target || !target.url) return json({ error: "unknown offer" }, 404);
  const token = mint();
  const ts = new Date().toISOString();
  const row = {
    token,
    gclid: q.get("gclid") || q.get("gbraid") || q.get("wbraid") || "",
    gclid_kind: q.get("gclid") ? "gclid" : (q.get("gbraid") ? "gbraid" : (q.get("wbraid") ? "wbraid" : "")),
    campaign: q.get("c") || "", adgroup: q.get("a") || "", keyword: q.get("k") || "", network: q.get("n") || "",
    page: q.get("p") || "", ts, offer,
  };
  const key = "m:" + ts + ":" + token;
  await env.MAPPINGS.put(key, JSON.stringify(row), { expirationTtl: TTL_SECONDS });
  await env.MAPPINGS.put("t:" + token, key, { expirationTtl: TTL_SECONDS });
  const dest = withParam(target.url, target.param || "sid", token);
  return new Response(null, { status: 302, headers: { location: dest, "cache-control": "no-store", "referrer-policy": "no-referrer-when-downgrade" } });
}

async function handleExport(req, env) {
  const auth = req.headers.get("authorization") || "";
  if (!env.EXPORT_KEY || auth !== "Bearer " + env.EXPORT_KEY) return json({ error: "unauthorized" }, 401);
  const since = new URL(req.url).searchParams.get("since") || "1970-01-01T00:00:00Z";
  const lines = [];
  let cursor = undefined;
  for (let page = 0; page < 20; page++) {
    const list = await env.MAPPINGS.list({ prefix: "m:", cursor, limit: 1000 });
    for (const k of list.keys) {
      const ts = k.name.slice(2, 26);
      if (ts < since) continue;
      const v = await env.MAPPINGS.get(k.name);
      if (v) lines.push(v);
    }
    if (list.list_complete) break;
    cursor = list.cursor;
  }
  return new Response(lines.join("\n") + (lines.length ? "\n" : ""), { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (req.method !== "GET") return json({ error: "method" }, 405);
    if (path === "/go") return handleGo(req, env);
    if (path === "/export") return handleExport(req, env);
    if (path === "/health") return json({ ok: true, version: VERSION });
    return json({ error: "not found" }, 404);
  },
};
