import { useCallback, useState, type FormEvent } from 'react';
import { KeyRound, Plus } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { usePolling, useRealtime } from '../lib/socket';
import { useAuth } from '../hooks/useAuth';
import { SENSOR_LABEL, num, relativo } from '../lib/format';
import type { Device } from '../lib/types';
import { LiveScale } from '../components/LiveScale';
import { Badge, Button, Card, CardHeader, Empty, ErrorBox, Field, OnlineDot, Spinner } from '../components/ui';

type TelemetryPoint = { tipo_sensor: string; valor: number; timestamp: string };

export default function Devices() {
  const { user } = useAuth();
  const isAdmin = user?.funcao === 'admin';
  const list = useAsync(() => api<Device[]>('/devices'));
  const [selected, setSelected] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<{ nome: string; key: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const onStatus = useCallback(
    (s: { id: string; status_online: boolean; ultimo_contato: string | null }) =>
      list.setData((prev) => prev?.map((d) => (d.id === s.id ? { ...d, ...s } : d)) ?? prev),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useRealtime('device:status', onStatus);
  useRealtime('telemetry:new', list.reload);
  usePolling(list.reload, 10_000);

  const rotate = async (d: Device) => {
    if (!confirm(`Gerar nova chave para ${d.nome}? A chave atual deixará de funcionar.`)) return;
    const r = await api<Device>(`/devices/${d.id}/rotate-key`, { method: 'POST' });
    setNewKey({ nome: d.nome, key: r.api_key! });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-palha-900">Dispositivos</h1>
          <p className="text-sm text-palha-500">Balanças ESP32 e sensores</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus size={16} /> Nova balança
          </Button>
        )}
      </div>

      {newKey && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <div className="font-semibold text-amber-900">Chave do dispositivo “{newKey.nome}” (exibida só agora)</div>
          <code className="mt-2 block break-all rounded bg-white px-3 py-2 font-mono">{newKey.key}</code>
          <p className="mt-2 text-amber-800">
            Copie para <code>DEVICE_KEY</code> em <code>firmware/include/config.h</code> e grave o ESP32 novamente.
          </p>
          <Button variant="outline" className="mt-3" onClick={() => setNewKey(null)}>
            Entendi
          </Button>
        </div>
      )}

      {showForm && (
        <NewDeviceForm
          onCreated={(d) => {
            setShowForm(false);
            setNewKey({ nome: d.nome, key: d.api_key! });
            list.reload();
          }}
        />
      )}

      <LiveScale showLog={false} />

      <ErrorBox msg={list.error} />
      {!list.data ? (
        <Spinner />
      ) : list.data.length === 0 ? (
        <Card>
          <Empty>Nenhum dispositivo cadastrado</Empty>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.data.map((d) => (
            <Card interactive key={d.id} className={selected === d.id ? 'ring-2 ring-pasto-400' : ''}>
              <div className="flex items-start justify-between p-4">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    <OnlineDot online={d.status_online} /> {d.nome}
                  </div>
                  <div className="font-mono text-xs text-palha-500">{d.identificador_esp32}</div>
                </div>
                <Badge tone={d.status_online ? 'green' : 'gray'}>{d.status_online ? 'Online' : 'Offline'}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-px bg-palha-100 text-sm">
                <Stat label="Último contato" value={relativo(d.ultimo_contato)} />
                <Stat label="Pesagens hoje" value={num(d.pesagens_hoje)} />
                {Object.entries(d.telemetria)
                  .filter(([k]) => k !== 'uptime_s')
                  .map(([k, t]) => {
                    const meta = SENSOR_LABEL[k] ?? { nome: k, unidade: '', casas: 2 };
                    return <Stat key={k} label={meta.nome} value={`${num(t.valor, meta.casas)} ${meta.unidade}`} />;
                  })}
              </div>
              <div className="flex gap-2 p-3">
                <Button variant="outline" className="flex-1" onClick={() => setSelected(selected === d.id ? null : d.id)}>
                  {selected === d.id ? 'Ocultar gráfico' : 'Telemetria 24h'}
                </Button>
                {isAdmin && (
                  <Button variant="ghost" title="Gerar nova chave" onClick={() => rotate(d)}>
                    <KeyRound size={16} />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && <TelemetryChart deviceId={selected} name={list.data?.find((d) => d.id === selected)?.nome ?? ''} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-2">
      <div className="text-xs text-palha-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function TelemetryChart({ deviceId, name }: { deviceId: string; name: string }) {
  const [tipo, setTipo] = useState('rssi_wifi');
  const data = useAsync(() => api<TelemetryPoint[]>(`/devices/${deviceId}/telemetry?horas=24&tipo=${tipo}`), [deviceId, tipo]);
  const meta = SENSOR_LABEL[tipo];
  const points = (data.data ?? []).map((p) => ({ t: new Date(p.timestamp).getTime(), v: p.valor }));

  return (
    <Card>
      <CardHeader
        title={`Telemetria · ${name}`}
        action={
          <select className="input w-48" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {Object.entries(SENSOR_LABEL).map(([k, m]) => (
              <option key={k} value={k}>
                {m.nome}
              </option>
            ))}
          </select>
        }
      />
      <div className="h-72 p-2">
        {points.length === 0 ? (
          <Empty>Sem leituras nas últimas 24h</Empty>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ebe5d4" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(t) => new Date(Number(t)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                fontSize={12}
              />
              <YAxis domain={['auto', 'auto']} fontSize={12} width={60} />
              <Tooltip
                labelFormatter={(t) => new Date(Number(t)).toLocaleString('pt-BR')}
                formatter={(v) => [`${num(Number(v), meta?.casas ?? 2)} ${meta?.unidade ?? ''}`, meta?.nome ?? tipo]}
              />
              <Line dataKey="v" stroke="#c0935f" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function NewDeviceForm({ onCreated }: { onCreated: (d: Device) => void }) {
  const [nome, setNome] = useState('');
  const [ident, setIdent] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      onCreated(await api<Device>('/devices', { method: 'POST', json: { nome, identificador_esp32: ident } }));
    } catch {
      setErr('Erro ao criar (identificador já existe ou inválido)');
    }
  };

  return (
    <Card>
      <CardHeader title="Nova balança" />
      <form onSubmit={submit} className="grid gap-4 p-4 sm:grid-cols-3">
        <Field label="Nome">
          <input className="input" placeholder="Balança Tronco 03" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </Field>
        <Field label="Identificador ESP32 (DEVICE_ID)">
          <input className="input font-mono" placeholder="BALANCA_ESP32_03" value={ident} onChange={(e) => setIdent(e.target.value)} required />
        </Field>
        <div className="flex items-end">
          <Button className="w-full">Criar e gerar chave</Button>
        </div>
        <div className="sm:col-span-3">
          <ErrorBox msg={err} />
        </div>
      </form>
    </Card>
  );
}
