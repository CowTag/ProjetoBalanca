import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from './env';
import { verifyToken } from './middleware/auth';

let io: Server | null = null;

// Tempo real (Socket.io)
export function initRealtime(server: HttpServer) {
  io = new Server(server, { cors: { origin: env.CORS_ORIGIN } });

  io.use((socket, next) => {
    try {
      const user = verifyToken(String(socket.handshake.auth?.token ?? ''));
      socket.data.user = user;
      socket.join(`farm:${user.fazenda_id}`);
      next();
    } catch {
      next(new Error('NAO_AUTENTICADO'));
    }
  });

  io.on('connection', (s) => console.log(`[WS] conectado ${s.data.user?.nome}`));
}

export function emitToFarm(fazendaId: string, event: string, payload: unknown) {
  io?.to(`farm:${fazendaId}`).emit(event, payload);
}
