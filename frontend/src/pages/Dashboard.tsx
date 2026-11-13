import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Beef, Cpu, Scale, TrendingUp } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { usePolling, useRealtime } from '../lib/socket';
import { dateTime, gmdFmt, kg, shortDay } from '../lib/format';
import type { Overview, RankItem, Weighing } from '../lib/types';
import { Badge, Card, CardHeader, Empty, ErrorBox, Kpi, Spinner } from '../components/ui';
import { Landscape } from '../components/FarmArt';
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

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="space-y-6">
      {/* Banner com paisagem animada */}
      <Landscape className="rounded-3xl border border-pasto-100 shadow-soft">
        <div className="px-5 pb-32 pt-6 sm:px-8 sm:pb-36">
          <p className="text-sm font-semibold text-pasto-700">{saudacao}, {user?.nome.split(' ')[0]}!</p>
          <h1 className="mt-1 text-2xl font-extrabold text-palha-900 sm:text-3xl">{user?.fazenda.nome}</h1>
          <p className="mt-1 max-w-md text-sm text-palha-600">
            {o
              ? `${o.animais.ativos} animais no pasto · ${o.pesagens_hoje} pesagens hoje · ${o.dispositivos.online} de ${o.dispositivos.total} balanças online`
              : 'Carregando o rebanho…'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/animais" className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-pasto-700 shadow-soft transition hover:-translate-y-0.5 hover:bg-white">
              Ver rebanho
            </Link>
            <Link to="/dispositivos" className="rounded-full bg-pasto-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-pasto-600">
              Balanças
            </Link>
          </div>
        </div>
      </Landscape>

      <ErrorBox msg={overview.error} />

      {!o ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi delay={0} label="Animais ativos" value={o.animais.ativos} hint={`${o.animais.vendidos} vendidos · ${o.animais.obitos} óbitos`} icon={<Beef size={18} />} />
          <Kpi delay={60} label="Pesagens hoje" value={o.pesagens_hoje} icon={<Scale size={18} />} />
          <Kpi delay={120} label="Peso médio" value={o.peso_medio_rebanho_kg} format={(n) => kg(n)} hint="última pesagem de cada animal" icon={<Activity size={18} />} />
          <Kpi delay={180} label="GMD médio" value={o.gmd_medio_kg_dia} format={gmdFmt} hint="ganho médio diário" icon={<TrendingUp size={18} />} />
          <Kpi
            delay={240}
            label="Balanças online"
            display={`${o.dispositivos.online}/${o.dispositivos.total}`}
            icon={<Cpu size={18} />}
            hint={<Link to="/dispositivos" className="font-semibold text-pasto-600 hover:underline">ver balanças</Link>}
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#ebe5d4" />
                  <XAxis dataKey="dia" tickFormatter={shortDay} fontSize={12} />
                  <YAxis yAxisId="q" allowDecimals={false} fontSize={12} />
                  <YAxis yAxisId="p" orientation="right" fontSize={12} />
                  <Tooltip
                    labelFormatter={(l) => shortDay(String(l))}
                    formatter={(v, name) => (name === 'peso_medio' ? [kg(Number(v)), 'Peso médio'] : [v, 'Pesagens'])}
                  />
                  <Bar yAxisId="q" dataKey="total" fill="#a9d497" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="p" dataKey="peso_medio" stroke="#c0935f" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <Empty>Sem pesagens no período</Empty>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Pesagens ao vivo" subtitle="Atualiza automaticamente" action={<Badge tone="green">LIVE</Badge>} />
          <ul className="divide-y divide-palha-100">
            {feed.data?.length === 0 && <Empty>Nenhuma pesagem ainda</Empty>}
            {feed.data?.map((w) => (
              <li key={w.id} className={w.id === flashId ? 'flash' : ''}>
                <Link to={`/animais/${w.animal_id}`} className="flex items-center justify-between px-4 py-2 row-hover">
                  <div>
                    <div className="text-sm font-medium">{w.brinco_visual}</div>
                    <div className="text-xs text-palha-500">
                      {w.dispositivo_nome} · {dateTime(w.timestamp)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{kg(w.peso_kg, 3)}</div>
                    {w.ganho_kg != null && (
                      <div className={w.ganho_kg >= 0 ? 'text-xs text-pasto-700' : 'text-xs text-red-600'}>
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
          <Ranking title="Menores GMD (atenção)" items={o.pior_gmd} warn />
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
                  <Link to={`/animais/${r.animal_id}`} className="font-medium text-pasto-700 hover:underline">
                    {r.brinco_visual}
                  </Link>
                  <span className="ml-2 text-xs text-palha-500">{r.raca}</span>
                </td>
                <td className="td text-right">{kg(r.peso_atual_kg)}</td>
                <td className={`td text-right font-semibold ${warn && r.gmd_kg_dia < 0.5 ? 'text-red-600' : 'text-pasto-700'}`}>
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
