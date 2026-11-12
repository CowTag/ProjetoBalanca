import { io, type Socket } from 'socket.io-client';
import { useEffect } from 'react';
import { apiBase, tokenStore } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(apiBase || undefined, { auth: { token: tokenStore.get() }, transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}

/** Assina um evento em tempo real enquanto o componente estiver montado. */
export function useRealtime<T>(event: string, handler: (data: T) => void) {
  useEffect(() => {
    const s = getSocket();
    s.on(event, handler);
    return () => {
      s.off(event, handler);
    };
  }, [event, handler]);
}
