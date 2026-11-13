import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError, ah } from '../lib/http';
import { fid, hashKey, newDeviceKey, requireDevice, requireRole } from '../middleware/auth';
import { ingestTelemetry, telemetrySchema } from '../services/ingest';
import { isOnline } from '../lib/online';

// ---------- Rotas do dashboard (usuário) ----------
export const devicesRouter = Router();

const publicFields = {
  id: true,
  identificador_esp32: true,
  nome: true,
  status_online: true,
  ultimo_contato: true,
  criado_em: true,
} as const;

async function getOwned(id: string, fazendaId: string) {
  const d = await prisma.device.findFirst({ where: { id, fazenda_id: fazendaId }, select: publicFields });
  if (!d) throw new HttpError(404, 'DISPOSITIVO_NAO_ENCONTRADO');
  return d;
}

devicesRouter.get(
  '/',
  ah(async (req, res) => {
    const devices = await prisma.device.findMany({ where: { fazenda_id: fid(req) }, select: publicFields, orderBy: { nome: 'asc' } });
    const ids = devices.map((d) => d.id);
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const [ultimas, contagem] = await Promise.all([
      prisma.sensorLog.findMany({
        where: { dispositivo_id: { in: ids } },
        orderBy: [{ dispositivo_id: 'asc' }, { tipo_sensor: 'asc' }, { timestamp: 'desc' }],
        distinct: ['dispositivo_id', 'tipo_sensor'],
      }),
      prisma.weightLog.groupBy({
        by: ['dispositivo_id'],
        where: { dispositivo_id: { in: ids }, timestamp: { gte: inicioDia } },
        _count: { _all: true },
      }),
    ]);

    res.json(
      devices.map((d) => ({
        ...d,
        status_online: isOnline(d),
        pesagens_hoje: contagem.find((c) => c.dispositivo_id === d.id)?._count._all ?? 0,
        telemetria: Object.fromEntries(
          ultimas.filter((u) => u.dispositivo_id === d.id).map((u) => [u.tipo_sensor, { valor: u.valor, timestamp: u.timestamp }]),
        ),
      })),
    );
  }),
);

devicesRouter.post(
  '/',
  requireRole('admin'),
  ah(async (req, res) => {
    const d = z
      .object({ identificador_esp32: z.string().min(3).max(64).regex(/^[A-Za-z0-9_\-]+$/), nome: z.string().min(2) })
      .parse(req.body);
    const api_key = newDeviceKey();
    const device = await prisma.device.create({
      data: { ...d, api_key_hash: hashKey(api_key), fazenda_id: fid(req) },
      select: publicFields,
    });
    // A chave só é exibida uma vez
    res.status(201).json({ ...device, api_key });
  }),
);

devicesRouter.post(
  '/:id/rotate-key',
  requireRole('admin'),
  ah(async (req, res) => {
    const d = await getOwned(req.params.id, fid(req));
    const api_key = newDeviceKey();
    await prisma.device.update({ where: { id: d.id }, data: { api_key_hash: hashKey(api_key) } });
    res.json({ ...d, api_key });
  }),
);

devicesRouter.patch(
  '/:id',
  requireRole('admin'),
  ah(async (req, res) => {
    const d = await getOwned(req.params.id, fid(req));
    const data = z.object({ nome: z.string().min(2) }).parse(req.body);
    res.json(await prisma.device.update({ where: { id: d.id }, data, select: publicFields }));
  }),
);

devicesRouter.delete(
  '/:id',
  requireRole('admin'),
  ah(async (req, res) => {
    const d = await getOwned(req.params.id, fid(req));
    await prisma.device.delete({ where: { id: d.id } });
    res.status(204).end();
  }),
);

devicesRouter.get(
  '/:id/telemetry',
  ah(async (req, res) => {
    const d = await getOwned(req.params.id, fid(req));
    const q = z.object({ tipo: z.string().optional(), horas: z.coerce.number().min(1).max(24 * 30).default(24) }).parse(req.query);
    const logs = await prisma.sensorLog.findMany({
      where: {
        dispositivo_id: d.id,
        ...(q.tipo ? { tipo_sensor: q.tipo } : {}),
        timestamp: { gte: new Date(Date.now() - q.horas * 3_600_000) },
      },
      orderBy: { timestamp: 'asc' },
      take: 5000,
      select: { tipo_sensor: true, valor: true, timestamp: true },
    });
    res.json(logs);
  }),
);

// ---------- Rota do ESP32 (X-Device-Key) ----------
export const telemetryIngestRouter = Router();
telemetryIngestRouter.post(
  '/',
  requireDevice,
  ah(async (req, res) => {
    res.status(201).json(await ingestTelemetry(req.device!, telemetrySchema.parse(req.body)));
  }),
);
