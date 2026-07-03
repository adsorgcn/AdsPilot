import 'server-only';

const STRIPE_API_VERSION = '2024-04-10';

/**
 * @description returns a Stripe instance
 */
export default async function getStripeInstance() {
  const { default: Stripe } = await import('stripe');
  const key = getStripeKey();

  return new Stripe(key, {
    apiVersion: STRIPE_API_VERSION as any,
  });
}

function getStripeKey() {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

  if (!STRIPE_SECRET_KEY) {
    throw new Error(
      `'STRIPE_SECRET_KEY' environment variable was not provided`,
    );
  }

  return STRIPE_SECRET_KEY;
}
