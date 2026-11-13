import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError, ah } from '../lib/http';
import { gmd, normalizeTag, round3 } from '../lib/livestock';
import { fid, requireRole } from '../middleware/auth';
import { firstAndLastWeights } from '../services/stats';

export const animalsRouter = Router();

const baseSchema = z.object({
  tag_rfid: z.string().min(4).max(40).transform(normalizeTag),
  brinco_visual: z.string().min(1).max(30),
  raca: z.string().max(60).nullish(),
  data_nascimento: z.coerce.date().nullish(),
  sexo: z.enum(['M', 'F']),
  status: z.enum(['ativo', 'vendido', 'obito']).default('ativo'),
  status_data: z.coerce.date().nullish(),
  status_obs: z.string().trim().max(200).nullish(),
});

/**
 * Coerência da situação: voltar para "ativo" limpa data/observação da saída;
 * vendido/óbito sem data assume hoje.
 */
function normalizeStatus<T extends { status?: string; status_data?: Date | null; status_obs?: string | null }>(d: T): T {
  if (d.status === 'ativo') return { ...d, status_data: null, status_obs: null };
  if (d.status && !d.status_data) return { ...d, status_data: new Date() };
  return d;
}

async function getOwned(id: string, fazendaId: string) {
  const a = await prisma.animal.findFirst({ where: { id, fazenda_id: fazendaId } });
  if (!a) throw new HttpError(404, 'ANIMAL_NAO_ENCONTRADO');
  return a;
}

// Lista com último peso e GMD
animalsRouter.get(
  '/',
  ah(async (req, res) => {
    const q = z
      .object({ q: z.string().optional(), status: z.enum(['ativo', 'vendido', 'obito']).optional() })
      .parse(req.query);
    const where: Prisma.AnimalWhereInput = { fazenda_id: fid(req) };
    if (q.status) where.status = q.status;
    if (q.q) {
      where.OR = [
        { brinco_visual: { contains: q.q, mode: 'insensitive' } },
        { tag_rfid: { contains: q.q.toUpperCase() } },
        { raca: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    const animals = await prisma.animal.findMany({ where, orderBy: { brinco_visual: 'asc' } });
    const stats = await firstAndLastWeights(animals.map((a) => a.id));
    res.json(
      animals.map((a) => {
        const s = stats.get(a.id);
        return {
          ...a,
          ultimo_peso_kg: s?.ultima.peso_kg ?? null,
          ultima_pesagem_em: s?.ultima.timestamp ?? null,
          gmd_kg_dia: s?.gmd ?? null,
        };
      }),
    );
  }),
);

// Detalhe + histórico de pesagens
animalsRouter.get(
  '/:id',
  ah(async (req, res) => {
    const animal = await getOwned(req.params.id, fid(req));
    const pesagens = await prisma.weightLog.findMany({
      where: { animal_id: animal.id },
      orderBy: { timestamp: 'asc' },
      include: { dispositivo: { select: { nome: true } } },
    });
    const primeira = pesagens[0];
    const ultima = pesagens[pesagens.length - 1];
    // GMD dos últimos 30 dias
    const corte = Date.now() - 30 * 86_400_000;
    const recentes = pesagens.filter((p) => p.timestamp.getTime() >= corte);

    res.json({
      ...animal,
      pesagens: pesagens.map((p) => ({
        id: p.id,
        peso_kg: p.peso_kg,
        timestamp: p.timestamp,
        dispositivo: p.dispositivo?.nome ?? null,
      })),
      resumo: {
        total_pesagens: pesagens.length,
        peso_inicial_kg: primeira?.peso_kg ?? null,
        peso_atual_kg: ultima?.peso_kg ?? null,
        ganho_total_kg: primeira && ultima ? round3(ultima.peso_kg - primeira.peso_kg) : null,
        gmd_kg_dia: gmd(primeira, ultima),
        gmd_30d_kg_dia: gmd(recentes[0], recentes[recentes.length - 1]),
      },
    });
  }),
);

animalsRouter.post(
  '/',
  ah(async (req, res) => {
    const data = normalizeStatus(baseSchema.parse(req.body));
    const animal = await prisma.animal.create({ data: { ...data, fazenda_id: fid(req) } });
    res.status(201).json(animal);
  }),
);

animalsRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const a = await getOwned(req.params.id, fid(req));
    const data = normalizeStatus(baseSchema.partial().parse(req.body));
    res.json(await prisma.animal.update({ where: { id: a.id }, data }));
  }),
);

animalsRouter.delete(
  '/:id',
  requireRole('admin'),
  ah(async (req, res) => {
    const a = await getOwned(req.params.id, fid(req));
    await prisma.animal.delete({ where: { id: a.id } });
    res.status(204).end();
  }),
);

// Pesagem manual (sem balança)
animalsRouter.post(
  '/:id/weighings',
  ah(async (req, res) => {
    const a = await getOwned(req.params.id, fid(req));
    const d = z
      .object({ peso_kg: z.coerce.number().positive().max(2000), timestamp: z.coerce.date().optional() })
      .parse(req.body);
    const log = await prisma.weightLog.create({
      data: { animal_id: a.id, peso_kg: round3(d.peso_kg), timestamp: d.timestamp ?? new Date() },
    });
    res.status(201).json(log);
  }),
);
