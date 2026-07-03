/**
 * @gm/auth-utils
 *
 * Shared authentication utilities for Firebase Auth and JWT verification
 */

export {
  verifyFirebaseToken,
  extractToken,
  type FirebaseAuthConfig,
  type FirebaseTokenPayload,
} from './firebase'

export { createAuthMiddleware, type AuthMiddlewareConfig } from './middleware'