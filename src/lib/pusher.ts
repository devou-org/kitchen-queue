export const pusherServer = {
  trigger: async (channel: string, event: string, data: any): Promise<void> => {
    const socketServerUrl = process.env.SOCKET_SERVER_URL || 'http://localhost:3001';
    const secret = process.env.SOCKET_SERVER_SECRET || 'secret';
    
    console.log(`[Socket Trigger] Forwarding "${event}" on channel "${channel}" to ${socketServerUrl}`);
    try {
      const res = await fetch(`${socketServerUrl}/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`,
        },
        body: JSON.stringify({ channel, event, data }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[Socket Trigger Error] HTTP ${res.status}: ${errorText}`);
      } else {
        console.log(`[Socket Trigger Success] Broadcasted "${event}" on channel "${channel}"`);
      }
    } catch (error) {
      console.error(`[Socket Trigger Exception] Failed to send trigger for ${channel}:`, error);
    }
  }
};
