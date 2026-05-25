import { io, Socket } from 'socket.io-client';

class ChannelWrapper {
  public channelName: string;
  private socket: Socket | null;
  private callbacks: Map<string, Set<Function>> = new Map();

  constructor(channelName: string, socket: Socket | null) {
    this.channelName = channelName;
    this.socket = socket;
  }

  bind(event: string, callback: Function) {
    console.log(`[Socket.io Client] Binding event "${event}" on channel "${this.channelName}"`);
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

  unbind_all() {
    console.log(`[Socket.io Client] Unbinding all events on channel "${this.channelName}"`);
    this.callbacks.clear();
    return this;
  }

  unsubscribe() {
    console.log(`[Socket.io Client] Channel unsubscribed itself: "${this.channelName}"`);
    if (pusherClient) {
      pusherClient.unsubscribe(this.channelName);
    }
  }

  dispatch(event: string, data: any) {
    const set = this.callbacks.get(event);
    if (set) {
      set.forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[Socket.io Client Dispatch Error] Error in callback for event "${event}":`, err);
        }
      });
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
        }
      });
      
      // Also register generic event listeners just in case backend emits them directly
      const fallbackEvents = ['queue_updated', 'order_update', 'new_order', 'new_ticket'];
      fallbackEvents.forEach(event => {
        this.socket?.on(event, (data) => {
          console.log(`[Socket.io Client] Direct fallback event received: "${event}"`, data);
          // Dispatch to any channel currently listening to this event type
          for (const channelWrapper of this.channels.values()) {
            channelWrapper.dispatch(event, data);
          }
        });
      });
    }
  }

  subscribe(channelName: string): ChannelWrapper {
    if (!channelName) {
      console.warn('[Socket.io Client] subscribe called with empty channelName');
      return new ChannelWrapper('', null);
    }
    
    console.log(`[Socket.io Client] Subscribing to channel: "${channelName}"`);
    
    if (this.socket && this.socket.connected) {
      this.socket.emit('join-channel', channelName);
    }

    let channelWrapper = this.channels.get(channelName);
    if (!channelWrapper) {
      channelWrapper = new ChannelWrapper(channelName, this.socket);
      this.channels.set(channelName, channelWrapper);
    }

    return channelWrapper;
  }

  unsubscribe(channelName: string) {
    if (!channelName) return;
    console.log(`[Socket.io Client] Unsubscribing from channel: "${channelName}"`);
    
    if (this.socket) {
      this.socket.emit('leave-channel', channelName);
    }
    
    const channelWrapper = this.channels.get(channelName);
    if (channelWrapper) {
      channelWrapper.unbind_all();
      this.channels.delete(channelName);
    }
  }
}

export const pusherClient = typeof window !== 'undefined' ? new SocketClientWrapper() : null;
export default pusherClient;
