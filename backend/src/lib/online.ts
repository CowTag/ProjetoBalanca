import { env } from '../env';

/**
 * Online = teve contato nos últimos DEVICE_OFFLINE_AFTER_S segundos.
 * Calculado na leitura, sem depender de timer — funciona também na Vercel (serverless).
 */
export function isOnline(d: { status_online: boolean; ultimo_contato: Date | null }) {
  if (!d.status_online || !d.ultimo_contato) return false;
  return Date.now() - d.ultimo_contato.getTime() < env.DEVICE_OFFLINE_AFTER_S * 1000;
}
