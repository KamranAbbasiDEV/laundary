import { serve } from 'inngest/next';
import { NextRequest, NextResponse } from 'next/server';
import { inngest, orderValidated, processorReviewReminder } from '@/lib/inngest';

const inngestHandler = serve({
  client: inngest,
  functions: [orderValidated, processorReviewReminder]
});

export async function GET(request: NextRequest) {
  if (!process.env.INNGEST_SIGNING_KEY && process.env.NODE_ENV !== 'production') {
    return NextResponse.json({ status: 'ready', mode: 'local', message: 'Set INNGEST_SIGNING_KEY to register with Inngest Cloud.' });
  }
  return inngestHandler.GET(request, {});
}

export const POST = inngestHandler.POST;
export const PUT = inngestHandler.PUT;
