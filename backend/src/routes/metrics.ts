import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ah } from '../lib/http';
import { round3 } from '../lib/livestock';
import { env } from '../env';
import { fid } from '../middleware/auth';
import { firstAndLastWeights } from '../services/stats';

export const metricsRouter = Router();

/** GET /api/v1/metrics/overview?dias=14 — KPIs do dashboard */
metricsRouter.get(
  '/overview',
  ah(async (req, res) => {
    const fazendaId = fid(req);
    const { dias } = z.object({ dias: z.coerce.number().min(1).max(365).default(14) }).parse(req.query);
    const desde = new Date(Date.now() - dias * 86_400_000);
    const tz = env.TZ_FAZENDA;

    const [porStatus, ativos, devices, serie, hojeRows] = await Promise.all([
      prisma.animal.groupBy({ by: ['status'], where: { fazenda_id: fazendaId }, _count: { _all: true } }),
      prisma.animal.findMany({ where: { fazenda_id: fazendaId, status: 'ativo' }, select: { id: true, brinco_visual: true, raca: true } }),
      prisma.device.findMany({ where: { fazenda_id: fazendaId }, select: { status_online: true } }),
      prisma.$queryRaw<{ dia: Date; total: number; peso_medio: number }[]>`
        SELECT date_trunc('day', w."timestamp" AT TIME ZONE ${tz}) AS dia,
               COUNT(*)::int AS total,
               AVG(w.peso_kg)::float AS peso_medio
        FROM weight_logs w
        JOIN animals a ON a.id = w.animal_id
        WHERE a.fazenda_id = ${fazendaId} AND w."timestamp" >= ${desde}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total
        FROM weight_logs w
        JOIN animals a ON a.id = w.animal_id
        WHERE a.fazenda_id = ${fazendaId}
          AND (w."timestamp" AT TIME ZONE ${tz})::date = (now() AT TIME ZONE ${tz})::date`,
    ]);

    const stats = await firstAndLastWeights(ativos.map((a) => a.id));
    const ultimos = [...stats.values()].map((s) => s.ultima.peso_kg);
    const gmds = [...stats.entries()].filter(([, s]) => s.gmd !== null);
    const avg = (xs: number[]) => (xs.length ? round3(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

    const ranking = gmds
      .map(([id, s]) => {
        const a = ativos.find((x) => x.id === id)!;
        return { animal_id: id, brinco_visual: a.brinco_visual, raca: a.raca, gmd_kg_dia: s.gmd!, peso_atual_kg: s.ultima.peso_kg };
      })
      .sort((a, b) => b.gmd_kg_dia - a.gmd_kg_dia);

    res.json({
      animais: {
        ativos: porStatus.find((s) => s.status === 'ativo')?._count._all ?? 0,
        vendidos: porStatus.find((s) => s.status === 'vendido')?._count._all ?? 0,
        obitos: porStatus.find((s) => s.status === 'obito')?._count._all ?? 0,
      },
      pesagens_hoje: hojeRows[0]?.total ?? 0,
      peso_medio_rebanho_kg: avg(ultimos),
      gmd_medio_kg_dia: avg(gmds.map(([, s]) => s.gmd!)),
      dispositivos: { total: devices.length, online: devices.filter((d) => d.status_online).length },
      serie_diaria: serie.map((s) => ({
        dia: s.dia.toISOString().slice(0, 10),
        total: s.total,
        peso_medio: round3(s.peso_medio),
      })),
      top_gmd: ranking.slice(0, 5),
      pior_gmd: ranking.slice(-5).reverse(),
    });
  }),
);
