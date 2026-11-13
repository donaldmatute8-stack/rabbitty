"use client";

/**
 * ── Comandero digital (ADR-025) ─────────────────────────────────────────────
 *
 * Pantalla para que el mesero tome la orden en la mesa o en mostrador. **No
 * cobra**: abre la cuenta y la caja la cierra. Precios en MXN, sin propina.
 *
 * Entrada: el dispositivo debe estar vinculado (token de terminal) y el mesero
 * debe checar con el QR de la sucursal + su PIN.
 *
 * Flujo: mesas → cuenta → menú → hoja del platillo (extras/notas/alergias/
 * nombre) → tanda → enviar a cocina/barra.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "../../../lib/trpc-client";
import { getPosTerminalToken, savePosOperator, clearPosOperator } from "../../../lib/pos-terminal";
import { flushQueue, listQueue, queueAdd, type QueuedAdd } from "../../../lib/comandero-queue";
import { Badge, Button, Input, cn, toast, useWakeLock } from "@rabbitty/ui";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChefHat,
  Loader2,
  Minus,
  Plus,
  QrCode,
  Search,
  Send,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";

const ALLERGENS = ["Gluten", "Lactosa", "Nuez", "Mariscos", "Huevo", "Soya", "Cacahuate"];

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function ComanderoPage() {
  useWakeLock();

  const utils = trpc.useUtils();
  const [terminalToken, setTerminalToken] = useState<string | null>(null);
  useEffect(() => setTerminalToken(getPosTerminalToken()), []);

  // ── D8: solo Wi-Fi ───────────────────────────────────────────────────────
  // Un PWA no puede activar modo avión, pero sí puede negarse a operar cuando
  // el navegador informa que la conexión es de datos móviles (Android/Chrome).
  // En iOS no se expone el tipo: se muestra un aviso, no se bloquea.
  const [net, setNet] = useState<{ blocked: boolean; type: string | null }>({ blocked: false, type: null });
  useEffect(() => {
    const conn = (navigator as any).connection;
    if (!conn) return;
    const check = () => {
      const type = String(conn.type || "");
      setNet({ blocked: type === "cellular", type: type || null });
    };
    check();
    conn.addEventListener?.("change", check);
    return () => conn.removeEventListener?.("change", check);
  }, []);

  // ── Chequeo ──────────────────────────────────────────────────────────────
  const status = trpc.comandero.status.useQuery(undefined, {
    enabled: Boolean(terminalToken),
    refetchOnWindowFocus: false,
  });
  const checkedIn = status.data?.checkedIn === true;

  if (net.blocked) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-[#08080a] p-8 text-center text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600 text-2xl font-black">!</div>
        <h1 className="m-0 text-xl font-black">Conéctate al Wi-Fi</h1>
        <p className="m-0 max-w-sm text-sm text-gray-400">
          El comandero no opera con datos móviles. Activa el Wi-Fi del restaurante y vuelve a
          entrar: así las comandas no se pierden y no gastas datos del mesero.
        </p>
        <p className="m-0 text-[11px] text-gray-500">Red detectada: {net.type ?? "desconocida"}</p>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#08080a] text-white">
      {!net.type && terminalToken && (
        <p className="m-0 bg-amber-500/10 px-3 py-1 text-center text-[10px] text-amber-300">
          Este navegador no informa el tipo de red. Verifica que estés en el Wi-Fi del restaurante.
        </p>
      )}
      {!terminalToken ? (
        <PairingGate />
      ) : !checkedIn ? (
        <CheckInGate onDone={() => status.refetch()} />
      ) : (
        <Comandero onExit={() => { clearPosOperator(); void status.refetch(); }} />
      )}
    </div>
  );
}

/* ─────────────────────────── Puertas de entrada ─────────────────────────── */

function PairingGate() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-600 text-2xl font-black">R</div>
      <h1 className="m-0 text-xl font-black">Comandero</h1>
      <p className="m-0 max-w-sm text-sm text-gray-400">
        Este dispositivo no está vinculado. Pide que lo enlacen desde
        <span className="font-bold text-white"> Ajustes → Terminales</span> (tipo COMANDERO) y ábrelo
        desde el enlace de vinculación.
      </p>
      <Link href="/pos/link" className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold hover:bg-pink-700">
        Vincular este dispositivo
      </Link>
    </div>
  );
}

function CheckInGate({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);

  const checkIn = trpc.comandero.checkIn.useMutation({
    onSuccess: (data) => {
      savePosOperator(data.token, {
        staffId: data.operator.staffId,
        name: data.operator.name,
        role: String(data.operator.role),
      });
      toast.success(`Bienvenido, ${data.operator.name}`);
      onDone();
    },
    onError: (e) => setError(e.message),
  });

  const startScan = async () => {
    setError(null);
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("comandero-scan");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 240 },
        (text: string) => {
          setCode(text.trim().toUpperCase().slice(0, 20));
          void scanner.stop().catch(() => {});
          setScanning(false);
        },
        () => {},
      );
    } catch (e) {
      setScanning(false);
      setError("No se pudo abrir la cámara. Captura el código a mano.");
    }
  };

  const stopScan = async () => {
    try {
      await scannerRef.current?.stop();
    } catch {}
    scannerRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => void stopScan(), []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
      <div className="text-center">
        <p className="m-0 text-[10px] font-black uppercase tracking-[0.25em] text-pink-500">Entrada</p>
        <h1 className="m-0 mt-1 text-2xl font-black">Checa tu turno</h1>
        <p className="m-0 mt-1 max-w-xs text-sm text-gray-400">
          Escanea el QR de la sucursal y captura tu PIN. Sin checar no se puede tomar pedidos.
        </p>
      </div>

      {scanning ? (
        <div className="w-full max-w-xs overflow-hidden rounded-2xl border border-white/10">
          <div id="comandero-scan" className="w-full" />
          <button onClick={stopScan} className="w-full bg-white/5 py-2 text-xs font-bold text-gray-300">
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={startScan}
          className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-pink-600 py-4 text-sm font-black hover:bg-pink-700"
        >
          <QrCode className="h-5 w-5" /> Escanear QR de la sucursal
        </button>
      )}

      <div className="w-full max-w-xs space-y-3">
        <Input
          label="Código de sucursal"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 20))}
          placeholder="XXXXXXXX"
          className="text-center font-mono tracking-[0.3em]"
        />
        <Input
          label="Tu PIN"
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="••••"
          className="text-center text-2xl tracking-[0.5em]"
        />
        <Button
          onClick={() => checkIn.mutate({ code, pin })}
          disabled={code.length < 4 || pin.length !== 4 || checkIn.isPending}
          className="w-full py-3"
        >
          {checkIn.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Entrar al comandero
        </Button>
        {error && (
          <p className="m-0 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4" /> {error}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────── Comandero ─────────────────────────────── */

function Comandero({ onExit }: { onExit: () => void }) {
  const utils = trpc.useUtils();
  const [tableId, setTableId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [panel, setPanel] = useState<"menu" | "ticket">("menu");

  const board = trpc.comandero.board.useQuery(undefined, { refetchInterval: 20_000 });

  // ── Cola local: lo que no se pudo enviar por falta de red ──
  const [queued, setQueued] = useState<QueuedAdd[]>([]);
  const refreshQueue = () => setQueued(listQueue());
  const replayAdd = trpc.pos.addToCart.useMutation();

  const flush = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const sent = await flushQueue(
      (item) =>
        replayAdd.mutateAsync({
          orderId: item.orderId,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          modifiers: item.modifiers.length ? item.modifiers : undefined,
          notes: item.notes,
          allergies: item.allergies,
          guestName: item.guestName,
          hold: true,
        }),
      (item, error) => {
        toast.error(`No se pudo agregar ${item.menuItemId}: ${(error as Error).message}`);
      },
    );
    refreshQueue();
    if (sent > 0) {
      toast.success(`${sent} pendiente(s) enviados`);
      void utils.pos.getOrders.invalidate();
      void board.refetch();
    }
  };

  useEffect(() => {
    refreshQueue();
    void flush();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    const id = setInterval(() => void flush(), 20_000);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Aviso de "listo" (D9): sondeo corto + sonido y vibración ──
  const ready = trpc.comandero.readyFeed.useQuery(undefined, { refetchInterval: 10_000 });
  const readyItems = ready.data ?? [];
  const prevReady = useRef(0);
  useEffect(() => {
    if (readyItems.length > prevReady.current) {
      // Beep sin asset: oscilador corto (funciona en PWA instalada).
      try {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      } catch {}
      try { navigator.vibrate?.([120, 60, 120]); } catch {}
    }
    prevReady.current = readyItems.length;
  }, [readyItems.length]);

  const markPicked = trpc.kds.updateOrderItemStatus.useMutation({
    onSuccess: () => {
      utils.comandero.readyFeed.invalidate();
      toast.success("Entregado");
    },
    onError: (e) => toast.error(e.message),
  });
  const categories = trpc.pos.getCategories.useQuery(undefined, { staleTime: 5 * 60_000 });
  const menu = trpc.pos.getMenuItems.useQuery({ categoryId: categoryId ?? undefined }, { staleTime: 60_000 });
  const openOrder = trpc.comandero.openOrder.useMutation();

  const orders = trpc.pos.getOrders.useQuery(
    { tableId: tableId ?? undefined, status: "PENDING" },
    { enabled: Boolean(tableId), refetchInterval: 10_000 },
  );
  const currentOrder = useMemo(() => {
    const list = orders.data ?? [];
    return list.find((o: any) => o.id === orderId) ?? list[0] ?? null;
  }, [orders.data, orderId]);

  const unsent = (currentOrder?.items ?? []).filter((i: any) => !i.sentToStationAt);
  const total = Number(currentOrder?.total ?? 0);

  const requestBill = trpc.comandero.requestBill.useMutation({
    onSuccess: () => {
      toast.success("Cuenta pedida — caja ya la ve");
      void board.refetch();
      void utils.pos.getOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const sendRound = trpc.comandero.sendRound.useMutation({
    onSuccess: (r) => {
      toast.success(r.sent > 0 ? `${r.sent} platillo(s) enviados a cocina` : "No había nada pendiente");
      utils.pos.getOrders.invalidate();
      void board.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const pickTable = async (id: string) => {
    const res = await openOrder.mutateAsync({ tableId: id, orderType: "DINE_IN" });
    setTableId(id);
    setOrderId(res.orderId);
    setPanel("menu");
    void utils.pos.getOrders.invalidate();
  };

  const openCounter = async (orderType: "TO_GO" | "DINE_IN") => {
    const res = await openOrder.mutateAsync({ orderType });
    setTableId(null);
    setOrderId(res.orderId);
    setPanel("menu");
    void utils.pos.getOrders.invalidate();
  };

  const exitTable = () => {
    setTableId(null);
    setOrderId(null);
    setPanel("menu");
    void board.refetch();
  };

  const filtered = (menu.data ?? []).filter((i: any) =>
    search.trim() ? i.name.toLowerCase().includes(search.trim().toLowerCase()) : true,
  );

  // Aviso compartido por las dos vistas (tablero y cuenta abierta).
  const readyBanner = readyItems.length > 0 ? (
    <>
        <div className="border-b border-emerald-500/40 bg-emerald-500/15 px-3 py-2">
          <p className="m-0 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-emerald-300">
            <Check className="h-4 w-4" /> Listo para entregar ({readyItems.length})
          </p>
          <div className="mt-1.5 space-y-1.5">
            {readyItems.map((r: any) => (
              <div
                key={r.itemId}
                className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-black/30 px-2.5 py-1.5"
              >
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-bold">
                    {r.quantity}× {r.name}
                  </p>
                  <p className="m-0 text-[10px] text-emerald-200/80">
                    {r.stationName ?? "Cocina"} ·{" "}
                    {r.tableNumber ? `Mesa ${r.tableNumber}` : r.orderType === "TO_GO" ? "Para llevar" : "Mostrador"}
                    {r.guestName ? ` · para ${r.guestName}` : ""}
                  </p>
                  {r.allergies && (
                    <p className="m-0 text-[10px] font-bold text-red-300">⚠ {r.allergies}</p>
                  )}
                </div>
                <button
                  onClick={() => markPicked.mutate({ orderItemId: r.itemId, status: "SERVED" })}
                  disabled={markPicked.isPending}
                  className="shrink-0 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] font-black text-gray-950 disabled:opacity-50"
                >
                  Entregado
                </button>
              </div>
            ))}
          </div>
        </div>
      
    </>
  ) : null;

  /* ── Sin mesa: tablero ── */
  if (!tableId && !orderId) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="m-0 text-[10px] font-black uppercase tracking-[0.25em] text-pink-500">Comandero</p>
            <h1 className="m-0 text-lg font-black">Mesas</h1>
          </div>
          <button onClick={onExit} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-gray-300">
            Cerrar turno
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => openCounter("TO_GO")}
              className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
            >
              <p className="m-0 text-sm font-black">Para llevar</p>
              <p className="m-0 text-[11px] text-gray-500">Abre una cuenta nueva</p>
            </button>
            <button
              onClick={() => openCounter("DINE_IN")}
              className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
            >
              <p className="m-0 text-sm font-black">Mostrador</p>
              <p className="m-0 text-[11px] text-gray-500">Sin mesa</p>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(board.data?.tables ?? []).map((t: any) => (
              <button
                key={t.id}
                onClick={() => pickTable(t.id)}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-all active:scale-[0.98]",
                  t.order
                    ? "border-amber-400/40 bg-amber-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black">Mesa {t.number}</span>
                  {t.order ? <Badge variant="warning">Abierta</Badge> : <Badge variant="success">Libre</Badge>}
                </div>
                <p className="m-0 mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                  <Users className="h-3 w-3" /> {t.capacity} personas
                  {t.location ? ` · ${t.location}` : ""}
                </p>
                {t.order && (
                  <p className="m-0 mt-1 text-xs font-bold text-amber-300">
                    {money(t.order.total)} · {t.order.items} ítems
                  </p>
                )}
                {t.order?.billRequested && (
                  <p className="m-0 mt-1 inline-flex rounded-full bg-pink-500/20 px-2 py-0.5 text-[10px] font-black text-pink-300">
                    Cuenta pedida
                  </p>
                )}
              </button>
            ))}
            {(board.data?.tables ?? []).length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-gray-500">
                No hay mesas configuradas en esta sucursal.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Con cuenta abierta ── */
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {readyBanner}
      <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <button onClick={exitTable} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-300 hover:bg-white/5">
          <ArrowLeft className="h-4 w-4" /> Mesas
        </button>
        <div className="text-center">
          <p className="m-0 text-[10px] uppercase tracking-wider text-gray-500">
            {tableId ? `Mesa ${(board.data?.tables ?? []).find((t: any) => t.id === tableId)?.number ?? ""}` : "Mostrador"}
          </p>
          <p className="m-0 text-sm font-black">{money(total)}</p>
          {queued.length > 0 && (
            <p className="m-0 text-[9px] font-bold text-amber-300">{queued.length} en cola</p>
          )}
        </div>
        <button
          onClick={() => sendRound.mutate({ orderId: currentOrder!.id })}
          disabled={!currentOrder || unsent.length === 0 || sendRound.isPending}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black",
            unsent.length > 0 ? "bg-emerald-500 text-gray-950" : "bg-white/5 text-gray-500",
          )}
        >
          {sendRound.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar{unsent.length > 0 ? ` (${unsent.length})` : ""}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className={cn("flex-1 overflow-y-auto p-3", panel === "ticket" && "hidden sm:block")}>
          <div className="mb-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar platillo…"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCategoryId(null)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold",
                !categoryId ? "bg-pink-600 text-white" : "bg-white/5 text-gray-300",
              )}
            >
              Todo
            </button>
            {(categories.data ?? []).map((c: any) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold",
                  categoryId === c.id ? "bg-pink-600 text-white" : "bg-white/5 text-gray-300",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {filtered.map((item: any) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10 active:scale-[0.98]"
              >
                <p className="m-0 line-clamp-2 text-sm font-bold">{item.name}</p>
                <p className="m-0 mt-1 text-sm font-black text-pink-400">{money(item.price)}</p>
                {item.description && <p className="m-0 mt-0.5 line-clamp-1 text-[10px] text-gray-500">{item.description}</p>}
              </button>
            ))}
          </div>
        </div>

        {/* Ticket / tanda */}
        <aside
          className={cn(
            "w-full shrink-0 border-l border-white/10 bg-black/40 p-3 sm:w-80",
            panel === "menu" && "hidden sm:block",
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="m-0 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
              <UtensilsCrossed className="h-3.5 w-3.5" /> Tanda
            </h2>
            <button onClick={() => setPanel(panel === "ticket" ? "menu" : "ticket")} className="text-xs font-bold text-gray-400 sm:hidden">
              {panel === "ticket" ? "Menú" : "Ticket"}
            </button>
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {(currentOrder?.items ?? []).map((it: any) => (
              <div key={it.id} className="rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="m-0 text-sm font-bold">
                    {it.quantity}× {it.name}
                  </p>
                  <span className="shrink-0 text-xs font-mono text-gray-300">{money(it.totalPrice)}</span>
                </div>
                {it.guestName && <p className="m-0 text-[10px] font-bold text-cyan-300">Para {it.guestName}</p>}
                {it.allergies && <p className="m-0 text-[10px] font-bold text-red-300">⚠ {it.allergies}</p>}
                {it.notes && <p className="m-0 text-[10px] text-yellow-300/80">Nota: {it.notes}</p>}
                <p className="m-0 mt-0.5 text-[9px] uppercase tracking-wider text-gray-500">
                  {it.sentToStationAt ? "Enviado a cocina" : "En captura"}
                </p>
              </div>
            ))}
            {(currentOrder?.items ?? []).length === 0 && (
              <p className="py-6 text-center text-xs text-gray-500">Toca un platillo para agregarlo.</p>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-xs text-gray-400">Total (sin propina)</span>
            <span className="text-lg font-black text-pink-400">{money(total)}</span>
          </div>

          <button
            onClick={() => sendRound.mutate({ orderId: currentOrder!.id })}
            disabled={!currentOrder || unsent.length === 0 || sendRound.isPending}
            className={cn(
              "mt-3 w-full rounded-xl py-3 text-sm font-black",
              unsent.length > 0 ? "bg-emerald-500 text-gray-950" : "bg-white/5 text-gray-500",
            )}
          >
            Enviar a cocina {unsent.length > 0 ? `(${unsent.length})` : ""}
          </button>

          <button
            onClick={() => requestBill.mutate({ orderId: currentOrder!.id })}
            disabled={!currentOrder || requestBill.isPending || Boolean(currentOrder?.billRequestedAt)}
            className={cn(
              "mt-2 w-full rounded-xl py-2.5 text-xs font-black",
              currentOrder?.billRequestedAt
                ? "bg-pink-500/15 text-pink-300"
                : "bg-white/10 text-white hover:bg-white/15",
            )}
          >
            {currentOrder?.billRequestedAt ? "Cuenta pedida ✓" : "Pedir la cuenta"}
          </button>
          <p className="m-0 mt-2 text-center text-[10px] leading-snug text-gray-500">
            La cuenta se cobra en caja. Aquí solo se levanta el pedido.
          </p>
        </aside>
      </div>

      {selectedItem && currentOrder && (
        <ItemSheet
          item={selectedItem}
          orderId={currentOrder.id}
          onClose={() => setSelectedItem(null)}
          onAdded={() => {
            setSelectedItem(null);
            refreshQueue();
            void utils.pos.getOrders.invalidate();
            void board.refetch();
          }}
          onOfflineAdd={(payload) => {
            queueAdd(payload);
            refreshQueue();
            toast.info("Sin conexión: guardado en el equipo. Se envía al volver la red.");
            setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Hoja del platillo ───────────────────────────── */

function ItemSheet({
  item,
  orderId,
  onClose,
  onAdded,
  onOfflineAdd,
}: {
  item: any;
  orderId: string;
  onClose: () => void;
  onAdded: () => void;
  onOfflineAdd: (payload: {
    orderId: string;
    menuItemId: string;
    quantity: number;
    modifiers: { id: string; name: string }[];
    notes?: string;
    allergies?: string;
    guestName?: string;
  }) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [guestName, setGuestName] = useState("");
  const [allergens, setAllergens] = useState<string[]>([]);
  const [allergyNote, setAllergyNote] = useState("");
  const [selectedMods, setSelectedMods] = useState<string[]>([]);

  const modifiers = trpc.pos.getModifiers.useQuery({ itemId: item.id });
  const add = trpc.pos.addToCart.useMutation({
    onSuccess: () => {
      toast.success(`${quantity}× ${item.name}`);
      onAdded();
    },
    onError: (e) => toast.error(e.message),
  });

  const mods = modifiers.data ?? [];
  const extras = mods.reduce(
    (sum: number, m: any) => (selectedMods.includes(m.id) ? sum + Number(m.priceAdjust || 0) : sum),
    0,
  );
  const lineTotal = (Number(item.price) + extras) * quantity;
  const allergyText = [...allergens, allergyNote.trim()].filter(Boolean).join(", ");

  const submit = () => {
    const payload = {
      orderId,
      menuItemId: item.id,
      quantity,
      modifiers: mods
        .filter((m: any) => selectedMods.includes(m.id))
        .map((m: any) => ({ id: m.id, name: m.name })),
      notes: notes.trim() || undefined,
      allergies: allergyText || undefined,
      guestName: guestName.trim() || undefined,
    };

    // Sin red: no se intenta; se guarda para reenviar.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      onOfflineAdd(payload);
      return;
    }

    add.mutate({ ...payload, hold: true }, {
      onError: (e) => {
        // Si es de red, se guarda; si es de negocio, se muestra.
        if (!(e as { data?: { code?: string } }).data?.code) {
          onOfflineAdd(payload);
        }
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#101013] p-4 sm:rounded-3xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="m-0 text-lg font-black">{item.name}</h3>
            <p className="m-0 text-sm font-bold text-pink-400">{money(item.price)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cantidad */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-2">
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="rounded-xl bg-white/10 p-2">
            <Minus className="h-4 w-4" />
          </button>
          <span className="text-xl font-black">{quantity}</span>
          <button onClick={() => setQuantity((q) => q + 1)} className="rounded-xl bg-white/10 p-2">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Extras */}
        {mods.length > 0 && (
          <div className="mb-4">
            <p className="m-0 mb-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400">Extras</p>
            <div className="space-y-1.5">
              {mods.map((m: any) => {
                const on = selectedMods.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() =>
                      setSelectedMods((prev) =>
                        on
                          ? prev.filter((x) => x !== m.id)
                          : m.maxSelect === 1
                          ? [...prev.filter((x) => !mods.find((o: any) => o.id === x && o.type === "SELECT")), m.id]
                          : [...prev, m.id],
                      )
                    }
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm",
                      on ? "border-pink-500/60 bg-pink-500/15" : "border-white/10 bg-white/5",
                    )}
                  >
                    <span>{on ? "☑" : "☐"} {m.name}</span>
                    <span className="text-xs text-gray-400">
                      {Number(m.priceAdjust) > 0 ? `+${money(m.priceAdjust)}` : "incluido"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Alergias */}
        <div className="mb-3">
          <p className="m-0 mb-1.5 text-[10px] font-black uppercase tracking-wider text-red-300">Alergias</p>
          <div className="flex flex-wrap gap-1.5">
            {ALLERGENS.map((a) => {
              const on = allergens.includes(a);
              return (
                <button
                  key={a}
                  onClick={() =>
                    setAllergens((prev) => (on ? prev.filter((x) => x !== a) : [...prev, a]))
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-bold",
                    on ? "border-red-400/60 bg-red-500/20 text-red-200" : "border-white/10 bg-white/5 text-gray-400",
                  )}
                >
                  {a}
                </button>
              );
            })}
          </div>
          <input
            value={allergyNote}
            onChange={(e) => setAllergyNote(e.target.value)}
            placeholder="Otra alergia (texto libre)…"
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          />
        </div>

        <div className="mb-3 grid gap-2">
          <Input
            label="Para quién es (nombre)"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Luis, la señora del fondo…"
          />
          <Input
            label="Nota para cocina"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Sin cebolla, término medio…"
          />
        </div>

        <button
          onClick={submit}
          disabled={add.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-600 py-3.5 text-sm font-black hover:bg-pink-700 disabled:opacity-50"
        >
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChefHat className="h-4 w-4" />}
          Agregar · {money(lineTotal)}
        </button>
      </div>
    </div>
  );
}
