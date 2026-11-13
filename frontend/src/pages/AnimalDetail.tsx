import { useCallback, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { usePolling, useRealtime } from '../lib/socket';
import { dateOnly, dateTime, gmdFmt, idadeMeses, kg } from '../lib/format';
import type { AnimalDetail as AD, Weighing } from '../lib/types';
import { CowHead } from '../components/FarmArt';
import { AnimalActions, StatusInfo } from '../components/AnimalManage';
import { Button, Card, CardHeader, Empty, ErrorBox, Field, Kpi, Spinner, StatusBadge } from '../components/ui';

export default function AnimalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const a = useAsync(() => api<AD>(`/animals/${id}`), [id]);
  const [peso, setPeso] = useState('');

  const onWeighing = useCallback(
    (w: Weighing) => {
      if (w.animal_id === id) a.reload();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );
  useRealtime('weighing:new', onWeighing);
  usePolling(a.reload, 30_000);

  if (a.error) return <ErrorBox msg={a.error} />;
  if (!a.data) return <Spinner />;
  const d = a.data;

  const chart = d.pesagens.map((p) => ({ t: new Date(p.timestamp).getTime(), peso: p.peso_kg }));

  const addManual = async (e: FormEvent) => {
    e.preventDefault();
    await api(`/animals/${d.id}/weighings`, { method: 'POST', json: { peso_kg: Number(peso.replace(',', '.')) } });
    setPeso('');
    a.reload();
  };

  return (
    <div className="space-y-6">
      <Link to="/animais" className="inline-flex items-center gap-1 text-sm text-palha-500 hover:text-palha-800">
        <ArrowLeft size={16} /> Rebanho
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pasto-100 ring-1 ring-pasto-200">
              <CowHead className="h-9 w-9" />
            </span>
            <h1 className="text-2xl font-extrabold text-palha-900">{d.brinco_visual}</h1>
            <StatusBadge status={d.status} />
          </div>
          <p className="text-sm text-palha-500">
            <span className="font-mono">{d.tag_rfid}</span> · {d.raca ?? 'Sem raça'} · {d.sexo === 'M' ? 'Macho' : 'Fêmea'} · Nasc.{' '}
            {dateOnly(d.data_nascimento)} ({idadeMeses(d.data_nascimento)})
          </p>
          <StatusInfo animal={d} />
        </div>
        <AnimalActions animal={d} onChanged={a.reload} onDeleted={() => navigate('/animais', { replace: true })} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi delay={0} label="Peso atual" value={d.resumo.peso_atual_kg} format={(n) => kg(n)} />
        <Kpi delay={60} label="Peso inicial" value={d.resumo.peso_inicial_kg} format={(n) => kg(n)} />
        <Kpi delay={120} label="Ganho total" value={d.resumo.ganho_total_kg} format={(n) => kg(n)} />
        <Kpi delay={180} label="GMD total" value={d.resumo.gmd_kg_dia} format={gmdFmt} />
        <Kpi delay={240} label="GMD 30 dias" value={d.resumo.gmd_30d_kg_dia} format={gmdFmt} />
      </div>

      <Card>
        <CardHeader title="Evolução de peso" subtitle={`${d.resumo.total_pesagens} pesagens`} />
        <div className="h-80 p-2">
          {chart.length < 1 ? (
            <Empty>Sem pesagens</Empty>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="gPeso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#86bf70" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#86bf70" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ebe5d4" />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(t) => new Date(Number(t)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  fontSize={12}
                />
                <YAxis domain={['auto', 'auto']} fontSize={12} unit=" kg" width={70} />
                <Tooltip labelFormatter={(t) => dateTime(new Date(Number(t)).toISOString())} formatter={(v) => [kg(Number(v), 3), 'Peso']} />
                <Area type="monotone" dataKey="peso" stroke="#518a40" strokeWidth={2.5} fill="url(#gPeso)" dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Histórico" />
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-pasto-50">
                <tr>
                  <th className="th">Data</th>
                  <th className="th">Origem</th>
                  <th className="th text-right">Peso</th>
                  <th className="th text-right">Variação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-palha-100">
                {[...d.pesagens].reverse().map((p, i, arr) => {
                  const prev = arr[i + 1];
                  const diff = prev ? p.peso_kg - prev.peso_kg : null;
                  return (
                    <tr key={p.id} className="row-hover">
                      <td className="td">{dateTime(p.timestamp)}</td>
                      <td className="td text-palha-500">{p.dispositivo ?? 'Manual'}</td>
                      <td className="td text-right font-medium">{kg(p.peso_kg, 3)}</td>
                      <td className={`td text-right ${diff == null ? '' : diff >= 0 ? 'text-pasto-700' : 'text-red-600'}`}>
                        {diff == null ? '—' : `${diff >= 0 ? '+' : ''}${kg(diff, 3)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Pesagem manual" subtitle="Para quando a balança não estiver disponível" />
          <form onSubmit={addManual} className="space-y-3 p-4">
            <Field label="Peso (kg)">
              <input className="input" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} required />
            </Field>
            <Button className="w-full">Registrar</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
