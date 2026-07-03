import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isSupportedLocale, normalizeLocale } from './i18n/locales';
import { I18N_COOKIE_NAME } from './i18n/i18n.settings';

const PUBLIC_FILE = /\.(.*)$/;
const IGNORED_PATHS = ['/api', '/_next', '/static', '/assets'];

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/features',
  '/pricing',
  '/case-studies',
  '/support',
  '/about',
  '/contact',
  '/careers',
  '/roadmap',
  '/changelog',
  '/privacy',
  '/terms',
  '/security',
  '/auth',
];

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/settings',
  '/manage',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldBypass(pathname)) {
    return NextResponse.next();
  }

  // Detect and set preferred locale cookie
  const preferredLocale = detectPreferredLocale(request) ?? DEFAULT_LOCALE;

  // Check authentication for protected routes
  const authResult = await checkAuthentication(request);
  if (authResult) {
    // Set locale cookie even on auth redirects
    setLocaleCookie(authResult, preferredLocale);
    return authResult;
  }

  // Continue with normal request, setting locale cookie
  const response = NextResponse.next();
  setLocaleCookie(response, preferredLocale);

  return response;
}

function shouldBypass(pathname: string) {
  if (pathname === '/favicon.ico') {
    return true;
  }

  if (PUBLIC_FILE.test(pathname)) {
    return true;
  }

  return IGNORED_PATHS.some((path) => pathname.startsWith(path));
}

function detectPreferredLocale(request: NextRequest) {
  const cookieLocale = request.cookies.get(I18N_COOKIE_NAME)?.value;
  if (cookieLocale && isSupportedLocale(cookieLocale)) {
    return normalizeLocale(cookieLocale);
  }

  const header = request.headers.get('accept-language');
  if (header) {
    const locales = header
      .split(',')
      .map((entry) => entry.split(';')[0]?.trim())
      .filter(Boolean);

    for (const locale of locales) {
      const normalized = SUPPORTED_LOCALES.find(
        (supported) => supported.toLowerCase() === locale?.toLowerCase(),
      );

      if (normalized) {
        return normalized;
      }
    }
  }

  return DEFAULT_LOCALE;
}

function setLocaleCookie(response: NextResponse, locale: string) {
  response.cookies.set(I18N_COOKIE_NAME, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

async function checkAuthentication(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the current path requires authentication
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Allow public routes
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname === route || pathname.startsWith(route + '/')
  );

  // If not a protected route, allow access
  if (!isProtectedRoute || isPublicRoute) {
    return null;
  }

  // Check if user is authenticated
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          response.cookies.set({
            name,
            value: '',
            ...options,
            maxAge: 0,
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If no session, redirect to auth page
  if (!session) {
    const redirectURL = new URL('/auth', request.url);
    redirectURL.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectURL);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next|api|static|assets|.*\\..*).*)'],
};
