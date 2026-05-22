import { serve } from 'inngest/next';
import { inngest } from '@/server/lib/inngest';
import { billingService } from '@/server/services/billing.service';

// 1. Cron worker: Daily reminder to members to confirm flexible meals before cutoff
const sendMealReminders = inngest.createFunction(
  { id: 'send-meal-reminders', triggers: [{ cron: '0 9 * * *' }] }, // Every day at 9:00 AM UTC
  async ({ step }) => {
    await step.run('dispatch-reminders', async () => {
      console.log('[Inngest Cron] Dispatching daily meal confirmations reminders to members.');
      // In production, this would query pending confirmations and send Push/Email notifications
    });
  }
);

// 2. Event worker: Async invoice compiler and email sender
const processInvoiceGeneration = inngest.createFunction(
  { id: 'process-invoice-generation', triggers: [{ event: 'catering/invoice.generate' }] },
  async ({ event, step }) => {
    const { invoiceId } = event.data;

    await step.run('compile-and-send-billing-email', async () => {
      console.log(`[Inngest Event] Processing invoice mailing for ID: ${invoiceId}`);
      await billingService.sendInvoiceEmail(invoiceId);
    });
  }
);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendMealReminders, processInvoiceGeneration],
});
