import Pusher from 'pusher';

const globalPusher = global as unknown as { pusherServer: Pusher };

export const pusherServer = globalPusher.pusherServer || new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

if (process.env.NODE_ENV !== 'production') {
  globalPusher.pusherServer = pusherServer;
}
