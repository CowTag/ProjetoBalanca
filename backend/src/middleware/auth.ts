import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Request, RequestHandler } from 'express';
import type { Device } from '@prisma/client';
import { env } from '../env';
import { prisma } from '../lib/prisma';
import { HttpError, ah } from '../lib/http';

export interface AuthUser {
  id: string;
  nome: string;
  fazenda_id: string;
  funcao: 'admin' | 'operador';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      device?: Device;
    }
  }
}

// ---------------- Usuários (JWT) ----------------
export function signToken(u: AuthUser): string {
  return jwt.sign(u, env.JWT_SECRET, { expiresIn: '12h' });
}

export function verifyToken(token: string): AuthUser {
  const p = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & AuthUser;
  return { id: p.id, nome: p.nome, fazenda_id: p.fazenda_id, funcao: p.funcao };
}

export const requireUser: RequestHandler = (req, _res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next(new HttpError(401, 'NAO_AUTENTICADO'));
  try {
    req.user = verifyToken(h.slice(7));
    next();
  } catch {
    next(new HttpError(401, 'TOKEN_INVALIDO'));
  }
};

export const requireRole =
  (...roles: AuthUser['funcao'][]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.funcao)) return next(new HttpError(403, 'SEM_PERMISSAO'));
    next();
  };

/** fazenda do usuário logado */
export const fid = (req: Request) => req.user!.fazenda_id;

// ---------------- Dispositivos (X-Device-Key) ----------------
export const hashKey = (k: string) => crypto.createHash('sha256').update(k).digest('hex');
export const newDeviceKey = () => crypto.randomBytes(24).toString('base64url');

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export const requireDevice = ah(async (req, _res, next) => {
  const key = req.header('x-device-key');
  const ident = typeof req.body?.device_id === 'string' ? req.body.device_id : undefined;
  if (!key || !ident) throw new HttpError(401, 'DISPOSITIVO_NAO_AUTENTICADO');

  const device = await prisma.device.findUnique({ where: { identificador_esp32: ident } });
  if (!device || !safeEqual(device.api_key_hash, hashKey(key))) throw new HttpError(401, 'CHAVE_INVALIDA');

  req.device = device;
  next();
});
