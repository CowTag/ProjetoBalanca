import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ExternalLink, Radio, Scale } from 'lucide-react';
import { api } from '../lib/api';
import { usePolling, useRealtime } from '../lib/socket';
import { Card, CardHeader, Empty } from './ui';
import { Cow } from './FarmArt';

export interface LiveState {
  dispositivo_id: string;
  nome: string;
  estado: string;
  peso_kg: number;
  estavel: boolean;
  tag: string;
  mensagem: string;
  fila: number;
  ip?: string;
  wifi_rssi?: number;
  recebido_em: string;
}

const ESTADOS: Record<string, { label: string; tone: string }> = {
  INICIANDO: { label: 'Iniciando', tone: 'bg-palha-100 text-palha-600' },
  AGUARDANDO_TAG: { label: 'Aguardando tag', tone: 'bg-ceu-200 text-sky-800' },
  ESTABILIZANDO: { label: 'Estabilizando', tone: 'bg-terra-300/40 text-terra-600' },
  ENVIANDO: { label: 'Enviando', tone: 'bg-ceu-200 text-sky-800' },
  REGISTRADO: { label: 'Registrado', tone: 'bg-pasto-100 text-pasto-700' },
  SALVO_OFFLINE: { label: 'Salvo offline', tone: 'bg-terra-300/40 text-terra-600' },
  PESO_INSTAVEL: { label: 'Peso instável', tone: 'bg-terra-300/40 text-terra-600' },
  TAG_NAO_CADASTRADA: { label: 'Tag não cadastrada', tone: 'bg-red-50 text-red-600' },
  ANIMAL_INATIVO: { label: 'Animal inativo', tone: 'bg-red-50 text-red-600' },
  ERRO: { label: 'Erro', tone: 'bg-red-50 text-red-600' },
};

const STALE_MS = 15_000;

type LogItem = { id: number; hora: string; nome: string; estado: string; tag: string; mensagem: string };

/** Painel "Balança ao vivo": substitui o display físico da balança. */
export function LiveScale({ showLog = true }: { showLog?: boolean }) {
  const [states, setStates] = useState<Record<string, LiveState>>({});
  const [log, setLog] = useState<LogItem[]>([]);
  const [, setNow] = useState(Date.now());

  useEffect(() => {
    api<LiveState[]>('/live')
      .then((list) => setStates(Object.fromEntries(list.map((s) => [s.dispositivo_id, s]))))
      .catch(() => undefined);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const prevRef = useRef<Record<string, LiveState>>({});
  useEffect(() => {
    prevRef.current = states;
  }, [states]);

  const onLive = useCallback((s: LiveState) => {
    const old = prevRef.current[s.dispositivo_id];
    const mudou = !old || old.estado !== s.estado || old.mensagem !== s.mensagem;
    if (mudou && s.estado !== 'AGUARDANDO_TAG') {
      const item: LogItem = {
        id: Date.now() + Math.random(),
        hora: new Date(s.recebido_em).toLocaleTimeString('pt-BR'),
        nome: s.nome,
        estado: s.estado,
        tag: s.tag,
        mensagem: s.mensagem,
      };
      setLog((l) => [item, ...l].slice(0, 12));
    }
    prevRef.current = { ...prevRef.current, [s.dispositivo_id]: s };
    setStates((prev) => ({ ...prev, [s.dispositivo_id]: s }));
  }, []);
  useRealtime('scale:live', onLive);
  usePolling(() => {
    api<LiveState[]>('/live')
      .then((list) => list.forEach((s) => {
        const old = prevRef.current[s.dispositivo_id];
        if (!old || old.recebido_em !== s.recebido_em) onLive(s);
      }))
      .catch(() => undefined);
  }, 2000);

  const list = Object.values(states);

  return (
    <Card>
      <CardHeader
        icon={<Radio size={16} />}
        title="Balança ao vivo"
        subtitle="O que a balança está fazendo agora — atualiza a cada segundo"
      />
      {list.length === 0 ? (
        <Empty>Nenhuma balança transmitindo. Ligue o ESP32 e confira o API_BASE_URL no config.h.</Empty>
      ) : (
        <div className="grid gap-4 p-4 md:grid-cols-2">
          {list.map((s) => (
            <ScaleTile key={s.dispositivo_id} s={s} />
          ))}
        </div>
      )}

      {showLog && log.length > 0 && (
        <div className="border-t border-palha-100 px-4 py-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-palha-500">Eventos recentes</div>
          <ul className="space-y-1.5">
            {log.map((l) => {
              const e = ESTADOS[l.estado] ?? { label: l.estado, tone: 'bg-palha-100 text-palha-600' };
              return (
                <li key={l.id} className="flex animate-fade-up flex-wrap items-center gap-2 text-sm">
                  <span className="tabular-nums text-xs text-palha-400">{l.hora}</span>
                  <span className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', e.tone)}>{e.label}</span>
                  {l.tag && <span className="font-mono text-xs text-palha-500">{l.tag}</span>}
                  <span className="text-palha-600">{l.mensagem}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

function ScaleTile({ s }: { s: LiveState }) {
  const idade = Date.now() - new Date(s.recebido_em).getTime();
  const stale = idade > STALE_MS;
  const e = ESTADOS[s.estado] ?? { label: s.estado, tone: 'bg-palha-100 text-palha-600' };
  const ativo = s.estado === 'ESTABILIZANDO' || s.estado === 'ENVIANDO';

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl border p-4 transition',
        stale ? 'border-palha-200 bg-palha-50 opacity-60' : 'border-pasto-100 bg-gradient-to-br from-white to-pasto-50',
        s.estado === 'REGISTRADO' && !stale && 'ring-2 ring-pasto-300',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-bold text-palha-900">
          <Scale size={16} className="text-pasto-600" /> {s.nome}
        </div>
        <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-semibold', stale ? 'bg-palha-200 text-palha-600' : e.tone)}>
          {stale ? 'Sem sinal' : e.label}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className={clsx('text-4xl font-extrabold tabular-nums transition-colors', s.estavel ? 'text-pasto-600' : 'text-palha-800')}>
            {s.peso_kg.toFixed(3)}
            <span className="ml-1 text-base font-semibold text-palha-400">kg</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-palha-500">
            <span className={clsx('h-2 w-2 rounded-full', s.estavel ? 'bg-pasto-500' : ativo ? 'animate-pulse bg-terra-400' : 'bg-palha-300')} />
            {s.estavel ? 'Peso estável' : 'Oscilando'}
          </div>
        </div>
        <Cow className={clsx('w-16 transition', ativo && 'animate-bounce')} grazing={!ativo} />
      </div>

      <div className="mt-3 min-h-[1.25rem] text-sm text-palha-600">
        {s.tag && <span className="mr-2 rounded bg-white px-1.5 py-0.5 font-mono text-xs text-palha-700 ring-1 ring-palha-200">{s.tag}</span>}
        {s.mensagem}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-palha-100 pt-2 text-xs text-palha-400">
        <span>
          {stale ? `último sinal há ${Math.round(idade / 1000)}s` : 'agora'}
          {s.fila > 0 && <span className="ml-2 font-semibold text-terra-600">· {s.fila} na fila offline</span>}
          {s.wifi_rssi != null && <span className="ml-2">· Wi-Fi {s.wifi_rssi} dBm</span>}
        </span>
        {s.ip && (
          <a href={`http://${s.ip}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-pasto-600 hover:underline">
            Página da balança <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
