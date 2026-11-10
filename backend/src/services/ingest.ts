import { z } from 'zod';
import type { Device } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/http';
import { normalizeTag, round3 } from '../lib/livestock';
import { emitToFarm } from '../realtime';

// ------------------------------------------------------------------
// Schemas das payloads vindas do ESP32 (HTTP ou MQTT)
// ------------------------------------------------------------------
export const weighingSchema = z.object({
  device_id: z.string().min(1),
  rfid_tag: z.string().min(4).max(40),
  weight_kg: z.coerce.number().positive().max(2000),
  timestamp: z.string().datetime({ offset: true }).optional(),
});
export type WeighingInput = z.infer<typeof weighingSchema>;

export const telemetrySchema = z.object({
  device_id: z.string().min(1),
  readings: z
    .array(z.object({ tipo_sensor: z.string().min(1).max(40), valor: z.coerce.number() }))
    .min(1)
    .max(50),
});
export type TelemetryInput = z.infer<typeof telemetrySchema>;

// ------------------------------------------------------------------
/** Marca o dispositivo como online e notifica o dashboard se mudou de estado. */
export async function touchDevice(device: Device) {
  const updated = await prisma.device.update({
    where: { id: device.id },
    data: { status_online: true, ultimo_contato: new Date() },
  });
  if (!device.status_online) {
    emitToFarm(device.fazenda_id, 'device:status', {
      id: device.id,
      status_online: true,
      ultimo_contato: updated.ultimo_contato,
    });
  }
}

/** Resolve o timestamp enviado pelo ESP32 (ou usa o horário do servidor). */
function resolveTimestamp(ts?: string): Date {
  const now = new Date();
  if (!ts) return now;
  const d = new Date(ts);
  // relógio do ESP adiantado > 5 min: confia no servidor
  return d.getTime() - now.getTime() > 5 * 60_000 ? now : d;
}

export async function ingestWeighing(device: Device, input: WeighingInput) {
  const tag = normalizeTag(input.rfid_tag);
  const animal = await prisma.animal.findFirst({ where: { tag_rfid: tag, fazenda_id: device.fazenda_id } });

  await touchDevice(device);

  if (!animal) throw new HttpError(404, 'ANIMAL_NAO_ENCONTRADO', `Tag ${tag} não cadastrada`);
  if (animal.status !== 'ativo') throw new HttpError(409, 'ANIMAL_INATIVO', `Animal está como ${animal.status}`);

  const ts = resolveTimestamp(input.timestamp);
  const peso = round3(input.weight_kg);

  // Idempotência: reenvio do buffer offline com mesmo timestamp
  const dup = await prisma.weightLog.findFirst({
    where: { animal_id: animal.id, dispositivo_id: device.id, timestamp: ts },
  });

  const anterior = await prisma.weightLog.findFirst({
    where: { animal_id: animal.id, timestamp: { lt: ts } },
    orderBy: { timestamp: 'desc' },
  });

  const log = dup ?? (await prisma.weightLog.create({
    data: { animal_id: animal.id, dispositivo_id: device.id, peso_kg: peso, timestamp: ts },
  }));

  const result = {
    id: log.id,
    animal_id: animal.id,
    brinco_visual: animal.brinco_visual,
    tag_rfid: animal.tag_rfid,
    dispositivo_id: device.id,
    dispositivo_nome: device.nome,
    peso_kg: log.peso_kg,
    timestamp: log.timestamp,
    ganho_kg: anterior ? round3(log.peso_kg - anterior.peso_kg) : null,
    duplicado: Boolean(dup),
  };

  if (!dup) emitToFarm(device.fazenda_id, 'weighing:new', result);
  return result;
}

export async function ingestTelemetry(device: Device, input: TelemetryInput) {
  const now = new Date();
  await prisma.sensorLog.createMany({
    data: input.readings.map((r) => ({
      dispositivo_id: device.id,
      tipo_sensor: r.tipo_sensor,
      valor: r.valor,
      timestamp: now,
    })),
  });
  await touchDevice(device);
  emitToFarm(device.fazenda_id, 'telemetry:new', { dispositivo_id: device.id, timestamp: now, readings: input.readings });
  return { gravados: input.readings.length };
}
