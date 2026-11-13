// Componentes base no estilo shadcn/ui (Tailwind puro), tema corporativo sóbrio.
import clsx from 'clsx';
import { Inbox } from 'lucide-react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

export function Card({ className, children, interactive, style }: { className?: string; children: ReactNode; interactive?: boolean; style?: CSSProperties }) {
  return (
    <div
      style={style}
      className={clsx(
        'rounded-lg border border-palha-200 bg-white shadow-soft',
        interactive && 'transition-colors hover:border-palha-300',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-palha-200 px-4 py-3">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-palha-400">{icon}</span>}
        <div>
          <h3 className="text-sm font-semibold text-palha-900">{title}</h3>
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
        'inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pasto-500/30 disabled:opacity-50',
        variant === 'primary' && 'bg-pasto-600 text-white hover:bg-pasto-700',
        variant === 'outline' && 'border border-palha-300 bg-white text-palha-700 hover:bg-palha-50',
        variant === 'ghost' && 'text-palha-600 hover:bg-palha-100',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
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
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tone === 'green' && 'bg-pasto-50 text-pasto-700 ring-pasto-200',
        tone === 'gray' && 'bg-palha-50 text-palha-600 ring-palha-200',
        tone === 'red' && 'bg-red-50 text-red-700 ring-red-200',
        tone === 'amber' && 'bg-amber-50 text-amber-800 ring-amber-200',
        tone === 'blue' && 'bg-ceu-100 text-slate-700 ring-ceu-200',
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
  return <span className={clsx('inline-flex h-2 w-2 rounded-full', online ? 'bg-pasto-500' : 'bg-palha-300')} />;
}

export function Kpi({
  label,
  value,
  format = (n) => String(Math.round(n)),
  display,
  hint,
  icon,
}: {
  label: string;
  value?: number | null;
  format?: (n: number) => string;
  display?: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  delay?: number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-palha-500">{label}</span>
        {icon && <span className="text-palha-400">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-palha-900">{display ?? (value == null ? '—' : format(value))}</div>
      {hint && <div className="mt-1 text-xs text-palha-500">{hint}</div>}
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
    <div className="flex flex-col items-center px-4 py-10 text-center text-sm text-palha-500">
      <Inbox size={22} strokeWidth={1.5} className="mb-2 text-palha-300" />
      {children}
    </div>
  );
}

export function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</div>;
}

export function Spinner() {
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-palha-300 border-t-pasto-600" />;
}

/** Título de página padronizado. */
export function PageTitle({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-palha-200 pb-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-palha-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-palha-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Controle segmentado (filtros). */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-md border border-palha-300 bg-white p-0.5">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={clsx(
            'rounded px-3 py-1.5 text-sm font-medium transition-colors',
            value === v ? 'bg-palha-800 text-white' : 'text-palha-600 hover:bg-palha-100',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** Logo do produto (brinco CowTag). Altura controlada por `className` (padrão h-9). */
export function BrandMark({ className }: { className?: string }) {
  return <img src="/logo.png" alt="CowTag" draggable={false} className={clsx('h-9 w-auto shrink-0 select-none', className)} />;
}
