import { NextResponse } from 'next/server';

const CONSOLE_BASE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_API_URL ||
  'https://console-yt54xvsg5q-an.a.run.app/api/v1/console';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    await fetch(`${CONSOLE_BASE_URL}/public/monitoring/web-vitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch (error) {
    console.warn('[web-vitals] failed to forward metric', error);
  }

  return NextResponse.json({ success: true });
}
