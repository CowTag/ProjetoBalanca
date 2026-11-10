const nf = (d: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export const kg = (v: number | null | undefined, d = 1) => (v == null ? '—' : `${nf(d).format(v)} kg`);
export const num = (v: number | null | undefined, d = 0) => (v == null ? '—' : nf(d).format(v));
export const gmdFmt = (v: number | null | undefined) => (v == null ? '—' : `${nf(3).format(v)} kg/dia`);

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
export const dateOnly = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
export const shortDay = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};

export function idadeMeses(nasc: string | null) {
  if (!nasc) return '—';
  const m = Math.floor((Date.now() - new Date(nasc).getTime()) / (30.44 * 86_400_000));
  return `${m} m`;
}

export function relativo(iso: string | null) {
  if (!iso) return 'nunca';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

export const STATUS_LABEL = { ativo: 'Ativo', vendido: 'Vendido', obito: 'Óbito' } as const;

export const SENSOR_LABEL: Record<string, { nome: string; unidade: string; casas: number }> = {
  rssi_wifi: { nome: 'Sinal Wi-Fi', unidade: 'dBm', casas: 0 },
  temperatura_chip: { nome: 'Temp. chip', unidade: '°C', casas: 1 },
  temperatura_ambiente: { nome: 'Temp. ambiente', unidade: '°C', casas: 1 },
  bateria_v: { nome: 'Bateria', unidade: 'V', casas: 2 },
  heap_livre_kb: { nome: 'Memória livre', unidade: 'KB', casas: 0 },
  uptime_s: { nome: 'Uptime', unidade: 's', casas: 0 },
  fila_pendente: { nome: 'Fila offline', unidade: '', casas: 0 },
};
