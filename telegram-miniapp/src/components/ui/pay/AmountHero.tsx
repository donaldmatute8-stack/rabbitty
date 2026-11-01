'use client';

/**
 * ── AmountHero ── Monto gigante tappable (estilo minimal "Top up"):
 * muestra $0.00 en tipografía enorme; un texto sutil invita "Toca el número
 * para personalizar". Al tocar → input de teclado numérico con la misma
 * tipografía gigante. SIN flechas +/- ni botones de personalizar.
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function AmountHero({
  value,
  onChange,
  max = 5000,
  caption = 'Toca el número para personalizar',
  symbol = '$',
  currency = 'MXN',
  autoEdit = false,
}: {
  /** Monto en MXN (0 muestra $0.00) */
  value: number;
  /** Texto crudo mientras se edita (para no pelear con el teclado) */
  onChange: (mxn: number, raw: string) => void;
  max?: number;
  caption?: string;
  symbol?: string;
  currency?: string;
  autoEdit?: boolean;
}) {
  const [editing, setEditing] = useState(autoEdit);
  const [raw, setRaw] = useState(value > 0 ? String(value) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const display = editing ? raw : (value > 0 ? value.toFixed(2) : '0.00');

  return (
    <div className="flex flex-col items-center select-none">
      <div className="flex items-baseline justify-center gap-1">
        <span className="text-[38px] font-black leading-none text-white/80">{symbol}</span>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={raw}
            onChange={(e) => {
              const next = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 8);
              if (next !== '' && Number(next) > max) return;
              setRaw(next);
              onChange(Number(next) || 0, next);
            }}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditing(false); }}
            className="w-[210px] bg-transparent text-center text-[64px] font-black leading-none text-white outline-none caret-[#E91E63]"
            placeholder="0.00"
          />
        ) : (
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => setEditing(true)}
            aria-label="Editar monto"
            className="bg-transparent border-none p-0 cursor-text text-[64px] font-black leading-none text-white tabular-nums tracking-tight"
          >
            {display}
          </motion.button>
        )}
      </div>
      {!editing && <p className="text-[10px] text-white/35 mt-2">{caption}</p>}
      {editing && <p className="text-[10px] text-white/30 mt-2">Máximo {symbol}{max.toFixed(2)} {currency}</p>}
    </div>
  );
}