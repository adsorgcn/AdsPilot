import csrf from 'edge-csrf';
import configuration from '~/configuration';
import { NextRequest, NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';

const CSRF_SECRET_COOKIE = 'csrfSecret';

/**
 * @name verifyCsrfToken
 * @description Standalone function to verify the CSRF token without the need for a request
 * This is particularly useful for one-off validation not dependent on a
 * request from the Middleware, which we manually build. For example, we can
 * use this in Server Actions to validate the CSRF token.
 * @param token
 */
async function verifyCsrfToken(token: string) {
  const csrfMiddleware = csrf({
    ignoreMethods: [],
    cookie: {
      secure: configuration.production,
      name: CSRF_SECRET_COOKIE,
    },
  });

  const origin = headers().get('referer') as string;
  const secret = cookies().get(CSRF_SECRET_COOKIE)?.value;
  const request = new NextRequest(origin);

  request.headers.set('X-CSRF-Token', token);

  if (secret) {
    request.cookies.set(CSRF_SECRET_COOKIE, secret);
  }

  const csrfError = await csrfMiddleware(request, new NextResponse());

  if (csrfError) {
    throw new Error('Invalid CSRF token');
  }
}

export default verifyCsrfToken;
