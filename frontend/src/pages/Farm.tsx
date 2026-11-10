import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../hooks/useAuth';
import { dateOnly } from '../lib/format';
import type { Farm, Funcao, User } from '../lib/types';
import { Badge, Button, Card, CardHeader, ErrorBox, Field } from '../components/ui';

export default function FarmPage() {
  const { user, refresh } = useAuth();
  const isAdmin = user?.funcao === 'admin';
  const farm = useAsync(() => api<Farm>('/farm'));
  const users = useAsync(() => api<(User & { criado_em: string })[]>('/users'));

  const [f, setF] = useState({ nome: '', localizacao: '', area_hectares: '' });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (farm.data)
      setF({
        nome: farm.data.nome,
        localizacao: farm.data.localizacao ?? '',
        area_hectares: farm.data.area_hectares?.toString() ?? '',
      });
  }, [farm.data]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    await api('/farm', {
      method: 'PUT',
      json: { nome: f.nome, localizacao: f.localizacao || null, area_hectares: f.area_hectares ? Number(f.area_hectares) : null },
    });
    setMsg('Salvo!');
    refresh();
    setTimeout(() => setMsg(null), 2000);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-palha-900">Fazenda</h1>

      <Card>
        <CardHeader title="Dados da propriedade" subtitle={farm.data ? `Cadastrada em ${dateOnly(farm.data.criado_em)}` : ''} />
        <form onSubmit={save} className="grid gap-4 p-4 sm:grid-cols-3">
          <Field label="Nome">
            <input className="input" disabled={!isAdmin} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          </Field>
          <Field label="Localização">
            <input className="input" disabled={!isAdmin} value={f.localizacao} onChange={(e) => setF({ ...f, localizacao: e.target.value })} />
          </Field>
          <Field label="Área (ha)">
            <input className="input" disabled={!isAdmin} inputMode="decimal" value={f.area_hectares} onChange={(e) => setF({ ...f, area_hectares: e.target.value })} />
          </Field>
          {isAdmin && (
            <div className="flex items-center gap-3 sm:col-span-3">
              <Button>Salvar</Button>
              {msg && <span className="text-sm text-pasto-700">{msg}</span>}
            </div>
          )}
        </form>
      </Card>

      <Card>
        <CardHeader title="Usuários e perfis" />
        <table className="w-full">
          <thead className="bg-pasto-50/60">
            <tr>
              <th className="th">Nome</th>
              <th className="th">E-mail</th>
              <th className="th">Função</th>
              {isAdmin && <th className="th" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-palha-100">
            {users.data?.map((u) => (
              <tr key={u.id} className="row-hover">
                <td className="td font-medium">{u.nome}</td>
                <td className="td">{u.email}</td>
                <td className="td">
                  <Badge tone={u.funcao === 'admin' ? 'amber' : 'gray'}>{u.funcao}</Badge>
                </td>
                {isAdmin && (
                  <td className="td text-right">
                    {u.id !== user?.id && (
                      <Button
                        variant="ghost"
                        className="text-red-600"
                        onClick={async () => {
                          if (!confirm(`Remover ${u.nome}?`)) return;
                          await api(`/users/${u.id}`, { method: 'DELETE' });
                          users.reload();
                        }}
                      >
                        Remover
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {isAdmin && <NewUserForm onDone={users.reload} />}
      </Card>
    </div>
  );
}

function NewUserForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ nome: '', email: '', senha: '', funcao: 'operador' as Funcao });
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await api('/users', { method: 'POST', json: f });
      setF({ nome: '', email: '', senha: '', funcao: 'operador' });
      onDone();
    } catch {
      setErr('Erro ao criar usuário (e-mail já usado ou senha < 6 caracteres)');
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 border-t border-palha-100 p-4 sm:grid-cols-5">
      <input className="input" placeholder="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required />
      <input className="input" type="email" placeholder="E-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
      <input className="input" type="password" placeholder="Senha" value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} required />
      <select className="input" value={f.funcao} onChange={(e) => setF({ ...f, funcao: e.target.value as Funcao })}>
        <option value="operador">Operador</option>
        <option value="admin">Admin</option>
      </select>
      <Button>Adicionar</Button>
      <div className="sm:col-span-5">
        <ErrorBox msg={err} />
      </div>
    </form>
  );
}
