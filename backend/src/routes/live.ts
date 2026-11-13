import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ah } from '../lib/http';
import { prisma } from '../lib/prisma';
import { fid, requireDevice, requireUser } from '../middleware/auth';
import { emitToFarm } from '../realtime';

/**
 * Estado "ao vivo" das balanças (peso atual, etapa da pesagem, última mensagem).
 * Fica gravado na própria linha do dispositivo (devices.live), sobrescrito a cada
 * envio — assim funciona também na Vercel, onde não há memória compartilhada.
 *
 *   POST /api/v1/live   (ESP32, X-Device-Key)  -> grava + emite "scale:live" (Socket.io, se local)
 *   GET  /api/v1/live   (usuário)              -> último estado de cada balança (polling)
 */
export const liveRouter = Router();

const liveSchema = z.object({
  device_id: z.string(),
  estado: z.string().max(32),
  peso_kg: z.coerce.number(),
  estavel: z.boolean(),
  tag: z.string().max(40).optional().default(''),
  mensagem: z.string().max(120).optional().default(''),
  fila: z.coerce.number().optional().default(0),
  ip: z.string().max(45).optional(),
  wifi_rssi: z.coerce.number().optional(),
});

export type LiveState = z.infer<typeof liveSchema> & {
  dispositivo_id: string;
  nome: string;
  recebido_em: string;
};

/** Estados mais antigos que isso não aparecem no painel (balança desligada). */
const LIVE_MAX_AGE_MS = 60_000;

liveRouter.post(
  '/',
  requireDevice,
  ah(async (req, res) => {
    const device = req.device!;
    const data = liveSchema.parse(req.body);
    const agora = new Date();
    const state: LiveState = { ...data, dispositivo_id: device.id, nome: device.nome, recebido_em: agora.toISOString() };

    // Uma única escrita: estado ao vivo + online/último contato
    await prisma.device.update({
      where: { id: device.id },
      data: { live: state as unknown as Prisma.InputJsonValue, live_em: agora, status_online: true, ultimo_contato: agora },
    });
    if (!device.status_online) {
      emitToFarm(device.fazenda_id, 'device:status', { id: device.id, status_online: true, ultimo_contato: agora });
    }
    emitToFarm(device.fazenda_id, 'scale:live', state);
    res.status(204).end();
  }),
);

liveRouter.get(
  '/',
  requireUser,
  ah(async (req, res) => {
    const devices = await prisma.device.findMany({
      where: { fazenda_id: fid(req), live_em: { gte: new Date(Date.now() - LIVE_MAX_AGE_MS) } },
      select: { live: true },
      orderBy: { nome: 'asc' },
    });
    res.json(devices.map((d) => d.live).filter(Boolean));
  }),
);
