import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

/** Envolve handlers async para que erros caiam no errorHandler. */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(422).json({ error: 'VALIDACAO', detalhes: err.flatten() });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'DUPLICADO', campos: err.meta?.target });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'NAO_ENCONTRADO' });
      return;
    }
  }
  console.error(err);
  res.status(500).json({ error: 'ERRO_INTERNO' });
}
