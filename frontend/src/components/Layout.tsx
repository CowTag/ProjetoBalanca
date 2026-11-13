import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Beef, Building2, ChevronDown, Cpu, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { REALTIME_ENABLED, getSocket } from '../lib/socket';
import { BrandMark } from './ui';

const links = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/animais', label: 'Rebanho', icon: Beef },
  { to: '/dispositivos', label: 'Balanças', icon: Cpu },
  { to: '/fazenda', label: 'Fazenda', icon: Building2 },
];

function Brand() {
  const { user } = useAuth();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <BrandMark className="h-9" />
      <div className="hidden min-w-0 leading-tight sm:block">
        <div className="text-sm font-semibold text-white">CowTag</div>
        <div className="truncate text-xs text-palha-400">{user?.fazenda.nome}</div>
      </div>
    </div>
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
        className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors hover:bg-white/10"
        aria-label="Menu do usuário"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-palha-700 text-xs font-semibold text-palha-100">{initials}</span>
        <ChevronDown size={14} className={clsx('text-palha-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 animate-fade-up overflow-hidden rounded-md border border-palha-200 bg-white shadow-lift">
          <div className="border-b border-palha-100 px-4 py-3">
            <div className="truncate text-sm font-medium text-palha-900">{user?.nome}</div>
            <div className="truncate text-xs text-palha-500">{user?.email}</div>
            <div className="mt-1 truncate text-xs text-palha-500">
              {user?.funcao === 'admin' ? 'Administrador' : 'Operador'} · {user?.fazenda.nome}
            </div>
          </div>
          <button onClick={logout} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-palha-700 hover:bg-palha-50">
            <LogOut size={15} /> Sair
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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 bg-palha-900">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Brand />

          {/* Menu central (desktop) */}
          <nav className="hidden items-center gap-1 md:flex">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-white/10 text-white' : 'text-palha-400 hover:bg-white/5 hover:text-palha-100',
                  )
                }
              >
                <Icon size={16} strokeWidth={1.75} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="md:hidden" />

          <div className="flex items-center justify-end gap-3">
            <span
              className="hidden items-center gap-2 text-xs font-medium text-palha-400 lg:inline-flex"
              title={live ? 'Recebendo pesagens em tempo real' : 'Sem conexão em tempo real'}
            >
              <span className={clsx('h-1.5 w-1.5 rounded-full', live ? 'bg-pasto-400' : 'bg-palha-500')} />
              {live ? 'Tempo real' : 'Desconectado'}
            </span>
            <UserMenu />
            <button className="rounded-md p-2 text-palha-300 hover:bg-white/10 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Menu (celular) */}
        {open && (
          <nav className="grid animate-fade-up grid-cols-2 gap-1 border-t border-white/10 p-3 md:hidden">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium',
                    isActive ? 'bg-white/10 text-white' : 'text-palha-400 hover:bg-white/5',
                  )
                }
              >
                <Icon size={16} strokeWidth={1.75} /> {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main key={location.pathname} className="mx-auto w-full max-w-7xl flex-1 animate-fade-up p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
