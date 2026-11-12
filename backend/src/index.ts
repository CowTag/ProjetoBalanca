import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env';
import { prisma } from './lib/prisma';
import { errorHandler } from './lib/http';
import { requireUser } from './middleware/auth';
import { initRealtime, emitToFarm } from './realtime';
import { startMqttBridge } from './mqtt';
import { authRouter } from './routes/auth';
import { animalsRouter } from './routes/animals';
import { devicesRouter, telemetryIngestRouter } from './routes/devices';
import { weighingsRouter } from './routes/weighings';
import { metricsRouter } from './routes/metrics';
import { farmRouter } from './routes/farm';
import { liveRouter } from './routes/live';

const app = express();
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: '256kb' }));
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true, ts: new Date() });
});

// Públicas / dispositivos
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/weighings', weighingsRouter);       // POST = dispositivo, GET = usuário
app.use('/api/v1/telemetry', telemetryIngestRouter); // dispositivo
app.use('/api/v1/live', liveRouter);                 // POST = dispositivo, GET = usuário

// Autenticadas (usuário)
app.use('/api/v1/animals', requireUser, animalsRouter);
app.use('/api/v1/devices', requireUser, devicesRouter);
app.use('/api/v1/metrics', requireUser, metricsRouter);
app.use('/api/v1', requireUser, farmRouter);          // /farm, /users

app.use(errorHandler);

const server = http.createServer(app);
initRealtime(server);
startMqttBridge();

// Marca como offline dispositivos sem contato recente
setInterval(async () => {
  const limite = new Date(Date.now() - env.DEVICE_OFFLINE_AFTER_S * 1000);
  const stale = await prisma.device.findMany({
    where: { status_online: true, OR: [{ ultimo_contato: null }, { ultimo_contato: { lt: limite } }] },
  });
  for (const d of stale) {
    await prisma.device.update({ where: { id: d.id }, data: { status_online: false } });
    emitToFarm(d.fazenda_id, 'device:status', { id: d.id, status_online: false, ultimo_contato: d.ultimo_contato });
    console.log(`[DEVICE] ${d.identificador_esp32} offline`);
  }
}, 15_000);

server.listen(env.PORT, '0.0.0.0', () => console.log(`CowTag API em http://0.0.0.0:${env.PORT}`));
