import { useState, type FormEvent } from 'react';
import { Activity, Radio, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { BrandMark, Button, ErrorBox, Field } from '../components/ui';

const destaques = [
  { icon: Radio, titulo: 'Pesagem automatizada', texto: 'Identificação por RFID e registro direto da balança, sem anotação manual.' },
  { icon: Activity, titulo: 'Desempenho do rebanho', texto: 'Ganho médio diário, evolução de peso e alertas por animal.' },
  { icon: ShieldCheck, titulo: 'Rastreabilidade', texto: 'Histórico completo de pesagens, vendas e baixas de cada animal.' },
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@cowtag.local');
  const [senha, setSenha] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await login(email, senha);
    } catch {
      setErr('E-mail ou senha inválidos');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Painel institucional */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-palha-900 p-12 text-palha-100 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[.07]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative flex items-center gap-3">
          <BrandMark className="h-14" />
          <span className="text-lg font-semibold text-white">CowTag</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">Gestão pecuária orientada por dados.</h2>
          <p className="mt-3 text-palha-400">Pesagem inteligente, controle do rebanho e indicadores de desempenho em uma única plataforma.</p>
          <ul className="mt-10 space-y-6">
            {destaques.map(({ icon: Icon, titulo, texto }) => (
              <li key={titulo} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-white/10 bg-white/5 text-pasto-300">
                  <Icon size={17} strokeWidth={1.75} />
                </span>
                <div>
                  <div className="text-sm font-medium text-white">{titulo}</div>
                  <div className="text-sm text-palha-400">{texto}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-palha-500">© {new Date().getFullYear()} CowTag</div>
      </aside>

      {/* Formulário */}
      <main className="flex items-center justify-center bg-white p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandMark className="h-24" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-palha-900">Acessar plataforma</h1>
          <p className="mt-1 text-sm text-palha-500">Informe suas credenciais para continuar.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <Field label="E-mail">
              <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Senha">
              <input className="input" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </Field>
            <ErrorBox msg={err} />
            <Button className="w-full py-2.5" disabled={busy}>
              {busy ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
