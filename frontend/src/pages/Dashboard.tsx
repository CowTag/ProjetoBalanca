import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Beef, Cpu, Scale, TrendingUp } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { usePolling, useRealtime } from '../lib/socket';
import { dateTime, gmdFmt, kg, shortDay } from '../lib/format';
import type { Overview, RankItem, Weighing } from '../lib/types';
import { Badge, Card, CardHeader, Empty, ErrorBox, Kpi, PageTitle, Spinner } from '../components/ui';
import { LiveScale } from '../components/LiveScale';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();
  const overview = useAsync(() => api<Overview>('/metrics/overview?dias=30'));
  const feed = useAsync(() => api<Weighing[]>('/weighings?limit=12'));
  const [flashId, setFlashId] = useState<string | null>(null);

  const onWeighing = useCallback(
    (w: Weighing) => {
      feed.setData((prev) => [w, ...(prev ?? [])].slice(0, 12));
      setFlashId(w.id);
      overview.reload();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useRealtime('weighing:new', onWeighing);
  useRealtime('device:status', overview.reload);
  usePolling(() => {
    feed.reload();
    overview.reload();
  }, 15_000);

  const o = overview.data;

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <PageTitle
        title="Painel"
        subtitle={
          <>
            {user?.fazenda.nome} · <span className="capitalize">{hoje}</span>
          </>
        }
        action={
          <div className="flex gap-2">
            <Link to="/animais" className="inline-flex items-center rounded-md border border-palha-300 bg-white px-3.5 py-2 text-sm font-medium text-palha-700 hover:bg-palha-50">
              Rebanho
            </Link>
            <Link to="/dispositivos" className="inline-flex items-center rounded-md bg-pasto-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-pasto-700">
              Balanças
            </Link>
          </div>
        }
      />

      <ErrorBox msg={overview.error} />

      {!o ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Animais ativos" value={o.animais.ativos} hint={`${o.animais.vendidos} vendidos · ${o.animais.obitos} óbitos`} icon={<Beef size={16} />} />
          <Kpi label="Pesagens hoje" value={o.pesagens_hoje} icon={<Scale size={16} />} />
          <Kpi label="Peso médio" value={o.peso_medio_rebanho_kg} format={(n) => kg(n)} hint="Última pesagem de cada animal" icon={<Activity size={16} />} />
          <Kpi label="GMD médio" value={o.gmd_medio_kg_dia} format={gmdFmt} hint="Ganho médio diário" icon={<TrendingUp size={16} />} />
          <Kpi
            label="Balanças online"
            display={`${o.dispositivos.online}/${o.dispositivos.total}`}
            icon={<Cpu size={16} />}
            hint={<Link to="/dispositivos" className="font-medium text-palha-900 hover:text-pasto-700 hover:underline">Ver equipamentos</Link>}
          />
        </div>
      )}

      <LiveScale />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Pesagens por dia" subtitle="Quantidade (barras) e peso médio (linha) — 30 dias" />
          <div className="h-72 p-2">
            {o && o.serie_diaria.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={o.serie_diaria}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eceff2" vertical={false} />
                  <XAxis dataKey="dia" tickFormatter={shortDay} fontSize={11} stroke="#959eaa" tickLine={false} axisLine={false} />
                  <YAxis yAxisId="q" allowDecimals={false} fontSize={11} stroke="#959eaa" tickLine={false} axisLine={false} />
                  <YAxis yAxisId="p" orientation="right" fontSize={11} stroke="#959eaa" tickLine={false} axisLine={false} />
                  <Tooltip
                    labelFormatter={(l) => shortDay(String(l))}
                    formatter={(v, name) => (name === 'peso_medio' ? [kg(Number(v)), 'Peso médio'] : [v, 'Pesagens'])}
                  />
                  <Bar yAxisId="q" dataKey="total" fill="#acd4bb" radius={[2, 2, 0, 0]} />
                  <Line yAxisId="p" dataKey="peso_medio" stroke="#14181e" strokeWidth={1.75} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <Empty>Sem pesagens no período</Empty>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Últimas pesagens" subtitle="Atualização automática" action={<Badge tone="green">Tempo real</Badge>} />
          <ul className="divide-y divide-palha-100">
            {feed.data?.length === 0 && <Empty>Nenhuma pesagem ainda</Empty>}
            {feed.data?.map((w) => (
              <li key={w.id} className={w.id === flashId ? 'flash' : ''}>
                <Link to={`/animais/${w.animal_id}`} className="flex items-center justify-between px-4 py-2.5 row-hover">
                  <div>
                    <div className="text-sm font-medium text-palha-900">{w.brinco_visual}</div>
                    <div className="text-xs text-palha-500">
                      {w.dispositivo_nome} · {dateTime(w.timestamp)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium tabular-nums text-palha-900">{kg(w.peso_kg, 3)}</div>
                    {w.ganho_kg != null && (
                      <div className={w.ganho_kg >= 0 ? 'text-xs tabular-nums text-pasto-700' : 'text-xs tabular-nums text-red-600'}>
                        {w.ganho_kg >= 0 ? '+' : ''}
                        {kg(w.ganho_kg, 3)}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {o && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Ranking title="Maiores GMD" items={o.top_gmd} />
          <Ranking title="Menores GMD — requer atenção" items={o.pior_gmd} warn />
        </div>
      )}
    </div>
  );
}

function Ranking({ title, items, warn }: { title: string; items: RankItem[]; warn?: boolean }) {
  return (
    <Card>
      <CardHeader title={title} />
      {items.length === 0 ? (
        <Empty>Dados insuficientes (mín. 2 pesagens com 1 dia de intervalo)</Empty>
      ) : (
        <table className="w-full">
          <tbody className="divide-y divide-palha-100">
            {items.map((r) => (
              <tr key={r.animal_id} className="row-hover">
                <td className="td">
                  <Link to={`/animais/${r.animal_id}`} className="font-medium text-palha-900 hover:text-pasto-700 hover:underline">
                    {r.brinco_visual}
                  </Link>
                  <span className="ml-2 text-xs text-palha-500">{r.raca}</span>
                </td>
                <td className="td text-right">{kg(r.peso_atual_kg)}</td>
                <td className={`td text-right font-medium ${warn && r.gmd_kg_dia < 0.5 ? 'text-red-700' : 'text-palha-900'}`}>
                  {gmdFmt(r.gmd_kg_dia)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
