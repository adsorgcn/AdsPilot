import { NextRequest } from 'next/server';
import { redirect } from 'next/navigation';

import getLogger from '~/core/logger';
import configuration from '~/configuration';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';

/**
 * Check if user has active subscription via API Gateway
 * This replaces direct Supabase database queries
 */
async function checkUserSubscription(_userId: string, token: string): Promise<boolean> {
  try {
    const response = await fetch(`${configuration.site.siteUrl}/api/v1/billing/subscriptions/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Subscription check failed:', response.status);
      return false;
    }

    const data = await response.json();
    return data.hasActiveSubscription || false;
  } catch (error) {
    console.error('Failed to check subscription:', error);
    return false;
  }
}

/**
 * OAuth callback route
 *
 * Handles OAuth authorization code flow (e.g., Google Sign-In)
 * - OAuth providers redirect to: /auth/callback?code=xxx
 * - This route exchanges the code for a session server-side
 *
 * Note: Magic links (used for testing) redirect to /auth/confirm instead,
 * which handles token extraction client-side from URL hash fragments.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const logger = getLogger();
  const searchParams = requestUrl.searchParams;

  const authCode = searchParams.get('code');
  const error = searchParams.get('error');
  const nextUrl = searchParams.get('next');
  const referralCode = searchParams.get('referralCode');

  const client = getSupabaseRouteHandlerClient();
  let userId: Maybe<string> = undefined;

  // Handle OAuth authorization code flow (Google, etc.)
  if (authCode) {
    try {
      const { error, data } =
        await client.auth.exchangeCodeForSession(authCode);

      // if we have an error, we redirect to the error page
      if (error) {
        return onError({ error: error.message });
      }

      userId = data.user.id;

          // Note: Since we're migrating to Backend API, we no longer need to wait for Supabase triggers
      // The user data creation is now handled by the backend during trial subscription
      logger.info({ userId }, 'User authentication successful, proceeding to trial creation');

      logger.info(
        { userId, email: data.user.email },
        'User authenticated successfully'
      );

      // Handle referral tracking and trial creation for new users
      // Check if this is a new user by verifying if they have a subscription via API
      let isNewUser = false;
      try {
        const hasSubscription = await checkUserSubscription(userId, data.session.access_token);
        isNewUser = !hasSubscription;
      } catch (error) {
        // Fallback to time-based check if API call fails
        logger.warn(
          { userId, error },
          'Subscription check failed via API, using time-based detection'
        );
        isNewUser = true; // Always treat as new user during migration phase
      }

      if (isNewUser) {
        try {
          const idToken = data.session.access_token;

          if (referralCode) {
            // Track referral and create 14-day trial for both parties
            logger.info(
              { userId, referralCode },
              'Tracking referral for new user'
            );

            const trackResponse = await fetch(`${configuration.site.siteUrl}/api/v1/referral/track`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                referralCode,
                newUserId: userId,
              }),
            });

            if (!trackResponse.ok) {
              const errorData = await trackResponse.json().catch(() => ({}));
              const errorCode = errorData.errorCode || errorData.error_code;
              
              // Handle specific error codes
              if (errorCode === 'SUB_002') {
                logger.warn(
                  { userId, referralCode },
                  'Invalid referral code - continuing with registration'
                );
              } else if (errorCode === 'SUB_003') {
                logger.warn(
                  { userId, referralCode },
                  'Referral code already used - continuing with registration'
                );
              } else {
                logger.error(
                  { userId, referralCode, status: trackResponse.status, errorCode },
                  'Failed to track referral'
                );
              }
            } else {
              logger.info({ userId, referralCode }, 'Referral tracked successfully');
            }
          } else {
            // Create 7-day self-register trial with complete three-layer architecture data
            logger.info({ userId }, 'Creating self-register trial');

            const trialResponse = await fetch(`${configuration.site.siteUrl}/api/v1/billing/subscriptions/trial`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: userId,           // Supabase auth.users.id
                email: data.user.email!,         // From JWT claims
                name: data.user.user_metadata?.name || data.user.email?.split('@')[0],
                avatarUrl: data.user.user_metadata?.avatar_url || '',
                days: 7,
                source: 'self_register'
              }),
            });

            if (!trialResponse.ok) {
              const errorData = await trialResponse.json().catch(() => ({}));
              const errorCode = errorData.errorCode || errorData.error_code;
              
              // Handle specific error codes
              if (errorCode === 'SUB_001') {
                logger.info(
                  { userId },
                  'User already has trial subscription - continuing with registration'
                );
              } else {
                logger.error(
                  { userId, status: trialResponse.status, errorCode },
                  'Failed to create self-register trial'
                );
              }
            } else {
              logger.info({ userId }, 'Self-register trial created successfully');
            }
          }
        } catch (err) {
          logger.error(
            { userId, error: err },
            'Error during trial creation'
          );
          // Don't block user login on trial creation failure
        }
      }

      // 直接跳转到 Dashboard
      return redirect(nextUrl || configuration.paths.appHome);
    } catch (error) {
      logger.error({ error }, 'Error during OAuth callback');
      return onError({ error: 'Authentication failed' });
    }
  }

  // Handle error from OAuth provider
  if (error) {
    return onError({ error });
  }

  // No authorization code and no error - invalid callback
  return onError({ error: 'No authorization code provided' });
}

function onError(params: { error: string }) {
  const logger = getLogger();

  logger.error(
    { error: params.error },
    `Auth error: ${params.error}`
  );

  return redirect(`/auth?error=true&message=${encodeURIComponent(params.error)}`);
}
