import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ah } from '../lib/http';
import { fid, requireDevice, requireUser } from '../middleware/auth';
import { ingestWeighing, weighingSchema } from '../services/ingest';

export const weighingsRouter = Router();

/**
 * POST /api/v1/weighings  (ESP32, header X-Device-Key)
 * Body: { device_id, rfid_tag, weight_kg, timestamp? }
 * 201 criado | 200 duplicado | 404 tag não cadastrada | 409 animal inativo | 401 chave inválida | 422 payload
 */
weighingsRouter.post(
  '/',
  requireDevice,
  ah(async (req, res) => {
    const input = weighingSchema.parse(req.body);
    const r = await ingestWeighing(req.device!, input);
    res.status(r.duplicado ? 200 : 201).json(r);
  }),
);

/** GET /api/v1/weighings?limit=20&animal_id=  (dashboard) */
weighingsRouter.get(
  '/',
  requireUser,
  ah(async (req, res) => {
    const q = z
      .object({ limit: z.coerce.number().min(1).max(500).default(20), animal_id: z.string().optional() })
      .parse(req.query);
    const logs = await prisma.weightLog.findMany({
      where: { animal: { fazenda_id: fid(req) }, ...(q.animal_id ? { animal_id: q.animal_id } : {}) },
      orderBy: { timestamp: 'desc' },
      take: q.limit,
      include: {
        animal: { select: { brinco_visual: true, tag_rfid: true } },
        dispositivo: { select: { nome: true } },
      },
    });
    res.json(
      logs.map((l) => ({
        id: l.id,
        animal_id: l.animal_id,
        brinco_visual: l.animal.brinco_visual,
        tag_rfid: l.animal.tag_rfid,
        dispositivo_id: l.dispositivo_id,
        dispositivo_nome: l.dispositivo?.nome ?? 'Manual',
        peso_kg: l.peso_kg,
        timestamp: l.timestamp,
      })),
    );
  }),
);
