import mqtt from 'mqtt';
import { env } from './env';
import { prisma } from './lib/prisma';
import { HttpError } from './lib/http';
import { ingestTelemetry, ingestWeighing, telemetrySchema, weighingSchema } from './services/ingest';

/**
 * Ponte MQTT (opcional). Tópicos:
 *   cowtag/<device_id>/pesagem     -> mesma payload do POST /api/v1/weighings
 *   cowtag/<device_id>/telemetria  -> mesma payload do POST /api/v1/telemetry
 * Resposta publicada em:
 *   cowtag/<device_id>/resposta    -> { ok, status, ...resultado | error }
 * A autenticação de dispositivos MQTT é feita no broker (usuário/senha/ACL).
 */
export function startMqttBridge() {
  if (!env.MQTT_URL) {
    console.log('[MQTT] desativado (MQTT_URL vazio)');
    return;
  }
  const client = mqtt.connect(env.MQTT_URL, {
    username: env.MQTT_USER,
    password: env.MQTT_PASS,
    clientId: `cowtag-backend-${Math.random().toString(16).slice(2, 8)}`,
    reconnectPeriod: 5000,
  });

  client.on('connect', () => {
    console.log(`[MQTT] conectado em ${env.MQTT_URL}`);
    client.subscribe(['cowtag/+/pesagem', 'cowtag/+/telemetria'], { qos: 1 });
  });
  client.on('error', (e) => console.error('[MQTT]', e.message));

  client.on('message', async (topic, buf) => {
    const [, ident, tipo] = topic.split('/');
    const reply = (body: object) => client.publish(`cowtag/${ident}/resposta`, JSON.stringify(body), { qos: 1 });
    try {
      const device = await prisma.device.findUnique({ where: { identificador_esp32: ident } });
      if (!device) throw new HttpError(404, 'DISPOSITIVO_NAO_CADASTRADO');

      const raw = { ...JSON.parse(buf.toString()), device_id: ident };
      if (tipo === 'pesagem') {
        const r = await ingestWeighing(device, weighingSchema.parse(raw));
        reply({ ok: true, status: r.duplicado ? 200 : 201, ...r });
      } else if (tipo === 'telemetria') {
        await ingestTelemetry(device, telemetrySchema.parse(raw));
      }
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 400;
      const error = e instanceof HttpError ? e.code : 'PAYLOAD_INVALIDA';
      console.warn(`[MQTT] ${topic}: ${error}`);
      reply({ ok: false, status, error });
    }
  });
}
