import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Beef, ChevronDown, Cpu, Gauge, LogOut, Menu, Tractor, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { REALTIME_ENABLED, getSocket } from '../lib/socket';
import { CowHead, Cow, FenceDivider } from './FarmArt';

const links = [
  { to: '/', label: 'Painel', icon: Gauge, end: true },
  { to: '/animais', label: 'Rebanho', icon: Beef },
  { to: '/dispositivos', label: 'Balanças', icon: Cpu },
  { to: '/fazenda', label: 'Fazenda', icon: Tractor },
];

function Logo() {
  const [moo, setMoo] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        setMoo(true);
        setTimeout(() => setMoo(false), 1000);
      }}
      className="group relative flex items-center gap-2.5"
      aria-label="CowTag"
    >
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-pasto-100 ring-1 ring-pasto-200 transition group-hover:bg-pasto-200">
        <CowHead className={clsx('h-8 w-8', moo ? 'animate-wiggle' : 'group-hover:animate-wiggle')} />
      </span>
      {moo && (
        <span className="absolute -bottom-7 left-2 animate-pop rounded-full bg-white px-2 py-0.5 text-xs font-bold text-palha-700 shadow-soft">
          Muu!
        </span>
      )}
      <span className="text-left leading-tight">
        <span className="block text-lg font-extrabold text-palha-900">
          Cow<span className="text-pasto-500">Tag</span>
        </span>
      </span>
    </button>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const initials = user?.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-palha-200 bg-white py-1 pl-1 pr-2.5 transition hover:border-pasto-300"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-pasto-300 to-pasto-500 text-xs font-extrabold text-white">
          {initials}
        </span>
        <ChevronDown size={14} className={clsx('text-palha-500 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 animate-fade-up overflow-hidden rounded-2xl border border-palha-200 bg-white shadow-lift">
          <div className="bg-pasto-50 px-4 py-3">
            <div className="font-bold text-palha-900">{user?.nome}</div>
            <div className="text-xs text-palha-500">{user?.email}</div>
            <div className="mt-1 text-xs font-semibold capitalize text-pasto-600">
              {user?.funcao} · {user?.fazenda.nome}
            </div>
          </div>
          <button onClick={logout} className="flex w-full items-center gap-2 px-4 py-3 text-sm text-palha-600 hover:bg-palha-50">
            <LogOut size={16} /> Sair
          </button>
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    // Sem Socket.io (Vercel) as telas se atualizam por polling
    if (!REALTIME_ENABLED) return setLive(true);
    const s = getSocket();
    const on = () => setLive(true);
    const off = () => setLive(false);
    s.on('connect', on);
    s.on('disconnect', off);
    setLive(s.connected);
    return () => {
      s.off('connect', on);
      s.off('disconnect', off);
    };
  }, []);

  const pill = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'group relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
      isActive ? 'bg-pasto-100 text-pasto-700 shadow-inner' : 'text-palha-600 hover:bg-pasto-50 hover:text-pasto-700',
    );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-palha-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <Logo />

          {/* Menu superior (desktop) */}
          <nav className="hidden items-center gap-1 rounded-full border border-palha-200/70 bg-palha-50/80 p-1 md:flex">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={pill}>
                <Icon size={17} className="transition group-hover:-translate-y-0.5" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:flex',
                live ? 'bg-pasto-50 text-pasto-700' : 'bg-palha-100 text-palha-500',
              )}
              title={live ? 'Recebendo pesagens em tempo real' : 'Sem conexão em tempo real'}
            >
              <span className={clsx('h-2 w-2 rounded-full', live ? 'animate-pulse bg-pasto-500' : 'bg-palha-300')} />
              {live ? 'Ao vivo' : 'Offline'}
            </span>
            <UserMenu />
            <button className="rounded-xl p-2 text-palha-600 hover:bg-pasto-50 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Menu mobile (abre abaixo do topo) */}
        {open && (
          <nav className="grid animate-fade-up grid-cols-2 gap-2 border-t border-palha-100 bg-white/95 p-3 md:hidden">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold',
                    isActive ? 'bg-pasto-100 text-pasto-700' : 'bg-palha-50 text-palha-600',
                  )
                }
              >
                <Icon size={18} /> {label}
              </NavLink>
            ))}
          </nav>
        )}
        <FenceDivider className="opacity-70" />
      </header>

      <main key={location.pathname} className="mx-auto w-full max-w-7xl flex-1 animate-fade-up p-4 lg:p-6">
        <Outlet />
      </main>

      <footer className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 pb-6 pt-2 text-xs text-palha-400">
        <span>CowTag · gestão pecuária inteligente</span>
        <Cow className="w-10 opacity-60" grazing />
      </footer>
    </div>
  );
}
