import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'stripe_placeholder_key', {
  typescript: true,
});
