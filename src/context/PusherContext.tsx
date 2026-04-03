'use client';
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { pusherClient } from '@/lib/pusher-client';
import { Channel } from 'pusher-js';

type PusherContextType = {
  isLive: boolean;
  channel: Channel | null;
};

const PusherContext = createContext<PusherContextType>({ 
  isLive: false, 
  channel: null 
});

export const PusherProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLive, setIsLive] = useState(false);
  const [channel, setChannel] = useState<Channel | null>(null);
  const subscriptionRef = useRef<Channel | null>(null);

  useEffect(() => {
    if (!pusherClient) return;

    console.log('📡 Initializing global Pusher background connection...');
    
    // Subscribe once and keep it alive across navigation
    if (!subscriptionRef.current) {
      const activeChannel = pusherClient.subscribe('queue-channel');
      subscriptionRef.current = activeChannel;
      setChannel(activeChannel);

      activeChannel.bind('pusher:subscription_succeeded', () => {
        console.log('✅ Global Pusher channel connected!');
        setIsLive(true);
      });

      activeChannel.bind('pusher:subscription_error', (error: any) => {
        console.error('❌ Global Pusher connection failed:', error);
        setIsLive(false);
      });
    }

    return () => {
      // In a real app, you might want to keep it alive for the whole session
      // but if the layout were to truly unmount (rare in Next.js root), we cleanup.
    };
  }, []);

  return (
    <PusherContext.Provider value={{ isLive, channel }}>
      {children}
    </PusherContext.Provider>
  );
};

export const usePusher = () => useContext(PusherContext);
