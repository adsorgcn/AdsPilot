import { NextResponse } from 'next/server';

import getSupabaseServerActionClient from '~/core/supabase/action-client';

const CONSOLE_BASE_URL = process.env.NEXT_PUBLIC_CONSOLE_API_URL;

export const runtime = 'nodejs';

export async function GET() {
  if (!CONSOLE_BASE_URL) {
    return NextResponse.json({ error: 'Console service not configured' }, { status: 500 });
  }

  const supabase = getSupabaseServerActionClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(JSON.stringify({ status: 'loading' }) + '\n'));

      try {
        const response = await fetch(`${CONSOLE_BASE_URL}/monitoring`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || `Console API error: ${response.status}`);
        }

        const data = await response.json();
        controller.enqueue(
          encoder.encode(JSON.stringify({ status: 'success', data }) + '\n'),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(
          encoder.encode(JSON.stringify({ status: 'error', message }) + '\n'),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
