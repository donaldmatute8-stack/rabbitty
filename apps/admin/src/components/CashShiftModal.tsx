"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, toast, cn } from "@rabbitty/ui";
import { Banknote, Lock, LockOpen, ArrowLeftRight, ClipboardCheck, HandCoins, Printer, ShieldCheck, Clock, BookOpen, HelpCircle, AlertCircle, CreditCard, Sparkles } from "lucide-react";
import Link from "next/link";
import { trpc } from "../lib/trpc-client";
import { printEngine } from "../lib/print-engine";

type Mode = "home" | "open" | "withdraw" | "partial" | "handover" | "close" | "result";

const fmt = (n: number | null | undefined) => `$${Number(n ?? 0).toFixed(2)}`;

function PinField({ label, value, onChange, id, autoFocus }: { label: string; value: string; onChange: (v: string) => void; id: string; autoFocus?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-wider">{label}</label>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder="••••"
        className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 text-center text-xl tracking-[0.5em] text-white focus:outline-none focus:border-cyan-500"
      />
    </div>
  );
}

function MoneyField({ label, value, onChange, id, autoFocus }: { label: string; value: string; onChange: (v: string) => void; id: string; autoFocus?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-wider">{label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 text-lg text-white focus:outline-none focus:border-cyan-500"
      />
    </div>
  );
}

function NoteField({ value, onChange, label = "Notas / justificación", id }: { value: string; onChange: (v: string) => void; label?: string; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-wider">{label}</label>
      <input
        id={id}
        type="text"
        maxLength={300}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
      />
    </div>
  );
}

export function CashShiftModal({
  open,
  onClose,
  buildTicketHeader,
  initialMode,
}: {
  open: boolean;
  onClose: () => void;
  buildTicketHeader: () => Record<string, any>;
  initialMode?: "open";
}) {
  const utils = trpc.useUtils();
  const { data, refetch } = trpc.cashShifts.current.useQuery({}, { enabled: open, refetchInterval: open ? 15000 : false });

  const [mode, setMode] = useState<Mode>("home");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [managerPin, setManagerPin] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [needManager, setNeedManager] = useState(false);
  const [result, setResult] = useState<any>(null);

  const reset = () => {
    setPin("");
    setPin2("");
    setManagerPin("");
    setAmount("");
    setNotes("");
    setNeedManager(false);
  };
  const goHome = () => {
    reset();
    setMode("home");
  };

  useEffect(() => {
    if (open) {
      reset();
      setResult(null);
      setMode(initialMode === "open" ? "open" : "home");
    }
  }, [open, initialMode]);

  const isOpen = !!data?.open;
  const currentTotals = data?.open ? data.totals : null;
  const settings: any = data?.settings;
  const mgrThreshold = Number(settings?.cashDropManagerThreshold ?? 1000);

  const refreshAll = () => {
    refetch();
    utils.cashDrops.getStatus.invalidate();
  };

  const onError = (err: any) => {
    const msg: string = err?.message || "Error";
    if (msg.startsWith("MANAGER_PIN_REQUIRED")) setNeedManager(true);
    toast.error(msg.replace(/^MANAGER_PIN_REQUIRED:\s*/, ""));
  };

  const printReport = async (payload: any) => {
    const ticket = { isShiftReport: true, ...payload, ...buildTicketHeader() };
    if (!printEngine.isConnected()) {
      toast.warning("Sin impresora conectada: el comprobante quedó en cola.");
    }
    try {
      const res = await printEngine.printTicket(ticket, true);
      if (res.success) toast.success("Comprobante impreso");
      else if (res.queued) toast.info(res.error || "Comprobante en cola de impresión.");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo imprimir");
    }
  };

  const showResult = (r: any) => {
    setResult(r);
    setMode("result");
    reset();
  };

  const openMut = trpc.cashShifts.open.useMutation({
    onSuccess: async (r) => {
      toast.success(`Caja abierta por ${r.cashierName}`);
      refreshAll();
      await printReport({
        kind: "OPEN",
        cashierName: r.cashierName,
        openedAt: r.shift.openedAt,
        openingFloat: r.shift.openingFloat,
      });
      onClose();
    },
    onError,
  });

  const withdrawMut = trpc.cashShifts.withdraw.useMutation({
    onSuccess: async (r) => {
      toast.success("Retiro registrado");
      refreshAll();
      await printReport({ isCashDrop: true, isShiftReport: false, amount: r.drop.amount, notes: r.drop.notes, staffName: r.cashierName });
      goHome();
    },
    onError,
  });

  const partialMut = trpc.cashShifts.partialClose.useMutation({
    onSuccess: async (r) => {
      refreshAll();
      await printReport(r);
      showResult(r);
    },
    onError,
  });

  const handoverMut = trpc.cashShifts.handover.useMutation({
    onSuccess: async (r) => {
      toast.success(`Turno traspasado a ${r.incomingName}`);
      refreshAll();
      await printReport(r);
      showResult(r);
    },
    onError,
  });

  const closeMut = trpc.cashShifts.close.useMutation({
    onSuccess: async (r) => {
      toast.success("Turno cerrado");
      refreshAll();
      await printReport(r);
      showResult(r);
    },
    onError,
  });

  const busy = openMut.isPending || withdrawMut.isPending || partialMut.isPending || handoverMut.isPending || closeMut.isPending;
  const num = Number(amount);
  const validAmount = amount !== "" && Number.isFinite(num) && num >= 0;

  const titles: Record<Mode, string> = {
    home: "Caja / Turno",
    open: "Abrir caja",
    withdraw: "Retiro de efectivo",
    partial: "Cierre parcial (Ticket X)",
    handover: "Traspaso de turno",
    close: "Cerrar turno (Ticket Z)",
    result: "Resumen",
  };

  const BackBtn = () => (
    <Button type="button" variant="secondary" onClick={goHome} disabled={busy} className="text-xs">
      Volver
    </Button>
  );

  return (
    <Dialog open={open} onClose={onClose} title={titles[mode]}>
      <div className="space-y-4" data-testid="cash-shift-modal">
        {mode === "home" && !isOpen && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30">
              <Lock className="h-8 w-8 text-amber-400" />
            </div>
            <div>
              <p className="text-lg font-black text-white">La caja está cerrada</p>
              <p className="text-xs text-gray-400 mt-1">
                Para cobrar en efectivo necesitas abrir turno con tu PIN y el fondo inicial.
              </p>
            </div>
            <Button id="cash-open-start" onClick={() => setMode("open")} className="w-full bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold py-3">
              <LockOpen className="h-4 w-4 mr-2 inline" /> Abrir caja
            </Button>
          </div>
        )}

        {mode === "home" && isOpen && data?.open && (
          <>
            <div className="p-4 rounded-2xl bg-linear-to-br from-white/8 to-white/2 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Turno abierto {new Date(data.shift.openedAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">ABIERTO</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Cajero actual</span>
                  <span className="font-black text-white">{data.shift.currentStaffName ?? "—"}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Fondo inicial</span>
                  <span className="font-black text-white">{fmt(data.totals.openingFloat)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-amber-500/20">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Retiros</span>
                  <span className="font-black text-amber-400">-{fmt(data.totals.withdrawals)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Tarjeta + Bunz</span>
                  <span className="font-black text-cyan-300">{fmt(data.totals.cardSales + data.totals.bunzSales)}</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Arqueo ciego: el efectivo esperado se revela hasta que cuentas la gaveta.
              </p>
              {/* Reminder banner */}
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Gastos y pagos de agua/insumos:</span>
                    <span className="text-[11px] text-gray-300">Usa "Retiro" para pagar compras menores. El sistema lo descuenta automáticamente del corte final.</span>
                  </div>
                </div>
                <Link href="/operations-manual" target="_blank" className="text-[10px] font-bold text-pink-400 hover:text-pink-300 whitespace-nowrap underline flex items-center gap-1 shrink-0">
                  <BookOpen className="h-3 w-3" /> Ver Manual
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button id="cash-withdraw-start" variant="secondary" onClick={() => setMode("withdraw")} className="py-3 text-xs font-bold">
                <HandCoins className="h-4 w-4 mr-1 inline" /> Retiro
              </Button>
              <Button id="cash-partial-start" variant="secondary" onClick={() => setMode("partial")} className="py-3 text-xs font-bold">
                <ClipboardCheck className="h-4 w-4 mr-1 inline" /> Cierre parcial (X)
              </Button>
              <Button id="cash-handover-start" variant="secondary" onClick={() => setMode("handover")} className="py-3 text-xs font-bold">
                <ArrowLeftRight className="h-4 w-4 mr-1 inline" /> Cambio de cajero
              </Button>
              <Button id="cash-close-start" onClick={() => setMode("close")} className="py-3 text-xs font-bold bg-red-500 hover:bg-red-400 text-white">
                <Lock className="h-4 w-4 mr-1 inline" /> Cerrar turno (Z)
              </Button>
            </div>
            <div className="flex justify-end">
              <Link href="/cash-shifts" className="text-xs text-gray-400 hover:text-cyan-400 hover:underline font-semibold">
                Historial y auditoría →
              </Link>
            </div>
          </>
        )}

        {mode === "open" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              openMut.mutate({ pin, openingFloat: num });
            }}
          >
            <p className="text-xs text-gray-400">Ingresa tu PIN y el efectivo con el que inicia la gaveta (fondo de cambio).</p>
            <PinField id="cash-open-pin" label="Tu PIN de cajero" value={pin} onChange={setPin} autoFocus />
            <MoneyField id="cash-open-float" label="Fondo inicial ($)" value={amount} onChange={setAmount} />
            <div className="flex gap-2 justify-end pt-1">
              <BackBtn />
              <Button type="submit" id="cash-open-submit" disabled={busy || pin.length !== 4 || !validAmount} className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold">
                {openMut.isPending ? "Abriendo..." : "Abrir caja e imprimir"}
              </Button>
            </div>
          </form>
        )}

        {mode === "withdraw" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              withdrawMut.mutate({ pin, amount: num, notes: notes || undefined, managerPin: managerPin || undefined });
            }}
          >
            {/* Saldo disponible en tiempo real */}
            <div className="p-3 rounded-xl bg-linear-to-r from-cyan-950/40 to-black border border-cyan-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Efectivo Disponible en Gaveta</span>
                <span className="text-lg font-black text-cyan-300">{fmt(currentTotals?.expectedCash ?? 0)}</span>
              </div>
              <HandCoins className="h-6 w-6 text-cyan-400 opacity-60" />
            </div>

            {/* Selector rápido de justificación */}
            <div>
              <span className="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-wider">Concepto Rápido</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Garrafones de agua",
                  "Compra de café / insumos",
                  "Hielo / Emergencia",
                  "Pago a proveedor",
                  "Retiro parcial a caja fuerte"
                ].map((concept) => (
                  <button
                    key={concept}
                    type="button"
                    onClick={() => setNotes(concept)}
                    className={cn(
                      "text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer",
                      notes === concept
                        ? "bg-cyan-500 text-gray-950 font-bold border-cyan-400"
                        : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                    )}
                  >
                    {concept}
                  </button>
                ))}
              </div>
            </div>

            <MoneyField id="cash-withdraw-amount" label="Monto a retirar / pagar ($)" value={amount} onChange={setAmount} autoFocus />

            {/* Validación visual reactiva */}
            {num > (currentTotals?.expectedCash ?? 0) && (
              <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>No puedes retirar más de lo que hay en gaveta ({fmt(currentTotals?.expectedCash ?? 0)} disponible).</span>
              </div>
            )}

            <NoteField id="cash-withdraw-notes" label="Detalle o justificación" value={notes} onChange={setNotes} />
            <PinField id="cash-withdraw-pin" label="PIN del cajero" value={pin} onChange={setPin} />
            {(num > mgrThreshold || needManager) && (
              <div className="space-y-1">
                <p className="text-[11px] text-amber-400 font-semibold">Monto mayor a {fmt(mgrThreshold)}: pide autorización de manager/admin.</p>
                <PinField id="cash-withdraw-mgr" label="PIN manager / admin" value={managerPin} onChange={setManagerPin} />
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <BackBtn />
              <Button 
                type="submit" 
                id="cash-withdraw-submit" 
                disabled={busy || pin.length !== 4 || !validAmount || num <= 0 || num > (currentTotals?.expectedCash ?? 0)} 
                className="bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-bold"
              >
                {withdrawMut.isPending ? "Registrando..." : "Registrar retiro e imprimir"}
              </Button>
            </div>
          </form>
        )}

        {mode === "partial" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              partialMut.mutate({ pin, countedCash: num, notes: notes || undefined });
            }}
          >
            <p className="text-xs text-gray-400">
              Cuenta billetes y monedas en la gaveta e ingresa el total. El turno sigue abierto; se imprime Ticket X.
            </p>
            <MoneyField id="cash-partial-counted" label="Efectivo contado ($)" value={amount} onChange={setAmount} autoFocus />
            <NoteField id="cash-partial-notes" value={notes} onChange={setNotes} />
            <PinField id="cash-partial-pin" label="PIN del cajero" value={pin} onChange={setPin} />
            <div className="flex gap-2 justify-end pt-1">
              <BackBtn />
              <Button type="submit" id="cash-partial-submit" disabled={busy || pin.length !== 4 || !validAmount} className="bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-bold">
                {partialMut.isPending ? "Calculando..." : "Registrar arqueo e imprimir X"}
              </Button>
            </div>
          </form>
        )}

        {mode === "handover" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              handoverMut.mutate({
                outgoingPin: pin,
                incomingPin: pin2,
                countedCash: num,
                notes: notes || undefined,
                managerPin: managerPin || undefined,
              });
            }}
          >
            <p className="text-xs text-gray-400">
              El cajero que sale cuenta la gaveta con su PIN; el que entra recibe con el suyo. Queda registrado quién entrega y quién recibe.
            </p>
            <MoneyField id="cash-handover-counted" label="Efectivo contado ($)" value={amount} onChange={setAmount} autoFocus />
            <div className="grid grid-cols-2 gap-2">
              <PinField id="cash-handover-out" label="PIN cajero saliente" value={pin} onChange={setPin} />
              <PinField id="cash-handover-in" label="PIN cajero entrante" value={pin2} onChange={setPin2} />
            </div>
            <NoteField id="cash-handover-notes" value={notes} onChange={setNotes} />
            {needManager && (
              <>
                <p className="text-[11px] text-amber-400 font-semibold">Hay descuadre: escribe una nota y pide PIN de manager/admin.</p>
                <PinField id="cash-handover-mgr" label="PIN manager / admin" value={managerPin} onChange={setManagerPin} />
              </>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <BackBtn />
              <Button type="submit" id="cash-handover-submit" disabled={busy || pin.length !== 4 || pin2.length !== 4 || !validAmount} className="bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-bold">
                {handoverMut.isPending ? "Traspasando..." : "Confirmar traspaso"}
              </Button>
            </div>
          </form>
        )}

        {mode === "close" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              closeMut.mutate({ pin, managerPin, countedCash: num, notes: notes || undefined });
            }}
          >
            {/* Paso 1: Cuadre de Tarjeta Bancaria */}
            <div className="p-3.5 rounded-xl bg-linear-to-r from-blue-950/40 to-black border border-blue-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> 1. Cotejo de Terminal Bancaria
                </span>
                <span className="text-xs font-black text-blue-300">{fmt(currentTotals?.cardSales ?? 0)}</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Coteja que los vouchers o el corte de tu terminal física (Clip, Mercado Pago o Banco) sumen exactamente <strong className="text-white">{fmt(currentTotals?.cardSales ?? 0)}</strong>. Las tarjetas no van en la gaveta física.
              </p>
            </div>

            {/* Paso 2: Conteo de Efectivo */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">2. Conteo de Efectivo en Gaveta</span>
              <p className="text-[11px] text-gray-400">
                Cuenta todos los billetes y monedas que tienes en mano. Si hay diferencia, la nota explicativa es obligatoria.
              </p>
            </div>

            <MoneyField id="cash-close-counted" label="Total Contado en Gaveta ($)" value={amount} onChange={setAmount} autoFocus />
            <NoteField id="cash-close-notes" value={notes} onChange={setNotes} label="Nota / Justificación (si hay diferencia)" />
            
            <div className="grid grid-cols-2 gap-2">
              <PinField id="cash-close-pin" label="PIN del cajero" value={pin} onChange={setPin} />
              <PinField id="cash-close-mgr" label="PIN manager / admin" value={managerPin} onChange={setManagerPin} />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <BackBtn />
              <Button type="submit" id="cash-close-submit" disabled={busy || pin.length !== 4 || managerPin.length !== 4 || !validAmount} className="bg-red-500 hover:bg-red-400 text-white font-bold">
                {closeMut.isPending ? "Cerrando..." : "Cerrar turno e imprimir Z"}
              </Button>
            </div>
          </form>
        )}

        {mode === "result" && result && (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Fondo inicial</span><span className="font-bold">{fmt(result.openingFloat)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Ventas en efectivo</span><span className="font-bold">{fmt(result.cashSales)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Retiros</span><span className="font-bold text-amber-400">-{fmt(result.withdrawals)}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-1.5"><span className="text-gray-400">Esperado</span><span className="font-black">{fmt(result.expectedCash)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Contado</span><span className="font-black">{fmt(result.countedCash)}</span></div>
              <div className={cn("flex justify-between font-black", Math.abs(result.difference) < 0.01 ? "text-emerald-400" : result.difference > 0 ? "text-cyan-300" : "text-red-400")}>
                <span>{Math.abs(result.difference) < 0.01 ? "Cuadrado" : result.difference > 0 ? "Sobrante" : "Faltante"}</span>
                <span>{fmt(Math.abs(result.difference))}</span>
              </div>
            </div>
            {result.kind === "X" && Math.abs(result.difference) >= 0.01 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-semibold">
                ⚠️ Descuadre detectado ({fmt(Math.abs(result.difference))} {result.difference > 0 ? "de sobrante" : "de faltante"}). Revísalo antes del cierre Z: el cierre exigirá nota y PIN de manager/admin.
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="secondary" className="text-xs" onClick={() => printReport(result)}>
                <Printer className="h-4 w-4 mr-1 inline" /> Reimprimir
              </Button>
              <Button type="button" onClick={result.kind === "Z" ? onClose : goHome} className="font-bold">
                {result.kind === "Z" ? "Listo" : "Volver"}
              </Button>
            </div>
          </div>
        )}

        {mode === "home" && (
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose} className="text-xs">
              Cerrar ventana
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

export function CashShiftBadge({ onClick }: { onClick: () => void }) {
  const { data } = trpc.cashDrops.getStatus.useQuery({}, { refetchInterval: 30000 });
  const isOpen = !!(data as any)?.shiftOpen;
  return (
    <button
      id="cash-shift-badge"
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-2xl px-3 py-2 border text-xs font-bold transition-all active:scale-95",
        isOpen
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
          : "bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 animate-pulse"
      )}
    >
      {isOpen ? <Banknote className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
      {isOpen ? "Caja abierta" : "Caja cerrada · Abrir"}
    </button>
  );
}
