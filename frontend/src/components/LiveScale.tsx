import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ExternalLink, Radio, Scale } from 'lucide-react';
import { api } from '../lib/api';
import { usePolling, useRealtime } from '../lib/socket';
import { Card, CardHeader, Empty } from './ui';

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

const N = 'bg-palha-50 text-palha-600 ring-palha-200';
const OK = 'bg-pasto-50 text-pasto-700 ring-pasto-200';
const INFO = 'bg-ceu-100 text-slate-700 ring-ceu-200';
const WARN = 'bg-amber-50 text-amber-800 ring-amber-200';
const ERR = 'bg-red-50 text-red-700 ring-red-200';

const ESTADOS: Record<string, { label: string; tone: string }> = {
  INICIANDO: { label: 'Iniciando', tone: N },
  AGUARDANDO_TAG: { label: 'Aguardando tag', tone: INFO },
  ESTABILIZANDO: { label: 'Estabilizando', tone: WARN },
  ENVIANDO: { label: 'Enviando', tone: INFO },
  REGISTRADO: { label: 'Registrado', tone: OK },
  SALVO_OFFLINE: { label: 'Salvo offline', tone: WARN },
  PESO_INSTAVEL: { label: 'Peso instável', tone: WARN },
  TAG_NAO_CADASTRADA: { label: 'Tag não cadastrada', tone: ERR },
  ANIMAL_INATIVO: { label: 'Animal inativo', tone: ERR },
  ERRO: { label: 'Erro', tone: ERR },
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
      <CardHeader icon={<Radio size={16} />} title="Balanças em operação" subtitle="Leitura em tempo real dos equipamentos" />
      {list.length === 0 ? (
        <Empty>Nenhuma balança transmitindo. Verifique se o ESP32 está ligado e o API_BASE_URL no config.h.</Empty>
      ) : (
        <div className="grid gap-4 p-4 md:grid-cols-2">
          {list.map((s) => (
            <ScaleTile key={s.dispositivo_id} s={s} />
          ))}
        </div>
      )}

      {showLog && log.length > 0 && (
        <div className="border-t border-palha-200">
          <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-palha-500">Eventos recentes</div>
          <table className="w-full">
            <tbody className="divide-y divide-palha-100">
              {log.map((l) => {
                const e = ESTADOS[l.estado] ?? { label: l.estado, tone: N };
                return (
                  <tr key={l.id}>
                    <td className="w-0 whitespace-nowrap py-2 pl-4 pr-3 font-mono text-xs tabular-nums text-palha-500">{l.hora}</td>
                    <td className="w-0 whitespace-nowrap py-2 pr-3">
                      <span className={clsx('rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset', e.tone)}>{e.label}</span>
                    </td>
                    <td className="py-2 pr-4 text-sm text-palha-700">
                      {l.tag && <span className="mr-2 font-mono text-xs text-palha-500">{l.tag}</span>}
                      {l.mensagem}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ScaleTile({ s }: { s: LiveState }) {
  const idade = Date.now() - new Date(s.recebido_em).getTime();
  const stale = idade > STALE_MS;
  const e = ESTADOS[s.estado] ?? { label: s.estado, tone: N };
  const ativo = s.estado === 'ESTABILIZANDO' || s.estado === 'ENVIANDO';

  return (
    <div className={clsx('overflow-hidden rounded-lg border border-palha-200 bg-white', stale && 'opacity-60')}>
      <div className="flex items-center justify-between gap-2 border-b border-palha-200 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium text-palha-900">
          <Scale size={15} className="text-palha-400" /> {s.nome}
        </div>
        <span className={clsx('rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset', stale ? N : e.tone)}>{stale ? 'Sem sinal' : e.label}</span>
      </div>

      {/* Visor */}
      <div className="bg-palha-900 px-4 py-4">
        <div className="flex items-baseline justify-end gap-2 font-mono tabular-nums">
          <span className={clsx('text-4xl font-semibold tracking-tight', s.estavel ? 'text-pasto-300' : 'text-palha-100')}>{s.peso_kg.toFixed(3)}</span>
          <span className="text-sm text-palha-400">kg</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider">
          <span className="font-mono text-palha-400">{s.tag || '—'}</span>
          <span className={clsx('flex items-center gap-1.5', s.estavel ? 'text-pasto-300' : ativo ? 'text-amber-300' : 'text-palha-500')}>
            <span className={clsx('h-1.5 w-1.5 rounded-full', s.estavel ? 'bg-pasto-400' : ativo ? 'bg-amber-400' : 'bg-palha-500')} />
            {s.estavel ? 'Estável' : 'Oscilando'}
          </span>
        </div>
      </div>

      <div className="min-h-[2.75rem] px-4 py-3 text-sm text-palha-700">{s.mensagem}</div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-palha-100 bg-palha-50 px-4 py-2 text-xs text-palha-500">
        <span className="tabular-nums">
          {stale ? `Último sinal há ${Math.round(idade / 1000)}s` : 'Atualizado agora'}
          {s.fila > 0 && <span className="ml-2 font-medium text-amber-700">· {s.fila} na fila offline</span>}
          {s.wifi_rssi != null && <span className="ml-2">· Wi-Fi {s.wifi_rssi} dBm</span>}
        </span>
        {s.ip && (
          <a href={`http://${s.ip}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-pasto-700 hover:underline">
            Painel do equipamento <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
