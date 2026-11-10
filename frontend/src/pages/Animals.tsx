import { useCallback, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useRealtime } from '../lib/socket';
import { dateTime, gmdFmt, idadeMeses, kg } from '../lib/format';
import type { Animal, StatusAnimal, Weighing } from '../lib/types';
import { CowHead } from '../components/FarmArt';
import { Button, Card, CardHeader, Empty, ErrorBox, Field, Spinner, StatusBadge } from '../components/ui';

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
        <NewAnimalForm
          onDone={() => {
            setShowForm(false);
            list.reload();
          }}
        />
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
          <div className="overflow-x-auto">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function NewAnimalForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ tag_rfid: '', brinco_visual: '', raca: 'Nelore', sexo: 'M', data_nascimento: '' });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await api('/animals', { method: 'POST', json: { ...f, data_nascimento: f.data_nascimento || null } });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'DUPLICADO' ? 'Tag RFID já cadastrada' : 'Erro ao salvar — verifique os campos');
    }
  };

  return (
    <Card>
      <CardHeader title="Cadastrar animal" subtitle="Dica: passe a tag na balança e copie o UID do monitor Serial ou da mensagem 'TAG NAO CADASTRADA'" />
      <form onSubmit={submit} className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Tag RFID">
          <input className="input font-mono" placeholder="43:A2:89:C1" value={f.tag_rfid} onChange={set('tag_rfid')} required />
        </Field>
        <Field label="Brinco visual">
          <input className="input" placeholder="BR-0123" value={f.brinco_visual} onChange={set('brinco_visual')} required />
        </Field>
        <Field label="Raça">
          <input className="input" value={f.raca} onChange={set('raca')} />
        </Field>
        <Field label="Sexo">
          <select className="input" value={f.sexo} onChange={set('sexo')}>
            <option value="M">Macho</option>
            <option value="F">Fêmea</option>
          </select>
        </Field>
        <Field label="Nascimento">
          <input className="input" type="date" value={f.data_nascimento} onChange={set('data_nascimento')} />
        </Field>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-5">
          <Button>Salvar</Button>
          <ErrorBox msg={err} />
        </div>
      </form>
    </Card>
  );
}
