// Ilustrações originais do tema fazenda (SVG puro, sem imagens externas).
import { useState, type CSSProperties, type ReactNode } from 'react';
import clsx from 'clsx';

const box: CSSProperties = { transformBox: 'fill-box', transformOrigin: 'center' };

/** Cabeça de vaca simpática — usada como logo. */
export function CowHead({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M11 13c-3-3-3-7-1-9 2 3 4 5 5 7z" fill="#d4ad82" />
      <path d="M37 13c3-3 3-7 1-9-2 3-4 5-5 7z" fill="#d4ad82" />
      <ellipse cx="7" cy="20" rx="6" ry="3.5" fill="#fff" stroke="#463f33" strokeWidth="1.5" transform="rotate(-20 7 20)" />
      <ellipse cx="41" cy="20" rx="6" ry="3.5" fill="#fff" stroke="#463f33" strokeWidth="1.5" transform="rotate(20 41 20)" />
      <path d="M12 16c0-5 5-8 12-8s12 3 12 8v12c0 8-5 13-12 13S12 36 12 28z" fill="#fff" stroke="#463f33" strokeWidth="1.6" />
      <path d="M14 15c3-1 6 1 6 4s-3 5-6 4z" fill="#463f33" />
      <path d="M33 11c2 1 3 3 2 6-2 1-4 0-5-2z" fill="#463f33" />
      <circle cx="19" cy="22" r="1.8" fill="#463f33" />
      <circle cx="29" cy="22" r="1.8" fill="#463f33" />
      <ellipse cx="24" cy="33" rx="9" ry="6" fill="#f6c9c0" stroke="#463f33" strokeWidth="1.4" />
      <ellipse cx="21" cy="33" rx="1.3" ry="2" fill="#463f33" />
      <ellipse cx="27" cy="33" rx="1.3" ry="2" fill="#463f33" />
    </svg>
  );
}

/** Vaca de perfil. `grazing` abaixa a cabeça para pastar. */
export function Cow({ className, grazing, flip, style }: { className?: string; grazing?: boolean; flip?: boolean; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 130 84" className={className} style={{ ...style, transform: flip ? 'scaleX(-1)' : undefined }} aria-hidden>
      {/* pernas */}
      {[30, 42, 76, 88].map((x) => (
        <rect key={x} x={x} y="50" width="7" height="26" rx="3" fill="#fff" stroke="#463f33" strokeWidth="1.5" />
      ))}
      {[30, 42, 76, 88].map((x) => (
        <rect key={`c${x}`} x={x} y="72" width="7" height="5" rx="1.5" fill="#463f33" />
      ))}
      {/* cauda */}
      <path d="M20 34c-8 4-9 16-6 24" fill="none" stroke="#463f33" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="14" cy="60" rx="3" ry="4" fill="#463f33" />
      {/* corpo */}
      <ellipse cx="58" cy="40" rx="42" ry="22" fill="#fff" stroke="#463f33" strokeWidth="1.8" />
      <path d="M40 22c8 2 10 12 4 18-7 4-16 0-16-8 2-6 6-10 12-10z" fill="#463f33" />
      <path d="M72 36c6-2 12 2 12 8-1 6-8 8-13 5-4-3-4-10 1-13z" fill="#463f33" />
      <ellipse cx="60" cy="58" rx="8" ry="4" fill="#f6c9c0" />
      {/* cabeça */}
      <g className={grazing ? 'animate-nod' : ''} style={{ transformBox: 'view-box', transformOrigin: '96px 32px' }}>
        <path d="M100 20c-2-6 0-9 3-10 0 4 1 6 3 8z" fill="#d4ad82" />
        <ellipse cx="96" cy="22" rx="6" ry="3" fill="#fff" stroke="#463f33" strokeWidth="1.4" transform="rotate(-25 96 22)" />
        <path d="M96 24c2-6 10-9 17-5 5 3 6 10 5 16-1 7-6 11-12 10-7-1-12-7-10-21z" fill="#fff" stroke="#463f33" strokeWidth="1.8" />
        <circle cx="108" cy="28" r="1.8" fill="#463f33" />
        <ellipse cx="112" cy="40" rx="7" ry="5" fill="#f6c9c0" stroke="#463f33" strokeWidth="1.4" />
        <circle cx="114" cy="40" r="1" fill="#463f33" />
      </g>
    </svg>
  );
}

function Cloud({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 120 50" className={className} style={style} aria-hidden>
      <path d="M20 42c-10 0-14-12-5-17 1-11 16-14 22-6 6-10 24-8 26 5 12-2 18 12 8 18z" fill="#fff" opacity=".95" />
    </svg>
  );
}

function Tuft({ x, y, delay = 0 }: { x: number; y: number; delay?: number }) {
  return (
    <path
      d={`M${x} ${y}l-3-10m3 10l1-13m-1 13l5-9`}
      stroke="#68a653"
      strokeWidth="2"
      strokeLinecap="round"
      className="animate-sway"
      style={{ ...box, transformOrigin: 'bottom', animationDelay: `${delay}s` }}
    />
  );
}

/**
 * Paisagem de fazenda animada: céu, sol, nuvens, colinas, cerca e vacas pastando.
 * Clique em uma vaca para ouvir um "Muu!".
 */
export function Landscape({ className, children, compact }: { className?: string; children?: ReactNode; compact?: boolean }) {
  const [moo, setMoo] = useState<number | null>(null);
  const say = (i: number) => {
    setMoo(i);
    setTimeout(() => setMoo(null), 1200);
  };

  return (
    <div className={clsx('relative overflow-hidden bg-gradient-to-b from-ceu-200 via-ceu-100 to-pasto-50', className)}>
      {/* sol */}
      <div className="absolute right-[8%] top-5 h-14 w-14 rounded-full bg-terra-300 shadow-[0_0_60px_20px_rgba(228,201,168,.55)]" />
      {/* nuvens */}
      <Cloud className="absolute top-4 w-28 animate-drift" />
      <Cloud className="absolute top-12 w-20 animate-drift opacity-80" style={{ animationDelay: '-25s', animationDuration: '80s' }} />
      <Cloud className="absolute top-2 w-16 animate-drift opacity-70" style={{ animationDelay: '-45s', animationDuration: '70s' }} />

      {/* conteúdo sobreposto */}
      <div className="relative z-10">{children}</div>

      {/* colinas + cerca */}
      <svg viewBox="0 0 1200 140" preserveAspectRatio="none" className={clsx('absolute bottom-0 left-0 w-full', compact ? 'h-16' : 'h-28')} aria-hidden>
        <path d="M0 70 C200 20 380 30 560 60 S900 30 1200 55 V140 H0z" fill="#cbe6bf" />
        <path d="M0 100 C250 60 450 75 700 95 S1050 70 1200 90 V140 H0z" fill="#a9d497" />
        <path d="M0 122 C300 105 600 112 900 118 S1100 110 1200 115 V140 H0z" fill="#86bf70" />
        {/* cerca */}
        <g stroke="#c0935f" strokeWidth="5" strokeLinecap="round">
          <line x1="20" y1="96" x2="420" y2="104" />
          <line x1="20" y1="110" x2="420" y2="116" />
          {[30, 110, 190, 270, 350, 410].map((x) => (
            <line key={x} x1={x} y1="88" x2={x} y2="124" strokeWidth="7" />
          ))}
        </g>
      </svg>
      {/* árvore */}
      <svg viewBox="0 0 60 80" className={clsx('absolute bottom-6 right-[18%]', compact ? 'w-8' : 'w-14')} aria-hidden>
        <rect x="26" y="45" width="8" height="30" rx="3" fill="#9f7546" />
        <circle cx="30" cy="30" r="22" fill="#68a653" />
        <circle cx="18" cy="38" r="12" fill="#86bf70" />
        <circle cx="42" cy="36" r="13" fill="#518a40" />
      </svg>
      {/* tufos de grama */}
      <svg viewBox="0 0 1200 30" preserveAspectRatio="none" className="absolute bottom-0 left-0 h-5 w-full" aria-hidden>
        {Array.from({ length: 24 }, (_, i) => (
          <Tuft key={i} x={25 + i * 50} y={30} delay={(i % 5) * 0.4} />
        ))}
      </svg>

      {/* vacas */}
      {!compact &&
        [
          { left: '28%', w: 'w-24', delay: '0s', grazing: true },
          { left: '58%', w: 'w-16', delay: '-7s', grazing: false, flip: true },
        ].map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => say(i)}
            className="group absolute bottom-3 animate-graze focus:outline-none"
            style={{ left: c.left, animationDelay: c.delay }}
            aria-label="Vaca"
          >
            {moo === i && (
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 animate-pop whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-xs font-bold text-palha-700 shadow-soft">
                Muu!
              </span>
            )}
            <Cow className={clsx(c.w, 'transition-transform group-hover:-translate-y-1')} grazing={c.grazing} flip={c.flip} />
          </button>
        ))}
    </div>
  );
}

/** Divisória de cerca pequena. */
export function FenceDivider({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 16" preserveAspectRatio="none" className={clsx('h-3 w-full', className)} aria-hidden>
      <g stroke="#dbd1b8" strokeWidth="2.5" strokeLinecap="round">
        <line x1="0" y1="5" x2="400" y2="5" />
        <line x1="0" y1="11" x2="400" y2="11" />
        {Array.from({ length: 21 }, (_, i) => (
          <line key={i} x1={i * 20} y1="1" x2={i * 20} y2="15" strokeWidth="3" />
        ))}
      </g>
    </svg>
  );
}

/** Ilustração para estados vazios: vaca dormindo. */
export function SleepingCow({ className }: { className?: string }) {
  return (
    <div className={clsx('relative mx-auto w-28', className)}>
      <Cow className="w-28 opacity-80" grazing />
      <span className="absolute -top-2 right-0 animate-bounce text-sm font-bold text-palha-400">z z</span>
    </div>
  );
}
