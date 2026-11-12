import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../lib/http';
import { fid, requireDevice, requireUser } from '../middleware/auth';
import { touchDevice } from '../services/ingest';
import { emitToFarm } from '../realtime';

/**
 * Estado "ao vivo" das balanças (peso atual, etapa da pesagem, última mensagem).
 * Fica só em memória — não é gravado no banco. Serve para acompanhar a balança
 * pelo dashboard quando não há display no ESP32.
 *
 *   POST /api/v1/live   (ESP32, X-Device-Key)  -> emite "scale:live" via Socket.io
 *   GET  /api/v1/live   (usuário)              -> último estado de cada balança
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

const cache = new Map<string, LiveState & { fazenda_id: string }>();

liveRouter.post(
  '/',
  requireDevice,
  ah(async (req, res) => {
    const device = req.device!;
    const data = liveSchema.parse(req.body);

    // Atualiza status online no banco no máximo a cada 10 s
    const last = device.ultimo_contato?.getTime() ?? 0;
    if (!device.status_online || Date.now() - last > 10_000) await touchDevice(device);

    const state = { ...data, dispositivo_id: device.id, nome: device.nome, recebido_em: new Date().toISOString() };
    cache.set(device.id, { ...state, fazenda_id: device.fazenda_id });
    emitToFarm(device.fazenda_id, 'scale:live', state);
    res.status(204).end();
  }),
);

liveRouter.get('/', requireUser, (req, res) => {
  const fazendaId = fid(req);
  res.json(
    [...cache.values()]
      .filter((s) => s.fazenda_id === fazendaId)
      .map(({ fazenda_id: _f, ...s }) => s),
  );
});
