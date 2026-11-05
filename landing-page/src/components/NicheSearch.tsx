'use client';

/**
 * Buscador inteligente de giro para el onboarding.
 * Filtra por nombre/id/descripción mientras escribes, muestra la descripción
 * al seleccionar y deja el acceso a soporte si el giro no está en el catálogo.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Search, X } from 'lucide-react';

export interface NicheOption {
  id: string;
  name: string;
  description?: string | null;
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function NicheSearch({
  niches,
  value,
  onChange,
  loading = false,
  supportHref = '/support',
  supportLabel = 'Escríbenos',
}: {
  niches: NicheOption[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
  supportHref?: string;
  supportLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => niches.find((n) => n.id === value) ?? null,
    [niches, value],
  );

  // Prefill desde el padre (query param, negocio existente…). Si el usuario
  // escribe, `value` se limpia y NO borramos lo que está tecleando.
  useEffect(() => {
    if (!value) return;
    const found = niches.find((n) => n.id === value);
    if (found) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(found.name);
    }
  }, [value, niches]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return niches;
    return niches.filter((n) =>
      normalize(`${n.name} ${n.id} ${n.description ?? ''}`).includes(q),
    );
  }, [niches, query]);

  const select = (n: NicheOption) => {
    onChange(n.id);
    setQuery(n.name);
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(true);
  };

  return (
    <div ref={boxRef} className="relative">
      <label className="mb-1.5 block text-[10.5px] font-black uppercase tracking-wider text-gray-500 dark:text-white/45">
        Tu giro
      </label>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-white/35" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value.slice(0, 60));
            setOpen(true);
            if (value) onChange('');
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filtered[0]) select(filtered[0]);
            }
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Escribe tu giro: cafetería, barbería, gym…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="niche-suggestions"
          className="w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-11 pr-11 text-sm font-medium text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-pink-500/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/25 dark:focus:bg-white/[0.06]"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label="Cambiar giro"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && !value && (
        <div
          id="niche-suggestions"
          role="listbox"
          className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-2xl dark:border-white/10 dark:bg-[#120A14]"
        >
          {loading ? (
            <p className="m-0 px-3 py-3 text-xs text-gray-500">Cargando giros…</p>
          ) : filtered.length === 0 ? (
            <p className="m-0 px-3 py-3 text-xs text-gray-500">
              No encontramos ese giro. Escríbenos abajo y lo registramos.
            </p>
          ) : (
            filtered.map((n) => {
              const active = value === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(n)}
                  className="flex w-full items-start justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-pink-500/10"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-black text-gray-900 dark:text-white">
                      {n.name}
                    </span>
                    {n.description && (
                      <span className="mt-0.5 block line-clamp-1 text-[10.5px] text-gray-500 dark:text-white/45">
                        {n.description}
                      </span>
                    )}
                  </span>
                  {active && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pink-500" />}
                </button>
              );
            })
          )}
        </div>
      )}

      {selected && (
        <div className="mt-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5">
          <p className="m-0 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> {selected.name}
          </p>
          <p className="m-0 mt-1 text-xs leading-relaxed text-gray-600 dark:text-white/60">
            {selected.description || 'Te ayudamos a configurarlo a tu medida.'}
          </p>
        </div>
      )}

      <p className="m-0 mt-3 text-[11px] text-gray-500 dark:text-white/40">
        ¿No ves tu giro?{' '}
        <a
          href={supportHref}
          className="font-bold text-pink-500 underline underline-offset-2 hover:text-pink-400"
        >
          {supportLabel}
        </a>{' '}
        y lo registramos.
      </p>
    </div>
  );
}
