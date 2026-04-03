import { NextRequest, NextResponse } from 'next/server';
import { getQueueState } from '@/lib/db';
import { sseManager } from '@/lib/sse';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  const clientId = randomUUID();

  const stream = new ReadableStream({
    start(controller) {
      sseManager.addClient(clientId, controller);

      const encoder = new TextEncoder();

      // Send initial state
      getQueueState().then((state) => {
        const data = {
          type: 'queue_update',
          queue_number: state?.current_queue_number || 1,
          last_served_number: state?.last_served_number || 0,
          timestamp: new Date().toISOString(),
        };
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* Client may already be gone */ }
      });

      // Heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`));
        } catch {
          clearInterval(heartbeat);
          sseManager.removeClient(clientId);
        }
      }, 30000);

      // Cleanup on close
      _request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        sseManager.removeClient(clientId);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      sseManager.removeClient(clientId);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
