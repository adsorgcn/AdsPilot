/**
 * Firebase Authentication utilities using Jose for JWT verification
 */

import { createRemoteJWKSet, jwtVerify } from 'jose'

export interface FirebaseAuthConfig {
  projectId: string
}

export interface FirebaseTokenPayload {
  iss: string
  aud: string
  auth_time: number
  user_id: string
  sub: string
  iat: number
  exp: number
  email?: string
  email_verified?: boolean
  firebase?: {
    identities?: Record<string, any>
    sign_in_provider?: string
  }
}

/**
 * Verify Firebase ID token using Jose
 *
 * @param idToken - Firebase ID token from client
 * @param config - Firebase configuration
 * @returns Verified token payload
 * @throws Error if token is invalid
 */
export async function verifyFirebaseToken(
  idToken: string,
  config: FirebaseAuthConfig
): Promise<FirebaseTokenPayload> {
  const { projectId } = config

  if (!projectId) {
    throw new Error('Firebase projectId is required')
  }

  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Invalid token format')
  }

  const jwks = createRemoteJWKSet(
    new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
  )

  try {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    })

    return payload as unknown as FirebaseTokenPayload
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Token verification failed: ${error.message}`)
    }
    throw new Error('Token verification failed')
  }
}

/**
 * Extract token from various sources (header, body, cookie)
 */
export function extractToken(options: {
  headers?: Headers
  body?: any
  cookies?: Record<string, string>
}): string | null {
  const { headers, body, cookies } = options

  // Try header first
  if (headers) {
    const authHeader = headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7)
    }

    const firebaseHeader = headers.get('x-firebase-token')
    if (firebaseHeader) {
      return firebaseHeader
    }
  }

  // Try body
  if (body?.token) {
    return body.token
  }

  // Try cookies
  if (cookies?.['Firebase-Token']) {
    return cookies['Firebase-Token']
  }

  return null
}