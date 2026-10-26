import { io, Socket } from 'socket.io-client';

class ChannelWrapper {
  public channelName: string;
  private socket: Socket | null;
  private callbacks: Map<string, Set<Function>> = new Map();
  private refCount = 0;

  constructor(channelName: string, socket: Socket | null) {
    this.channelName = channelName;
    this.socket = socket;
  }

  retain() {
    this.refCount++;
    return this.refCount;
  }

  release() {
    this.refCount = Math.max(0, this.refCount - 1);
    return this.refCount;
  }

  getRefCount() {
    return this.refCount;
  }

  bind(event: string, callback: Function) {
    console.log(`[Socket.io Client] Binding event "${event}" on channel "${this.channelName}" (active listeners: ${(this.callbacks.get(event)?.size || 0) + 1})`);
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, new Set());
    }
    this.callbacks.get(event)!.add(callback);

    // Mimic subscription succeeded event immediately if socket is connected
    if (event === 'pusher:subscription_succeeded') {
      if (this.socket && this.socket.connected) {
        setTimeout(() => callback(), 0);
      } else if (this.socket) {
        this.socket.once('connect', () => {
          callback();
        });
      }
    }

    return this;
  }

  unbind(event: string, callback?: Function) {
    console.log(`[Socket.io Client] Unbinding event "${event}" on channel "${this.channelName}"`);
    if (!callback) {
      this.callbacks.delete(event);
    } else {
      const set = this.callbacks.get(event);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.callbacks.delete(event);
        }
      }
    }
    return this;
  }

  unbind_all(event?: string) {
    if (event) {
      console.log(`[Socket.io Client] Unbinding event "${event}" on channel "${this.channelName}"`);
      this.callbacks.delete(event);
    } else {
      console.log(`[Socket.io Client] Unbinding all events on channel "${this.channelName}"`);
      this.callbacks.clear();
    }
    return this;
  }

  unsubscribe() {
    console.log(`[Socket.io Client] Channel unsubscribed: "${this.channelName}"`);
    if (pusherClient) {
      pusherClient.unsubscribe(this.channelName);
    }
  }

  dispatch(event: string, data: any) {
    const set = this.callbacks.get(event);
    if (set && set.size > 0) {
      set.forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[Socket.io Client Dispatch Error] Error in callback for event "${event}":`, err);
        }
      });
    } else {
      console.warn(`[Socket.io Client] Event "${event}" received on channel "${this.channelName}", but no active callbacks registered! Registered events:`, Array.from(this.callbacks.keys()));
    }
  }
}

class SocketClientWrapper {
  private socket: Socket | null = null;
  private channels: Map<string, ChannelWrapper> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
      console.log(`[Socket.io Client] Connecting to websocket server at ${socketUrl}...`);

      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log('[Socket.io Client] Websocket connection established successfully.');

        // Re-join all active channels on reconnection
        for (const channelName of this.channels.keys()) {
          console.log(`[Socket.io Client] Re-joining channel room: "${channelName}"`);
          this.socket?.emit('join-channel', channelName);
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.warn(`[Socket.io Client] Connection lost: ${reason}`);
      });

      this.socket.on('connect_error', (error) => {
        console.error('[Socket.io Client] Connection failed:', error);
      });

      // Handle events broadcasted from the trigger webhook
      this.socket.on('channel-event', ({ channel, event, data }) => {
        console.log(`[Socket.io Client] Event received: "${event}" for channel "${channel}"`, data);
        const channelWrapper = this.channels.get(channel);
        if (channelWrapper) {
          channelWrapper.dispatch(event, data);
        } else {
          console.warn(`[Socket.io Client] Channel "${channel}" not found in registered channels:`, Array.from(this.channels.keys()));
        }
      });
    }
  }

  subscribe(channelName: string): ChannelWrapper {
    if (!channelName) {
      console.warn('[Socket.io Client] subscribe called with empty channelName');
      return new ChannelWrapper('', null);
    }

    let channelWrapper = this.channels.get(channelName);
    if (!channelWrapper) {
      console.log(`[Socket.io Client] Subscribing new channel: "${channelName}"`);
      channelWrapper = new ChannelWrapper(channelName, this.socket);
      this.channels.set(channelName, channelWrapper);
      if (this.socket && this.socket.connected) {
        this.socket.emit('join-channel', channelName);
      }
    }

    channelWrapper.retain();
    return channelWrapper;
  }

  unsubscribe(channelName: string) {
    if (!channelName) return;

    const channelWrapper = this.channels.get(channelName);
    if (channelWrapper) {
      const remaining = channelWrapper.release();
      if (remaining <= 0) {
        console.log(`[Socket.io Client] Unsubscribing channel (0 subscribers remaining): "${channelName}"`);
        if (this.socket) {
          this.socket.emit('leave-channel', channelName);
        }
        channelWrapper.unbind_all();
        this.channels.delete(channelName);
      } else {
        console.log(`[Socket.io Client] Decremented channel subscriber count for "${channelName}" (${remaining} still active)`);
      }
    }
  }

  public get connection() {
    return {
      bind: (event: string, callback: (...args: any[]) => void) => {
        if (!this.socket) return;
        const targetEvent = event === 'connected' ? 'connect' : event;
        this.socket.on(targetEvent, callback);
      },
      unbind: (event: string, callback?: (...args: any[]) => void) => {
        if (!this.socket) return;
        const targetEvent = event === 'connected' ? 'connect' : event;
        if (callback) {
          this.socket.off(targetEvent, callback);
        } else {
          this.socket.off(targetEvent);
        }
      },
    };
  }
}

export const pusherClient = typeof window !== 'undefined' ? new SocketClientWrapper() : null;
export default pusherClient;
