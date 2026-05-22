import { stripe } from '@/server/lib/stripe';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import Stripe from 'stripe';

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return new Response('No stripe-signature header found', { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder'
    );
  } catch (err) {
    const error = err as Error;
    console.error(`Webhook signature verification failed:`, error.message);
    return new Response(`Webhook Error: ${error.message}`, { status: 400 });
  }

  // Handle billing payment success
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata;

    if (metadata?.invoiceId) {
      await db
        .update(invoices)
        .set({
          status: 'paid',
          stripePaymentIntentId: session.payment_intent as string,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, metadata.invoiceId));

      console.log(
        `[Stripe Webhook] Payment received successfully for invoice: ${metadata.invoiceId}`
      );
    }
  }

  return NextResponse.json({ received: true });
}
export const dynamic = 'force-dynamic';
