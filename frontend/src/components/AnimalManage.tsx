import { useState, type FormEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import { AlertTriangle, ArrowLeftRight, CircleCheck, CircleX, HandCoins, Pencil, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { dateOnly } from '../lib/format';
import type { Animal, StatusAnimal } from '../lib/types';
import { useAuth } from '../hooks/useAuth';
import { Button, ErrorBox, Field } from './ui';
import { Modal } from './Modal';

const hoje = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD no fuso local
const soData = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');

function errMsg(e: unknown) {
  if (e instanceof ApiError) {
    if (e.code === 'DUPLICADO') return 'Essa tag RFID já está cadastrada em outro animal';
    if (e.status === 403) return 'Só administradores podem fazer isso';
    if (e.code === 'VALIDACAO') return 'Verifique os campos';
  }
  return 'Não foi possível salvar. Tente de novo.';
}

// ---------------------------------------------------------------------
// Cadastro / edição
// ---------------------------------------------------------------------
type FormData = { tag_rfid: string; brinco_visual: string; raca: string; sexo: 'M' | 'F'; data_nascimento: string };

export function AnimalForm({
  animal,
  onSaved,
  onCancel,
  columns = 'sm:grid-cols-2',
}: {
  animal?: Animal;
  onSaved: (a: Animal) => void;
  onCancel?: () => void;
  columns?: string;
}) {
  const [f, setF] = useState<FormData>({
    tag_rfid: animal?.tag_rfid ?? '',
    brinco_visual: animal?.brinco_visual ?? '',
    raca: animal ? animal.raca ?? '' : 'Nelore',
    sexo: animal?.sexo ?? 'M',
    data_nascimento: soData(animal?.data_nascimento),
  });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof FormData) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const json = { ...f, raca: f.raca.trim() || null, data_nascimento: f.data_nascimento || null };
      const saved = animal
        ? await api<Animal>(`/animals/${animal.id}`, { method: 'PATCH', json })
        : await api<Animal>('/animals', { method: 'POST', json });
      onSaved(saved);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className={clsx('grid gap-4', columns)}>
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
        <input className="input" type="date" max={hoje()} value={f.data_nascimento} onChange={set('data_nascimento')} />
      </Field>
      <div className="col-span-full flex flex-wrap items-center gap-3">
        <Button disabled={saving}>{saving ? 'Salvando…' : animal ? 'Salvar alterações' : 'Cadastrar'}</Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <ErrorBox msg={err} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
// Situação (ativo / vendido / óbito)
// ---------------------------------------------------------------------
const SITUACOES: { value: StatusAnimal; label: string; desc: string; icon: ReactNode; tone: string; obs: string }[] = [
  { value: 'ativo', label: 'Ativo', desc: 'Animal ativo no rebanho', icon: <CircleCheck size={18} strokeWidth={1.75} />, tone: 'border-pasto-500 bg-pasto-50 text-pasto-800', obs: '' },
  { value: 'vendido', label: 'Vendido', desc: 'Saiu do rebanho por venda', icon: <HandCoins size={18} strokeWidth={1.75} />, tone: 'border-slate-500 bg-ceu-100 text-slate-800', obs: 'Comprador, valor, nº da GTA…' },
  { value: 'obito', label: 'Óbito', desc: 'Morte do animal', icon: <CircleX size={18} strokeWidth={1.75} />, tone: 'border-red-500 bg-red-50 text-red-800', obs: 'Causa provável, local…' },
];

function StatusModal({ animal, onClose, onSaved }: { animal: Animal; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<StatusAnimal>(animal.status);
  const [data, setData] = useState(soData(animal.status_data) || hoje());
  const [obs, setObs] = useState(animal.status_obs ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const atual = SITUACOES.find((s) => s.value === status)!;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await api(`/animals/${animal.id}`, {
        method: 'PATCH',
        json: status === 'ativo' ? { status } : { status, status_data: data, status_obs: obs.trim() || null },
      });
      onSaved();
    } catch (e) {
      setErr(errMsg(e));
      setSaving(false);
    }
  };

  return (
    <Modal title="Mudar situação" subtitle={`Animal ${animal.brinco_visual}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-2">
          {SITUACOES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              className={clsx(
                'flex items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors',
                status === s.value ? s.tone : 'border-palha-200 bg-white text-palha-600 hover:bg-palha-50',
              )}
            >
              {s.icon}
              <span>
                <span className="block text-sm font-medium">{s.label}</span>
                <span className="block text-xs opacity-80">{s.desc}</span>
              </span>
            </button>
          ))}
        </div>

        {status !== 'ativo' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={status === 'vendido' ? 'Data da venda' : 'Data do óbito'}>
              <input className="input" type="date" max={hoje()} value={data} onChange={(e) => setData(e.target.value)} required />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Observação (opcional)">
                <textarea className="input min-h-[72px]" maxLength={200} placeholder={atual.obs} value={obs} onChange={(e) => setObs(e.target.value)} />
              </Field>
            </div>
          </div>
        )}
        {status === 'ativo' && animal.status !== 'ativo' && (
          <p className="rounded-md border border-pasto-200 bg-pasto-50 px-3 py-2 text-sm text-pasto-800">
            O animal volta para o rebanho ativo e a balança passa a aceitar as pesagens dele de novo.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={saving || (status === animal.status && status === 'ativo')}>{saving ? 'Salvando…' : 'Confirmar'}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <ErrorBox msg={err} />
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Remoção (só admin) — exige digitar o brinco para confirmar
// ---------------------------------------------------------------------
function DeleteModal({
  animal,
  onClose,
  onDeleted,
  onChangeStatus,
}: {
  animal: Animal;
  onClose: () => void;
  onDeleted: () => void;
  onChangeStatus: () => void;
}) {
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ok = confirm.trim().toLowerCase() === animal.brinco_visual.trim().toLowerCase();

  const remove = async (e: FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setSaving(true);
    try {
      await api(`/animals/${animal.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (e) {
      setErr(errMsg(e));
      setSaving(false);
    }
  };

  return (
    <Modal title="Remover animal" subtitle={`Animal ${animal.brinco_visual}`} onClose={onClose}>
      <form onSubmit={remove} className="space-y-4">
        <div className="flex gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={20} className="shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Isso apaga o animal e todo o histórico de pesagens. Não dá para desfazer.</p>
            <p>Use só para cadastros feitos por engano. Se o animal foi vendido ou morreu, mude a situação: o histórico fica guardado.</p>
          </div>
        </div>
        {animal.status === 'ativo' && (
          <Button type="button" variant="outline" className="w-full" onClick={onChangeStatus}>
            <ArrowLeftRight size={16} /> Marcar como vendido ou óbito
          </Button>
        )}
        <Field label={`Para confirmar, digite o brinco: ${animal.brinco_visual}`}>
          <input className="input" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="danger" disabled={!ok || saving}>
            <Trash2 size={16} /> {saving ? 'Removendo…' : 'Remover definitivamente'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <ErrorBox msg={err} />
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Botões de ação (lista e ficha do animal)
// ---------------------------------------------------------------------
type Open = null | 'edit' | 'status' | 'delete';

export function AnimalActions({
  animal,
  onChanged,
  onDeleted,
  compact = false,
}: {
  animal: Animal;
  onChanged: () => void;
  onDeleted?: () => void;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const isAdmin = user?.funcao === 'admin';
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  const btn = compact
    ? 'grid h-9 w-9 place-items-center rounded-md text-palha-500 transition-colors hover:bg-palha-100 hover:text-palha-900'
    : '';

  return (
    <>
      {compact ? (
        <div className="flex items-center justify-end gap-0.5">
          <button type="button" className={btn} title="Editar" aria-label="Editar" onClick={() => setOpen('edit')}>
            <Pencil size={16} />
          </button>
          <button type="button" className={btn} title="Mudar situação" aria-label="Mudar situação" onClick={() => setOpen('status')}>
            <ArrowLeftRight size={16} />
          </button>
          {isAdmin && (
            <button type="button" className={clsx(btn, 'hover:bg-red-50 hover:text-red-600')} title="Remover" aria-label="Remover" onClick={() => setOpen('delete')}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setOpen('edit')}>
            <Pencil size={16} /> Editar
          </Button>
          <Button variant="outline" onClick={() => setOpen('status')}>
            <ArrowLeftRight size={16} /> Mudar situação
          </Button>
          {isAdmin && (
            <Button variant="outline" className="hover:border-red-300 hover:bg-red-50 hover:text-red-600" onClick={() => setOpen('delete')}>
              <Trash2 size={16} /> Remover
            </Button>
          )}
        </div>
      )}

      {open === 'edit' && (
        <Modal title="Editar animal" subtitle={`Animal ${animal.brinco_visual}`} onClose={close}>
          <AnimalForm
            animal={animal}
            onCancel={close}
            onSaved={() => {
              close();
              onChanged();
            }}
          />
        </Modal>
      )}
      {open === 'status' && (
        <StatusModal
          animal={animal}
          onClose={close}
          onSaved={() => {
            close();
            onChanged();
          }}
        />
      )}
      {open === 'delete' && (
        <DeleteModal
          animal={animal}
          onClose={close}
          onChangeStatus={() => setOpen('status')}
          onDeleted={() => {
            close();
            (onDeleted ?? onChanged)();
          }}
        />
      )}
    </>
  );
}

/** Linha "Vendido em 10/11/2026 · Comprador X" para animais fora do rebanho. */
export function StatusInfo({ animal }: { animal: Animal }) {
  if (animal.status === 'ativo') return null;
  const label = animal.status === 'vendido' ? 'Vendido em' : 'Óbito em';
  return (
    <p className={clsx('text-sm', animal.status === 'vendido' ? 'text-slate-700' : 'text-red-700')}>
      {label} {dateOnly(animal.status_data)}
      {animal.status_obs && <span className="text-palha-500"> · {animal.status_obs}</span>}
    </p>
  );
}
