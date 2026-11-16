import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { BrandMark, Button, ErrorBox, Field } from '../components/ui';

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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-palha-900 px-4 py-12 text-palha-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-[.07]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-3">
          <BrandMark className="h-14" />
          <span className="text-2xl font-semibold text-white">CowTag</span>
        </div>
        <h1 className="mt-8 text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
          Gestão pecuária orientada por dados.
        </h1>
        <p className="mt-3 text-palha-400">
          Pesagem inteligente, controle do rebanho e indicadores de desempenho em uma única plataforma.
        </p>

        <form onSubmit={submit} className="mt-10 space-y-5 rounded-lg bg-white p-6 text-left shadow-xl sm:p-8">
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

      <div className="relative mt-10 text-xs text-palha-500">© {new Date().getFullYear()} CowTag</div>
    </div>
  );
}
