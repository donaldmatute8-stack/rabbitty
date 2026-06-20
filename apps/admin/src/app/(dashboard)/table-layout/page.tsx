"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Map as MapIcon, Plus, Trash2, Save, GripHorizontal } from "lucide-react";
import { Card, toast } from "@rabbitty/ui";

interface TableLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  capacity: number;
  number: number;
}

export default function TableLayoutEditorPage() {
  const { data: dbTables, isLoading, refetch } = trpc.tableLayout.getLayout.useQuery();
  const { mutate: saveLayout } = trpc.tableLayout.saveLayout.useMutation({
    onSuccess: () => { toast.success("Diseño guardado"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const [tables, setTables] = useState<TableLayout[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (dbTables) {
      setTables(dbTables.map(t => {
        let coords = { x: 50, y: 50, width: 80, height: 60 };
        if (t.location) {
          try { coords = { ...coords, ...JSON.parse(t.location) }; } catch {}
        }
        return { id: t.id, ...coords, capacity: t.capacity, number: t.number ?? 0 };
      }));
    }
  }, [dbTables]);

  const handleAddTable = useCallback(() => {
    const newTable: TableLayout = {
      id: `new_${Date.now()}`,
      x: 50 + Math.random() * 100,
      y: 50 + Math.random() * 100,
      width: 80,
      height: 60,
      capacity: 4,
      number: tables.length + 1,
    };
    setTables(prev => [...prev, newTable]);
    toast.success("Mesa agregada (guardar para persistir)");
  }, [tables.length]);

  const handleUpdateTable = useCallback((id: string, updates: Partial<TableLayout>) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const handleDeleteTable = useCallback((id: string) => {
    setTables(prev => prev.filter(t => t.id !== id));
    setSelectedTable(prev => prev === id ? null : prev);
    setEditingTable(prev => prev === id ? null : prev);
    toast.success("Mesa eliminada (guardar para persistir)");
  }, []);

  const handleSave = useCallback(() => {
    const existing = tables.filter(t => !t.id.startsWith("new_"));
    saveLayout(existing.map(t => ({
      id: t.id, x: t.x, y: t.y, width: t.width, height: t.height, capacity: t.capacity,
    })));
  }, [tables, saveLayout]);

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    const table = tables.find(t => t.id === id);
    if (!table) return;
    const rect = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left - table.x, y: e.clientY - rect.top - table.y });
    setSelectedTable(id);
  }, [tables]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragOffset || !selectedTable) return;
    const canvas = (e.currentTarget as HTMLElement).getBoundingClientRect();
    handleUpdateTable(selectedTable, {
      x: Math.max(0, e.clientX - canvas.left - dragOffset.x),
      y: Math.max(0, e.clientY - canvas.top - dragOffset.y),
    });
  }, [dragOffset, selectedTable, handleUpdateTable]);

  const handleMouseUp = useCallback(() => {
    setDragOffset(null);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-black via-zinc-950 to-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-black via-zinc-950 to-black">
      <div className="border-b border-white/10 bg-white/5 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Editor de Mesas</h2>
            <p className="text-sm text-gray-400">Arrastra las mesas para diseñar tu restaurante</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddTable} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-all">
              <Plus className="h-4 w-4" /> Agregar Mesa
            </button>
            <button onClick={handleSave} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-pink-700 px-4 py-2 text-sm font-semibold text-white hover:from-pink-500 hover:to-pink-600 transition-all">
              <Save className="h-4 w-4" /> Guardar
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 p-6 overflow-auto relative" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
          <div className="relative mx-auto h-full min-h-[500px] w-full max-w-5xl rounded-2xl border border-white/10 bg-white/5 p-8">
            <div className="absolute left-4 top-4 text-xs font-semibold text-gray-500">Restaurante</div>
            {tables.map((table) => (
              <div
                key={table.id}
                onMouseDown={(e) => handleMouseDown(e, table.id)}
                style={{
                  position: "absolute",
                  left: `${table.x}px`,
                  top: `${table.y}px`,
                  width: `${table.width}px`,
                  height: `${table.height}px`,
                }}
                className={`group cursor-grab rounded-xl border-2 transition-all hover:shadow-lg hover:shadow-pink-500/10 ${
                  selectedTable === table.id
                    ? "border-pink-500 bg-pink-500/10 shadow-lg"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                } ${dragOffset ? "cursor-grabbing" : ""}`}
              >
                <div className="flex h-full flex-col items-center justify-center">
                  <GripHorizontal className="mb-1 h-3 w-3 text-gray-600" />
                  <span className="text-2xl font-black text-white">{table.number}</span>
                  <span className="text-xs font-semibold text-gray-400">{table.capacity} pers.</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-80 border-l border-white/10 bg-white/5 p-6 backdrop-blur-md">
          {editingTable ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Editar Mesa</h3>
                <button onClick={() => setEditingTable(null)} className="text-gray-400 hover:text-white transition-colors">
                  ✕
                </button>
              </div>
              {(() => {
                const table = tables.find(t => t.id === editingTable);
                if (!table) return null;
                return (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-400 mb-1">Número</label>
                      <input type="number" value={table.number} onChange={(e) => handleUpdateTable(table.id, { number: parseInt(e.target.value) || 1 })}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-pink-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-400 mb-1">Capacidad</label>
                      <input type="number" min={1} max={20} value={table.capacity} onChange={(e) => handleUpdateTable(table.id, { capacity: parseInt(e.target.value) || 4 })}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-pink-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-400 mb-1">X</label>
                      <input type="number" value={table.x} onChange={(e) => handleUpdateTable(table.id, { x: parseInt(e.target.value) || 0 })}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-pink-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-400 mb-1">Y</label>
                      <input type="number" value={table.y} onChange={(e) => handleUpdateTable(table.id, { y: parseInt(e.target.value) || 0 })}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-pink-500 focus:outline-none" />
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div>
              <div className="mb-6 flex items-center gap-3">
                <MapIcon className="h-6 w-6 text-gray-400" />
                <span className="text-sm font-semibold text-gray-400">{tables.length} mesas</span>
              </div>
              <div className="space-y-2">
                {tables.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">No hay mesas. Agrega una.</p>
                ) : (
                  tables.map((table) => (
                    <div key={table.id} onClick={() => setEditingTable(table.id)}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 hover:bg-white/10 transition-all cursor-pointer">
                      <div>
                        <div className="text-sm font-bold text-white">Mesa {table.number}</div>
                        <div className="text-xs text-gray-500">{table.capacity} pers. · ({table.x},{table.y})</div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-all">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
