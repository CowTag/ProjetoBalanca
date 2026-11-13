import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { usePolling, useRealtime } from '../lib/socket';
import { dateTime, gmdFmt, idadeMeses, kg } from '../lib/format';
import type { Animal, StatusAnimal, Weighing } from '../lib/types';
import { CowHead } from '../components/FarmArt';
import { Button, Card, CardHeader, Empty, ErrorBox, Spinner, StatusBadge } from '../components/ui';
import { AnimalActions, AnimalForm, StatusInfo } from '../components/AnimalManage';

export default function Animals() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusAnimal | ''>('ativo');
  const [showForm, setShowForm] = useState(false);

  const list = useAsync(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (status) p.set('status', status);
    return api<Animal[]>(`/animals?${p}`);
  }, [q, status]);

  const onWeighing = useCallback(
    (w: Weighing) =>
      list.setData((prev) =>
        prev?.map((a) => (a.id === w.animal_id ? { ...a, ultimo_peso_kg: w.peso_kg, ultima_pesagem_em: w.timestamp } : a)) ?? prev,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useRealtime('weighing:new', onWeighing);
  usePolling(list.reload, 30_000);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-palha-900">Rebanho</h1>
          <p className="text-sm text-palha-500">{list.data?.length ?? 0} animais</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus size={16} /> Novo animal
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader title="Cadastrar animal" subtitle="Dica: passe a tag na balança e copie o UID do monitor Serial ou da mensagem 'TAG NAO CADASTRADA'" />
          <div className="p-4">
            <AnimalForm
              columns="sm:grid-cols-2 lg:grid-cols-5"
              onCancel={() => setShowForm(false)}
              onSaved={() => {
                setShowForm(false);
                list.reload();
              }}
            />
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-palha-100 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-palha-400" />
            <input className="input pl-9" placeholder="Buscar brinco, tag ou raça…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([['ativo', 'No pasto'], ['vendido', 'Vendidos'], ['obito', 'Óbitos'], ['', 'Todos']] as const).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setStatus(v)}
                className={
                  status === v
                    ? 'rounded-full bg-pasto-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm'
                    : 'rounded-full border border-palha-200 bg-white px-3.5 py-2 text-sm font-semibold text-palha-600 transition hover:border-pasto-300 hover:text-pasto-700'
                }
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <ErrorBox msg={list.error} />
        {list.loading && !list.data ? (
          <div className="p-6">
            <Spinner />
          </div>
        ) : list.data?.length === 0 ? (
          <Empty>Nenhum animal encontrado</Empty>
        ) : (
          <>
          {/* Celular: cartões */}
          <ul className="divide-y divide-palha-100 md:hidden">
            {list.data?.map((a) => (
              <li key={a.id} className="flex items-start gap-3 p-4">
                <Link to={`/animais/${a.id}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-pasto-50">
                  <CowHead className="h-8 w-8" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/animais/${a.id}`} className="font-bold text-pasto-700">{a.brinco_visual}</Link>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="truncate font-mono text-xs text-palha-500">{a.tag_rfid}</p>
                  <p className="text-sm text-palha-700">
                    {kg(a.ultimo_peso_kg)} · {gmdFmt(a.gmd_kg_dia)}
                  </p>
                  <p className="text-xs text-palha-500">
                    {a.raca ?? 'Sem raça'} · {a.sexo === 'M' ? 'Macho' : 'Fêmea'} · {idadeMeses(a.data_nascimento)}
                  </p>
                  <StatusInfo animal={a} />
                </div>
                <AnimalActions compact animal={a} onChanged={list.reload} />
              </li>
            ))}
          </ul>
          {/* Desktop: tabela */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead className="bg-pasto-50/60">
                <tr>
                  <th className="th">Brinco</th>
                  <th className="th">Tag RFID</th>
                  <th className="th">Raça</th>
                  <th className="th">Sexo</th>
                  <th className="th">Idade</th>
                  <th className="th text-right">Último peso</th>
                  <th className="th text-right">GMD</th>
                  <th className="th">Última pesagem</th>
                  <th className="th">Status</th>
                  <th className="th"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-palha-100">
                {list.data?.map((a) => (
                  <tr key={a.id} className="row-hover">
                    <td className="td">
                      <Link to={`/animais/${a.id}`} className="group flex items-center gap-2 font-bold text-pasto-700">
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-pasto-50 transition group-hover:scale-110 group-hover:bg-pasto-100">
                          <CowHead className="h-6 w-6 group-hover:animate-wiggle" />
                        </span>
                        <span className="group-hover:underline">{a.brinco_visual}</span>
                      </Link>
                    </td>
                    <td className="td font-mono text-xs">{a.tag_rfid}</td>
                    <td className="td">{a.raca ?? '—'}</td>
                    <td className="td">{a.sexo === 'M' ? 'Macho' : 'Fêmea'}</td>
                    <td className="td">{idadeMeses(a.data_nascimento)}</td>
                    <td className="td text-right font-medium">{kg(a.ultimo_peso_kg)}</td>
                    <td className="td text-right">{gmdFmt(a.gmd_kg_dia)}</td>
                    <td className="td text-palha-500">{dateTime(a.ultima_pesagem_em)}</td>
                    <td className="td">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="td">
                      <AnimalActions compact animal={a} onChanged={list.reload} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>
    </div>
  );
}
