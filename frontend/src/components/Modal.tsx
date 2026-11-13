import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Janela sobreposta. No celular abre como "gaveta" de baixo; no desktop, centralizada. */
export function Modal({ title, subtitle, onClose, children }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-palha-900/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:max-w-lg sm:rounded-3xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-palha-100 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-palha-900">{title}</h2>
            {subtitle && <p className="text-sm text-palha-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-palha-500 hover:bg-palha-100" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
