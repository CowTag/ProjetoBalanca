import 'dotenv/config';

export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  JWT_SECRET: process.env.JWT_SECRET ?? 'troque-este-segredo',
  CORS_ORIGIN: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
  MQTT_URL: process.env.MQTT_URL ?? '',
  MQTT_USER: process.env.MQTT_USER || undefined,
  MQTT_PASS: process.env.MQTT_PASS || undefined,
  TZ_FAZENDA: process.env.TZ_FAZENDA ?? 'America/Sao_Paulo',
  DEVICE_OFFLINE_AFTER_S: Number(process.env.DEVICE_OFFLINE_AFTER_S ?? 90),
};
