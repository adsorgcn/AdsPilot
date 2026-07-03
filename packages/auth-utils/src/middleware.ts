/**
 * Authentication middleware for Next.js API routes
 */

import { verifyFirebaseToken, extractToken, type FirebaseAuthConfig } from './firebase'

export interface AuthMiddlewareConfig extends FirebaseAuthConfig {
  /**
   * Custom error handler
   */
  onError?: (error: Error) => Response
  /**
   * Skip authentication for certain paths
   */
  skipPaths?: string[]
}

/**
 * Create authentication middleware for Next.js API routes
 *
 * @example
 * ```typescript
 * import { createAuthMiddleware } from '@gm/auth-utils'
 *
 * const authMiddleware = createAuthMiddleware({
 *   projectId: process.env.FIREBASE_PROJECT_ID!,
 *   skipPaths: ['/api/health'],
 * })
 *
 * export async function GET(req: NextRequest) {
 *   const authResult = await authMiddleware(req)
 *   if (authResult instanceof Response) {
 *     return authResult // Auth failed
 *   }
 *
 *   const { userId, email } = authResult
 *   // Handle authenticated request
 * }
 * ```
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  return async (req: Request) => {
    const pathname = new URL(req.url).pathname

    // Skip authentication for certain paths
    if (config.skipPaths?.some((path) => pathname.startsWith(path))) {
      return null
    }

    const token = extractToken({
      headers: req.headers,
    })

    if (!token) {
      return config.onError
        ? config.onError(new Error('Missing authentication token'))
        : new Response(JSON.stringify({ error: 'unauthorized', message: 'Missing authentication token' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          })
    }

    try {
      const payload = await verifyFirebaseToken(token, config)
      return {
        userId: payload.user_id,
        email: payload.email,
        emailVerified: payload.email_verified,
        payload,
      }
    } catch (error) {
      return config.onError
        ? config.onError(error as Error)
        : new Response(JSON.stringify({ error: 'unauthorized', message: (error as Error).message }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          })
    }
  }
}