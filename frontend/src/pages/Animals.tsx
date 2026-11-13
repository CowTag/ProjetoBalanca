import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { usePolling, useRealtime } from '../lib/socket';
import { dateTime, gmdFmt, idadeMeses, kg } from '../lib/format';
import type { Animal, StatusAnimal, Weighing } from '../lib/types';
import { Button, Card, CardHeader, Empty, ErrorBox, PageTitle, Segmented, Spinner, StatusBadge } from '../components/ui';
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
      <PageTitle
        title="Rebanho"
        subtitle={`${list.data?.length ?? 0} animais listados`}
        action={
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus size={16} /> Novo animal
          </Button>
        }
      />

      {showForm && (
        <Card>
          <CardHeader title="Cadastrar animal" subtitle="O UID da tag é exibido no monitor Serial ou na mensagem 'Tag não cadastrada' da balança" />
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
        <div className="flex flex-wrap gap-3 border-b border-palha-200 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-palha-400" />
            <input className="input pl-9" placeholder="Buscar brinco, tag ou raça…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Segmented
            value={status}
            onChange={setStatus}
            options={[['ativo', 'Ativos'], ['vendido', 'Vendidos'], ['obito', 'Óbitos'], ['', 'Todos']] as const}
          />
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
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/animais/${a.id}`} className="font-medium text-palha-900">{a.brinco_visual}</Link>
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
              <thead className="bg-palha-50">
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
                      <Link to={`/animais/${a.id}`} className="font-medium text-palha-900 hover:text-pasto-700 hover:underline">
                        {a.brinco_visual}
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
