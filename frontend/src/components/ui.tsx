// Componentes base no estilo shadcn/ui (Tailwind puro), tema "pasto claro".
import clsx from 'clsx';
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { SleepingCow } from './FarmArt';

export function Card({ className, children, interactive, style }: { className?: string; children: ReactNode; interactive?: boolean; style?: CSSProperties }) {
  return (
    <div
      style={style}
      className={clsx(
        'rounded-2xl border border-palha-200/80 bg-white/90 shadow-soft backdrop-blur-sm',
        interactive && 'transition duration-200 hover:-translate-y-0.5 hover:border-pasto-200 hover:shadow-lift',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-palha-100 px-4 py-3">
      <div className="flex items-center gap-2.5">
        {icon && <span className="grid h-8 w-8 place-items-center rounded-lg bg-pasto-50 text-pasto-600">{icon}</span>}
        <div>
          <h3 className="font-bold text-palha-900">{title}</h3>
          {subtitle && <p className="text-xs text-palha-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
export function Button({ variant = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...p}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition active:scale-[.97] disabled:opacity-50',
        variant === 'primary' && 'bg-pasto-500 text-white shadow-sm hover:bg-pasto-600',
        variant === 'outline' && 'border border-palha-200 bg-white text-palha-700 hover:border-pasto-300 hover:bg-pasto-50',
        variant === 'ghost' && 'text-palha-600 hover:bg-pasto-50',
        variant === 'danger' && 'bg-red-500 text-white hover:bg-red-600',
        className,
      )}
    />
  );
}

type Tone = 'green' | 'gray' | 'red' | 'amber' | 'blue';
export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tone === 'green' && 'bg-pasto-100 text-pasto-700',
        tone === 'gray' && 'bg-palha-100 text-palha-600',
        tone === 'red' && 'bg-red-50 text-red-600',
        tone === 'amber' && 'bg-terra-300/40 text-terra-600',
        tone === 'blue' && 'bg-ceu-200 text-sky-800',
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: 'ativo' | 'vendido' | 'obito' }) {
  const map = { ativo: ['green', 'Ativo'], vendido: ['blue', 'Vendido'], obito: ['red', 'Óbito'] } as const;
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function OnlineDot({ online }: { online: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pasto-400 opacity-60" />}
      <span className={clsx('relative inline-flex h-2.5 w-2.5 rounded-full', online ? 'bg-pasto-500' : 'bg-palha-300')} />
    </span>
  );
}

/** Anima um número de 0 até o valor (ease-out). */
export function useCountUp(target: number | null | undefined, ms = 900) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (target == null) return;
    const start = performance.now();
    const ini = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setV(ini + (target - ini) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return target == null ? null : v;
}

export function Kpi({
  label,
  value,
  format = (n) => String(Math.round(n)),
  display,
  hint,
  icon,
  delay = 0,
}: {
  label: string;
  value?: number | null;
  format?: (n: number) => string;
  display?: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  delay?: number;
}) {
  const n = useCountUp(value);
  return (
    <Card interactive className="group animate-fade-up p-4" style={{ animationDelay: `${delay}ms` }}>
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-palha-500">{label}</span>
          {icon && (
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-pasto-50 text-pasto-600 transition group-hover:rotate-6 group-hover:scale-110 group-hover:bg-pasto-100">
              {icon}
            </span>
          )}
        </div>
        <div className="mt-2 text-2xl font-extrabold tabular-nums text-palha-900">{display ?? (n == null ? '—' : format(n))}</div>
        {hint && <div className="mt-1 text-xs text-palha-500">{hint}</div>}
      </div>
    </Card>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-8 text-center text-sm text-palha-500">
      <SleepingCow className="mb-3" />
      {children}
    </div>
  );
}

export function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{msg}</div>;
}

export function Spinner() {
  return <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-pasto-400 border-t-transparent" />;
}

/** Título de página padronizado. */
export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-palha-900">{title}</h1>
        {subtitle && <p className="text-sm text-palha-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
