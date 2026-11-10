/** Normaliza o UID RFID para o formato "43:A2:89:C1". */
export function normalizeTag(raw: string): string {
  const hex = raw.trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  if (hex.length % 2 !== 0 || hex.length === 0) return raw.trim().toUpperCase();
  return hex.match(/.{2}/g)!.join(':');
}

export const round3 = (n: number) => Math.round(n * 1000) / 1000;

type Ponto = { peso_kg: number; timestamp: Date };

/**
 * GMD - Ganho Médio Diário (kg/dia) entre a primeira e a última pesagem.
 * Retorna null se houver menos de 2 pesagens ou intervalo < 1 dia.
 */
export function gmd(primeira?: Ponto | null, ultima?: Ponto | null): number | null {
  if (!primeira || !ultima) return null;
  const dias = (ultima.timestamp.getTime() - primeira.timestamp.getTime()) / 86_400_000;
  if (dias < 1) return null;
  return round3((ultima.peso_kg - primeira.peso_kg) / dias);
}
