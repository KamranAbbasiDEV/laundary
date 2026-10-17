import { serve } from 'inngest/next';
import { NextRequest, NextResponse } from 'next/server';
import { inngest, notificationRetry, orderValidated, processorReviewReminder } from '@/lib/inngest';

const inngestHandler = serve({
  client: inngest,
  functions: [orderValidated, processorReviewReminder, notificationRetry]
});

export async function GET(request: NextRequest) {
  if (!process.env.INNGEST_SIGNING_KEY) return NextResponse.json({ error: 'INNGEST_SIGNING_KEY is not configured' }, { status: 503 });
  return inngestHandler.GET(request, {});
}

export const POST = inngestHandler.POST;
export const PUT = inngestHandler.PUT;
