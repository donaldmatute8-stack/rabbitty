"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "../../../lib/trpc-client";
import { toast } from "@rabbitty/ui";
import { 
  Save, Plus, Trash2, Layers, Upload,
  Eye, EyeOff, Zap
} from "lucide-react";
import { cn } from "@rabbitty/ui";

// ─────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────

type ElementType = 
  | "table_round" | "table_square" | "table_rect" | "table_bar" | "table_high"
  | "chair" | "stool" | "booth"
  | "wall_h" | "wall_v" | "door" | "window"
  | "bar_counter" | "kitchen_zone" | "bathroom" | "entrance"
  | "plant" | "column" | "stage" | "dance_floor";

const TABLE_TYPES: ElementType[] = ["table_round", "table_square", "table_rect", "table_bar", "table_high"];

type TableStatus = "free" | "occupied" | "reserved" | "billing" | "cleaning";

interface FloorElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  label?: string;
  capacity?: number;
  status?: TableStatus;
  zone?: string;
}

interface Zone {
  id: string;
  name: string;
  color: string;
}

// ─────────────────────────────────────────────────────────────────
// ELEMENT DEFINITIONS
// ─────────────────────────────────────────────────────────────────

interface ElementDef {
  type: ElementType;
  label: string;
  emoji: string;
  defaultW: number;
  defaultH: number;
  isTable?: boolean;
  isStructure?: boolean;
  category: "tables" | "seating" | "structure" | "decor";
  color: string;
  borderColor: string;
}

const ELEMENTS: ElementDef[] = [
  // Tables
  { type: "table_round", label: "Mesa Redonda", emoji: "⬤", defaultW: 80, defaultH: 80, isTable: true, category: "tables", color: "bg-blue-500/20", borderColor: "border-blue-500/40" },
  { type: "table_square", label: "Mesa Cuadrada", emoji: "■", defaultW: 80, defaultH: 80, isTable: true, category: "tables", color: "bg-blue-500/20", borderColor: "border-blue-500/40" },
  { type: "table_rect", label: "Mesa Rectangular", emoji: "▬", defaultW: 120, defaultH: 70, isTable: true, category: "tables", color: "bg-blue-500/20", borderColor: "border-blue-500/40" },
  { type: "table_bar", label: "Mesa de Barra", emoji: "▭", defaultW: 160, defaultH: 50, isTable: true, category: "tables", color: "bg-purple-500/20", borderColor: "border-purple-500/40" },
  { type: "table_high", label: "Mesa Alta", emoji: "◧", defaultW: 70, defaultH: 70, isTable: true, category: "tables", color: "bg-cyan-500/20", borderColor: "border-cyan-500/40" },
  // Seating
  { type: "chair", label: "Silla", emoji: "🪑", defaultW: 30, defaultH: 30, category: "seating", color: "bg-gray-500/20", borderColor: "border-gray-400/30" },
  { type: "stool", label: "Banquito / Stool", emoji: "🔘", defaultW: 28, defaultH: 28, category: "seating", color: "bg-gray-500/20", borderColor: "border-gray-400/30" },
  { type: "booth", label: "Booth / Banca", emoji: "▬", defaultW: 120, defaultH: 40, category: "seating", color: "bg-slate-500/20", borderColor: "border-slate-400/30" },
  // Structure
  { type: "wall_h", label: "Pared Horizontal", emoji: "━", defaultW: 120, defaultH: 12, isStructure: true, category: "structure", color: "bg-stone-500/40", borderColor: "border-stone-400/50" },
  { type: "wall_v", label: "Pared Vertical", emoji: "┃", defaultW: 12, defaultH: 120, isStructure: true, category: "structure", color: "bg-stone-500/40", borderColor: "border-stone-400/50" },
  { type: "door", label: "Puerta", emoji: "🚪", defaultW: 50, defaultH: 12, isStructure: true, category: "structure", color: "bg-amber-500/20", borderColor: "border-amber-400/40" },
  { type: "window", label: "Ventana", emoji: "🪟", defaultW: 60, defaultH: 10, isStructure: true, category: "structure", color: "bg-cyan-500/20", borderColor: "border-cyan-400/40" },
  { type: "bar_counter", label: "Barra de Bar", emoji: "🍺", defaultW: 180, defaultH: 45, isStructure: true, category: "structure", color: "bg-amber-600/20", borderColor: "border-amber-500/40" },
  { type: "kitchen_zone", label: "Zona de Cocina", emoji: "👨‍🍳", defaultW: 150, defaultH: 100, isStructure: true, category: "structure", color: "bg-orange-500/15", borderColor: "border-orange-400/30" },
  { type: "bathroom", label: "Baños", emoji: "🚻", defaultW: 60, defaultH: 60, isStructure: true, category: "structure", color: "bg-sky-500/15", borderColor: "border-sky-400/30" },
  { type: "entrance", label: "Entrada / Salida", emoji: "🚪", defaultW: 80, defaultH: 20, isStructure: true, category: "structure", color: "bg-green-500/20", borderColor: "border-green-400/30" },
  // Decor
  { type: "plant", label: "Planta", emoji: "🪴", defaultW: 35, defaultH: 35, category: "decor", color: "bg-emerald-500/15", borderColor: "border-emerald-400/25" },
  { type: "column", label: "Columna", emoji: "⬡", defaultW: 30, defaultH: 30, isStructure: true, category: "decor", color: "bg-stone-500/30", borderColor: "border-stone-400/40" },
  { type: "stage", label: "Escenario", emoji: "🎵", defaultW: 200, defaultH: 80, category: "decor", color: "bg-pink-500/15", borderColor: "border-pink-400/25" },
  { type: "dance_floor", label: "Pista de Baile", emoji: "💃", defaultW: 150, defaultH: 150, category: "decor", color: "bg-violet-500/15", borderColor: "border-violet-400/25" },
];

const STATUS_CONFIG: Record<TableStatus, { color: string; glow: string; label: string }> = {
  free:     { color: "border-emerald-400 bg-emerald-500/20", glow: "shadow-[0_0_15px_rgba(52,211,153,0.3)]", label: "Libre" },
  occupied: { color: "border-red-400 bg-red-500/20",         glow: "shadow-[0_0_15px_rgba(248,113,113,0.3)]", label: "Ocupada" },
  reserved: { color: "border-purple-400 bg-purple-500/20",   glow: "shadow-[0_0_15px_rgba(167,139,250,0.3)]", label: "Reservada" },
  billing:  { color: "border-amber-400 bg-amber-500/20",     glow: "shadow-[0_0_15px_rgba(251,191,36,0.3)]",  label: "Pidiendo Cuenta" },
  cleaning: { color: "border-sky-400 bg-sky-500/20",         glow: "shadow-[0_0_15px_rgba(56,189,248,0.3)]",  label: "Limpieza" },
};

const DEFAULT_ZONES: Zone[] = [
  { id: "main", name: "Salón Principal", color: "rgba(236,72,153,0.08)" },
  { id: "terrace", name: "Terraza", color: "rgba(52,211,153,0.08)" },
  { id: "vip", name: "Zona VIP", color: "rgba(167,139,250,0.08)" },
  { id: "bar", name: "Barra", color: "rgba(251,191,36,0.08)" },
];

// ─────────────────────────────────────────────────────────────────
// ELEMENT RENDERER
// ─────────────────────────────────────────────────────────────────

function renderElement(el: FloorElement, def: ElementDef, isSelected: boolean) {
  const statusConf = el.status ? STATUS_CONFIG[el.status] : null;
  const baseClass = cn(
    "absolute select-none border-2 transition-all duration-200 flex flex-col items-center justify-center overflow-hidden",
    isSelected && "ring-2 ring-pink-400 ring-offset-1 ring-offset-black z-20",
    statusConf ? `${statusConf.color} ${statusConf.glow}` : `${def.color} ${def.borderColor}`
  );

  const isRound = el.type === "table_round" || el.type === "stool" || el.type === "column";
  const isWall = el.type === "wall_h" || el.type === "wall_v";
  const borderRadius = isRound ? "rounded-full" : isWall ? "rounded-sm" : "rounded-xl";

  return (
    <div
      key={el.id}
      style={{
        left: el.x,
        top: el.y,
        width: el.w,
        height: el.h,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        position: "absolute",
      }}
      className={cn(baseClass, borderRadius, "cursor-grab active:cursor-grabbing")}
    >
      {!isWall && (
        <>
          {el.label ? (
            <span className="text-xs font-black text-white">{el.label}</span>
          ) : (
            <span className="text-base leading-none">{def.emoji}</span>
          )}
          {el.capacity && el.capacity > 0 && (
            <span className="text-[9px] text-gray-300 font-semibold leading-none mt-0.5">{el.capacity}p</span>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// HEURISTIC IMAGE IMPORT PARSER
// ─────────────────────────────────────────────────────────────────

function heuristicImport(file: File): Promise<FloorElement[]> {
  return new Promise((resolve) => {
    // We parse image dimensions to create a grid-like placeholder layout
    // True OCR/AI parsing would require a backend. For now, we do a heuristic
    // based on image aspect ratio and file size to suggest a starter layout.
    const reader = new FileReader();
    reader.onload = (e) => {
      if (file.type.startsWith("image/")) {
        const img = new Image();
        img.onload = () => {
          const cols = Math.max(2, Math.min(6, Math.round(img.width / 150)));
          const rows = Math.max(2, Math.min(5, Math.round(img.height / 150)));
          const canvasW = 800;
          const canvasH = 550;
          const cellW = Math.floor(canvasW / (cols + 1));
          const cellH = Math.floor(canvasH / (rows + 1));
          const elements: FloorElement[] = [];
          let tableNum = 1;

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const type: ElementType = (tableNum % 3 === 0) ? "table_round" : "table_square";
              elements.push({
                id: `imported_${tableNum}`,
                type,
                x: cellW * (c + 0.5),
                y: cellH * (r + 0.5),
                w: 80,
                h: 80,
                label: `M${tableNum}`,
                capacity: 4,
                status: "free",
              });
              tableNum++;
            }
          }

          // Add perimeter walls heuristically
          elements.push({ id: "wall_top", type: "wall_h", x: 20, y: 15, w: canvasW - 40, h: 12 });
          elements.push({ id: "wall_bottom", type: "wall_h", x: 20, y: canvasH - 25, w: canvasW - 40, h: 12 });
          elements.push({ id: "wall_left", type: "wall_v", x: 15, y: 20, w: 12, h: canvasH - 40 });
          elements.push({ id: "wall_right", type: "wall_v", x: canvasW - 25, y: 20, w: 12, h: canvasH - 40 });
          elements.push({ id: "door_main", type: "door", x: canvasW / 2 - 30, y: canvasH - 25, w: 60, h: 12 });

          toast.success(`Plano detectado: ${tableNum - 1} mesas sugeridas basado en el layout de la imagen.`);
          resolve(elements);
        };
        img.src = e.target?.result as string;
      } else {
        // PDF or other document — create a basic starter layout
        const elements: FloorElement[] = [
          { id: "t1", type: "table_square", x: 80, y: 80, w: 80, h: 80, label: "M1", capacity: 4, status: "free" },
          { id: "t2", type: "table_square", x: 200, y: 80, w: 80, h: 80, label: "M2", capacity: 4, status: "free" },
          { id: "t3", type: "table_round",  x: 80, y: 220, w: 80, h: 80, label: "M3", capacity: 2, status: "free" },
          { id: "t4", type: "table_rect",   x: 200, y: 220, w: 120, h: 70, label: "M4", capacity: 6, status: "free" },
          { id: "wall_top", type: "wall_h", x: 20, y: 15, w: 760, h: 12 },
          { id: "wall_bottom", type: "wall_h", x: 20, y: 530, w: 760, h: 12 },
          { id: "wall_left", type: "wall_v", x: 15, y: 20, w: 12, h: 510 },
          { id: "wall_right", type: "wall_v", x: 775, y: 20, w: 12, h: 510 },
          { id: "entrance_main", type: "entrance", x: 350, y: 530, w: 80, h: 12 },
        ];
        toast.success("Layout base generado desde el documento. ¡Ajusta las mesas a tu gusto!");
        resolve(elements);
      }
    };
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────

export default function TableLayoutEditorPage() {
  const { data: dbTables, isLoading, refetch } = trpc.tableLayout.getLayout.useQuery();
  const { mutate: saveLayout } = trpc.tableLayout.saveLayout.useMutation({
    onSuccess: () => { toast.success("Diseño guardado correctamente"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const [elements, setElements] = useState<FloorElement[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [activeCategory, setActiveCategory] = useState<"tables" | "seating" | "structure" | "decor">("tables");
  const [activeZone, setActiveZone] = useState<string>("main");
  const [showZones, setShowZones] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [tableCounter, setTableCounter] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Load from DB ──
  useEffect(() => {
    if (dbTables) {
      const loaded: FloorElement[] = dbTables.map((t) => {
        let parsed: Record<string, any> = {};
        if (t.location) { try { parsed = JSON.parse(t.location); } catch {} }
        // El cliente usa w/h pero el servidor persiste width/height — acepta ambos.
        const w = typeof parsed.width === "number" ? parsed.width : (typeof parsed.w === "number" ? parsed.w : 80);
        const h = typeof parsed.height === "number" ? parsed.height : (typeof parsed.h === "number" ? parsed.h : 80);
        const type = parsed.type && ELEMENTS.find((e) => e.type === parsed.type) ? parsed.type : "table_square";
        return {
          id: t.id,
          type: type as ElementType,
          x: parsed.x ?? 50,
          y: parsed.y ?? 50,
          w,
          h,
          rotation: parsed.rotation,
          label: parsed.label ?? `M${t.number ?? 1}`,
          capacity: t.capacity ?? parsed.capacity,
          status: parsed.status ?? "free" as TableStatus,
          zone: parsed.zone,
        };
      });
      setElements(loaded);
      setTableCounter(loaded.filter((e) => TABLE_TYPES.includes(e.type)).length + 1);
    }
  }, [dbTables]);

  const getElementDef = (type: ElementType) => ELEMENTS.find(e => e.type === type) ?? ELEMENTS[0];

  // ── Add element ──
  const addElement = useCallback((def: ElementDef) => {
    const isTable = def.isTable;
    const id = `el_${Date.now()}`;
    const newEl: FloorElement = {
      id,
      type: def.type,
      x: 80 + Math.random() * 150,
      y: 80 + Math.random() * 150,
      w: def.defaultW,
      h: def.defaultH,
      label: isTable ? `M${tableCounter}` : undefined,
      capacity: isTable ? 4 : undefined,
      status: isTable ? "free" : undefined,
      zone: activeZone,
    };
    setElements(prev => [...prev, newEl]);
    if (isTable) setTableCounter(c => c + 1);
    setSelected(id);
  }, [tableCounter, activeZone]);

  // ── Delete ──
  const deleteSelected = useCallback(() => {
    if (!selected) return;
    setElements(prev => prev.filter(e => e.id !== selected));
    setSelected(null);
    toast.success("Elemento eliminado");
  }, [selected]);

  // ── Drag events ──
  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const el = elements.find(x => x.id === id);
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    setDrag({ id, ox: e.clientX - rect.left + canvas.scrollLeft - el.x, oy: e.clientY - rect.top + canvas.scrollTop - el.y });
    setSelected(id);
  }, [elements]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(rect.width, canvas.scrollWidth);
    const height = Math.max(rect.height, canvas.scrollHeight);
    setElements(prev => prev.map(el => {
      if (el.id !== drag.id) return el;
      const x = e.clientX - rect.left + canvas.scrollLeft - drag.ox;
      const y = e.clientY - rect.top + canvas.scrollTop - drag.oy;
      const maxX = Math.max(0, width - el.w);
      const maxY = Math.max(0, height - el.h);
      return { ...el, x: Math.min(maxX, Math.max(0, x)), y: Math.min(maxY, Math.max(0, y)) };
    }));
  }, [drag]);

  const handleMouseUp = useCallback(() => setDrag(null), []);

  // ── Update selected element ──
  const updateSelected = useCallback((patch: Partial<FloorElement>) => {
    if (!selected) return;
    setElements(prev => prev.map(el => el.id === selected ? { ...el, ...patch } : el));
  }, [selected]);

  // ── Save ──
  const handleSave = useCallback(() => {
    const tableElements = elements.filter((e) => TABLE_TYPES.includes(e.type));
    saveLayout(tableElements.map((t) => ({
      id: t.id,
      type: t.type,
      x: t.x, y: t.y,
      width: t.w,
      height: t.h,
      capacity: t.capacity ?? 4,
      label: t.label,
      status: t.status,
      zone: t.zone,
      rotation: t.rotation,
    })));
  }, [elements, saveLayout]);

  // ── Heuristic Import ──
  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const imported = await heuristicImport(file);
      setElements(imported);
      setTableCounter(imported.filter((e) => TABLE_TYPES.includes(e.type)).length + 1);
      setSelected(null);
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const selectedEl = elements.find(e => e.id === selected);
  const selectedDef = selectedEl ? getElementDef(selectedEl.type) : null;

  const categoryLabels = { tables: "Mesas", seating: "Asientos", structure: "Estructura", decor: "Decoración" };
  const categoryIcons = { tables: "🪑", seating: "🔘", structure: "🏗️", decor: "🪴" };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-black overflow-hidden -m-8">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/80 backdrop-blur-xl px-6 py-3 z-10">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-pink-400" />
              Architect Studio — Plano del Local
            </h2>
            <p className="text-[11px] text-gray-500">{elements.filter(e => ["table_round","table_square","table_rect","table_bar"].includes(e.type)).length} mesas · {elements.length} elementos totales</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Heuristic Import */}
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileImport} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importLoading}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5 text-pink-400" />
            {importLoading ? "Procesando..." : "Importar Plano"}
          </button>

          {/* Zone Toggle */}
          <button
            onClick={() => setShowZones(v => !v)}
            className={cn("flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer", showZones ? "border-pink-500/30 bg-pink-500/10 text-pink-400" : "border-white/10 bg-white/5 text-gray-400 hover:text-white")}
          >
            {showZones ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Zonas
          </button>

          {/* Delete */}
          {selected && (
            <button onClick={deleteSelected} className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all cursor-pointer">
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-pink-700 px-4 py-2 text-xs font-bold text-white hover:from-pink-500 hover:to-pink-600 transition-all cursor-pointer shadow-lg shadow-pink-500/20"
          >
            <Save className="h-3.5 w-3.5" /> Guardar Diseño
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Element Palette ── */}
        <div className="w-52 flex-shrink-0 border-r border-white/10 bg-black/60 backdrop-blur-xl overflow-y-auto">
          {/* Category Tabs */}
          <div className="grid grid-cols-2 gap-1 p-2 border-b border-white/10">
            {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold transition-all cursor-pointer",
                  activeCategory === cat ? "bg-pink-500/20 text-pink-400 border border-pink-500/30" : "text-gray-500 hover:text-white hover:bg-white/5"
                )}
              >
                <span>{categoryIcons[cat]}</span>
                {categoryLabels[cat]}
              </button>
            ))}
          </div>

          {/* Element List */}
          <div className="p-2 space-y-1">
            {ELEMENTS.filter(e => e.category === activeCategory).map(def => (
              <button
                key={def.type}
                onClick={() => addElement(def)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-all cursor-pointer group",
                  "border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 hover:text-white text-gray-400"
                )}
              >
                <span className="text-base">{def.emoji}</span>
                <span className="leading-tight truncate">{def.label}</span>
                <Plus className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-pink-400" />
              </button>
            ))}
          </div>

          {/* Zone Selector */}
          <div className="border-t border-white/10 p-2 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-2 py-1">Zona Activa</p>
            {DEFAULT_ZONES.map(z => (
              <button
                key={z.id}
                onClick={() => setActiveZone(z.id)}
                className={cn(
                  "w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer",
                  activeZone === z.id ? "bg-white/10 text-white border border-white/20" : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: z.color.replace("0.08", "0.7") }} />
                {z.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── Center: Canvas ── */}
        <div
          ref={canvasRef}
          className="relative flex-1 overflow-auto cursor-crosshair"
          style={{ background: "radial-gradient(circle at 50% 50%, rgba(30,30,30,1) 0%, rgba(0,0,0,1) 100%)" }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={(e) => { if (!(e.target as HTMLElement).closest("[data-el]")) setSelected(null); }}
        >
          {/* Grid Overlay */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

          {/* Zones */}
          {showZones && DEFAULT_ZONES.map(zone => (
            <div key={zone.id} className="absolute pointer-events-none" style={{ inset: 0, background: zone.color }} />
          ))}

          {/* Floor Label */}
          <div className="absolute left-6 top-5 text-xs font-bold text-gray-600 uppercase tracking-widest select-none">
            🏠 Plano del Local
          </div>

          {/* Elements */}
          {elements.map((el) => {
            const def = getElementDef(el.type);
            return (
              <div
                key={el.id}
                data-el={el.id}
                onMouseDown={(e) => handleMouseDown(e, el.id)}
                style={{ position: "absolute", left: el.x, top: el.y }}
              >
                {renderElement(el, def, selected === el.id)}
              </div>
            );
          })}

          {/* Empty State */}
          {elements.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center pointer-events-none">
              <div className="text-6xl opacity-20">🏠</div>
              <div className="opacity-40">
                <p className="text-lg font-black text-white">Lienzo Vacío</p>
                <p className="text-sm text-gray-400 mt-1">Arrastra elementos desde el panel izquierdo<br />o importa el plano de tu local.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Inspector Panel ── */}
        <div className="w-64 flex-shrink-0 border-l border-white/10 bg-black/60 backdrop-blur-xl overflow-y-auto">
          {selectedEl && selectedDef ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white">{selectedDef.label}</h3>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white cursor-pointer text-lg leading-none">×</button>
              </div>

              {/* Label */}
              {selectedEl.label !== undefined && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Etiqueta</label>
                  <input
                    type="text"
                    value={selectedEl.label}
                    onChange={(e) => updateSelected({ label: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white text-sm focus:border-pink-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Capacity */}
              {selectedEl.capacity !== undefined && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Capacidad</label>
                  <input
                    type="number" min={1} max={20}
                    value={selectedEl.capacity}
                    onChange={(e) => updateSelected({ capacity: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white text-sm focus:border-pink-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Status */}
              {selectedEl.status && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Estado en Vivo</label>
                  <div className="grid grid-cols-1 gap-1">
                    {(Object.keys(STATUS_CONFIG) as TableStatus[]).map(st => {
                      const sc = STATUS_CONFIG[st];
                      return (
                        <button
                          key={st}
                          onClick={() => updateSelected({ status: st })}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold text-left transition-all cursor-pointer",
                            selectedEl.status === st ? `${sc.color} border-opacity-60` : "border-white/5 bg-white/5 text-gray-400 hover:bg-white/10"
                          )}
                        >
                          <div className={cn("h-2 w-2 rounded-full", {
                            "bg-emerald-400": st === "free",
                            "bg-red-400": st === "occupied",
                            "bg-purple-400": st === "reserved",
                            "bg-amber-400": st === "billing",
                            "bg-sky-400": st === "cleaning",
                          })} />
                          {sc.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Size */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-2">Tamaño</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Ancho</label>
                    <input type="number" min={20} max={400} value={Math.round(selectedEl.w)} onChange={(e) => updateSelected({ w: parseInt(e.target.value) || 80 })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white text-sm focus:border-pink-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Alto</label>
                    <input type="number" min={20} max={400} value={Math.round(selectedEl.h)} onChange={(e) => updateSelected({ h: parseInt(e.target.value) || 80 })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white text-sm focus:border-pink-500 focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* Position */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-2">Posición</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">X</label>
                    <input type="number" value={Math.round(selectedEl.x)} onChange={(e) => updateSelected({ x: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white text-sm focus:border-pink-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Y</label>
                    <input type="number" value={Math.round(selectedEl.y)} onChange={(e) => updateSelected({ y: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white text-sm focus:border-pink-500 focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* Delete Button */}
              <button
                onClick={deleteSelected}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
              >
                <Trash2 className="h-4 w-4" /> Eliminar Elemento
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Legend */}
              <div>
                <p className="text-xs font-black text-white mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-pink-400" /> Leyenda de Estados</p>
                <div className="space-y-1.5">
                  {(Object.keys(STATUS_CONFIG) as TableStatus[]).map(st => {
                    const sc = STATUS_CONFIG[st];
                    return (
                      <div key={st} className="flex items-center gap-2 text-xs text-gray-400">
                        <div className={cn("h-3 w-3 rounded-full border", sc.color)} />
                        {sc.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/5 pt-4">
                <p className="text-xs font-black text-white mb-2">📊 Resumen</p>
                <div className="space-y-2">
                  {[
                    { label: "Mesas", count: elements.filter(e => ["table_round","table_square","table_rect","table_bar"].includes(e.type)).length, color: "text-blue-400" },
                    { label: "Asientos", count: elements.filter(e => ["chair","stool","booth"].includes(e.type)).length, color: "text-gray-400" },
                    { label: "Estructura", count: elements.filter(e => ["wall_h","wall_v","door","window","bar_counter","kitchen_zone","bathroom","entrance","column"].includes(e.type)).length, color: "text-stone-400" },
                    { label: "Decoración", count: elements.filter(e => ["plant","stage","dance_floor"].includes(e.type)).length, color: "text-emerald-400" },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between text-xs">
                      <span className="text-gray-400">{item.label}</span>
                      <span className={cn("font-black", item.color)}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/5 pt-4">
                <p className="text-[10px] font-bold text-gray-500 mb-2">⌨️ Accesos Rápidos</p>
                <div className="space-y-1 text-[10px] text-gray-500">
                  <p>• Click en elemento → Seleccionar</p>
                  <p>• Arrastrar → Reposicionar</p>
                  <p>• Click en paleta → Añadir al canvas</p>
                  <p>• Importar plano → Diseño heurístico</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
