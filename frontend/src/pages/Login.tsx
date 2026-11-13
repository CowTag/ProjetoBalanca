import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button, ErrorBox, Field } from '../components/ui';
import { CowHead, Landscape } from '../components/FarmArt';

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
    <Landscape className="min-h-screen">
      <div className="grid min-h-screen place-items-center p-4 pb-40">
        <div className="w-full max-w-sm animate-fade-up rounded-3xl border border-white/70 bg-white/85 p-6 shadow-lift backdrop-blur-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-3xl bg-pasto-100 ring-1 ring-pasto-200">
              <CowHead className="h-12 w-12 hover:animate-wiggle" />
            </div>
            <h1 className="text-2xl font-extrabold text-palha-900">
              Cow<span className="text-pasto-500">Tag</span>
            </h1>
            <p className="text-sm text-palha-500">Gestão pecuária com balança inteligente</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <Field label="E-mail">
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Senha">
              <input className="input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </Field>
            <ErrorBox msg={err} />
            <Button className="w-full py-2.5" disabled={busy}>
              {busy ? 'Abrindo a porteira…' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </Landscape>
  );
}
