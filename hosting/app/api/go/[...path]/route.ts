import { NextResponse } from 'next/server'

const BACKEND_BASE = process.env.BACKEND_URL || 'https://gm-gw-885pd7lz.an.gateway.dev'

function readCookie(cookie: string|null|undefined, name: string): string|null {
  if (!cookie) return null
  for (const part of cookie.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

function enrichHeaders(req: Request, base: Headers): Headers {
  const headers = new Headers(base)
  // Inject Authorization from Firebase-Token cookie if missing
  const cookie = req.headers.get('cookie')
  if (!headers.get('authorization')) {
    const tok = readCookie(cookie, 'Firebase-Token')
    if (tok) headers.set('authorization', `Bearer ${tok}`)
  }
  // Best-effort decode Firebase ID token to set X-User-Id / X-Endpoint-API-UserInfo
  try {
    const authz = headers.get('authorization') || ''
    const parts = authz.split(' ')
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      const seg = parts[1].split('.')[1]
      if (seg) {
        const payload = JSON.parse(Buffer.from(seg.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'))
        const uid = String(payload.user_id || payload.sub || '')
        const email = String(payload.email || '')
        if (uid && !headers.get('X-User-Id')) headers.set('X-User-Id', uid)
        if (email && !headers.get('X-User-Email')) headers.set('X-User-Email', email)
        if (uid && !headers.get('X-Endpoint-API-UserInfo')) {
          const b64 = Buffer.from(JSON.stringify({ sub: uid, email })).toString('base64')
          headers.set('X-Endpoint-API-UserInfo', b64)
        }
      }
    }
  } catch {}
  // Forward original host for observability
  if (!headers.get('x-forwarded-host')) headers.set('x-forwarded-host', req.headers.get('host') || '')
  return headers
}

export async function GET(req: Request, ctx: any) {
  const params = ctx?.params as { path: string[] }
  const url = new URL(req.url)
  const target = `${BACKEND_BASE}/${params.path.join('/')}${url.search || ''}`
  let resp = await fetch(target, { headers: enrichHeaders(req, new Headers(req.headers)) })
  let body = await resp.text()
  // Fallback: if API Gateway reports "request is not defined" for known prefixes, route directly to service URL if provided
  if (resp.status === 404 && /not defined by this API/i.test(body)) {
    try {
      const segs = (ctx?.params?.path || []) as string[]
      // Expect ['api','v1', '<service>', ...]
      if (segs.length >= 3 && segs[0] === 'api' && segs[1] === 'v1') {
        const svc = segs[2]
        const pathRest = segs.slice(2).join('/')
        const svcMap: Record<string, string|undefined> = {
          offer: process.env.OFFER_URL,
          billing: process.env.BILLING_URL,
          notifications: process.env.NOTIFICATIONS_URL,
          siterank: process.env.SITERANK_URL,
          adscenter: process.env.ADSCENTER_URL,
          batchopen: process.env.BATCHOPEN_URL,
        }
        const base = (svcMap[svc] || '').replace(/\/$/, '')
        if (base) {
          const alt = `${base}/api/v1/${pathRest}${url.search || ''}`
          const altResp = await fetch(alt, { headers: enrichHeaders(req, new Headers(req.headers)) })
          const altBody = await altResp.text()
          return new NextResponse(altBody, { status: altResp.status, headers: { 'content-type': altResp.headers.get('content-type') || 'text/plain' } })
        }
      }
    } catch {}
  }
  return new NextResponse(body, { status: resp.status, headers: { 'content-type': resp.headers.get('content-type') || 'text/plain' } })
}

export async function POST(req: Request, ctx: any) {
  const params = ctx?.params as { path: string[] }
  const url = new URL(req.url)
  const target = `${BACKEND_BASE}/${params.path.join('/')}${url.search || ''}`
  const baseHeaders = new Headers(req.headers)
  baseHeaders.set('content-type', 'application/json')
  let resp = await fetch(target, { method: 'POST', headers: enrichHeaders(req, baseHeaders), body: await (req as any).text() })
  let body = await resp.text()
  if (resp.status === 404 && /not defined by this API/i.test(body)) {
    try {
      const segs = (ctx?.params?.path || []) as string[]
      if (segs.length >= 3 && segs[0] === 'api' && segs[1] === 'v1') {
        const svc = segs[2]
        const pathRest = segs.slice(2).join('/')
        const svcMap: Record<string, string|undefined> = {
          offer: process.env.OFFER_URL,
          billing: process.env.BILLING_URL,
          notifications: process.env.NOTIFICATIONS_URL,
          siterank: process.env.SITERANK_URL,
          adscenter: process.env.ADSCENTER_URL,
          batchopen: process.env.BATCHOPEN_URL,
        }
        const base = (svcMap[svc] || '').replace(/\/$/, '')
        if (base) {
          const alt = `${base}/api/v1/${pathRest}${url.search || ''}`
          const altResp = await fetch(alt, { method: 'POST', headers: enrichHeaders(req, baseHeaders), body: await (req as any).text() })
          const altBody = await altResp.text()
          return new NextResponse(altBody, { status: altResp.status, headers: { 'content-type': altResp.headers.get('content-type') || 'application/json' } })
        }
      }
    } catch {}
  }
  return new NextResponse(body, { status: resp.status, headers: { 'content-type': resp.headers.get('content-type') || 'application/json' } })
}
