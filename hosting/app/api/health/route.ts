import { NextResponse } from 'next/server'

const BACKEND_BASE = process.env.BACKEND_URL || 'https://gm-gw-885pd7lz.an.gateway.dev'

export async function GET() {
  try {
    const r = await fetch(`${BACKEND_BASE}/api/health`, { cache: 'no-store' })
    return NextResponse.json({ ok: r.ok, status: r.status })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
