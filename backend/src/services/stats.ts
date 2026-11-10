import { prisma } from '../lib/prisma';
import { gmd } from '../lib/livestock';

/** Primeira e última pesagem de cada animal (uma query para cada ponta). */
export async function firstAndLastWeights(animalIds: string[]) {
  if (animalIds.length === 0) return new Map<string, { primeira: P; ultima: P; gmd: number | null }>();
  const select = { animal_id: true, peso_kg: true, timestamp: true } as const;
  const [ultimas, primeiras] = await Promise.all([
    prisma.weightLog.findMany({
      where: { animal_id: { in: animalIds } },
      orderBy: [{ animal_id: 'asc' }, { timestamp: 'desc' }],
      distinct: ['animal_id'],
      select,
    }),
    prisma.weightLog.findMany({
      where: { animal_id: { in: animalIds } },
      orderBy: [{ animal_id: 'asc' }, { timestamp: 'asc' }],
      distinct: ['animal_id'],
      select,
    }),
  ]);
  const prim = new Map(primeiras.map((p) => [p.animal_id, p]));
  const out = new Map<string, { primeira: P; ultima: P; gmd: number | null }>();
  for (const u of ultimas) {
    const p = prim.get(u.animal_id)!;
    out.set(u.animal_id, { primeira: p, ultima: u, gmd: gmd(p, u) });
  }
  return out;
}

type P = { animal_id: string; peso_kg: number; timestamp: Date };
