import { io, type Socket } from 'socket.io-client';
import { useEffect, useRef } from 'react';
import { apiBase, tokenStore } from './api';

let socket: Socket | null = null;

/**
 * Na Vercel o backend é serverless e não mantém WebSocket: o tempo real é
 * desligado no build (VITE_REALTIME=false) e as telas passam a fazer polling.
 */
export const REALTIME_ENABLED = import.meta.env.VITE_REALTIME !== 'false';

export function getSocket(): Socket {
  if (!socket) {
    socket = io(apiBase || undefined, {
      auth: { token: tokenStore.get() },
      transports: ['websocket', 'polling'],
      autoConnect: REALTIME_ENABLED,
    });
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
    if (!REALTIME_ENABLED) return;
    const s = getSocket();
    s.on(event, handler);
    return () => {
      s.off(event, handler);
    };
  }, [event, handler]);
}

/**
 * Sem tempo real (Vercel): chama `fn` a cada `ms` enquanto a aba estiver visível.
 * Com Socket.io ativo não faz nada — os eventos já mantêm a tela atualizada.
 */
export function usePolling(fn: () => unknown, ms: number) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (REALTIME_ENABLED) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') ref.current();
    }, ms);
    return () => clearInterval(t);
  }, [ms]);
}
