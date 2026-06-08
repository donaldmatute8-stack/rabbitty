"use client";

import { trpc } from "../lib/trpc-client";
import { useState } from "react";
import { Map as MapIcon, Plus, X, Save } from "lucide-react";
import { toast } from "@rabbitty/ui";

interface TableMapProps {
  tableId?: string | null;
}

export function TableMap({ tableId }: TableMapProps) {
  const { data: tables } = trpc.pos.getTables.useQuery();
  
  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [tableName, setTableName] = useState("");
  const [tableCapacity, setTableCapacity] = useState(4);

  if (!tables) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6">
        <MapIcon className="mb-4 h-16 w-16 text-gray-300" />
        <p className="text-lg font-medium text-gray-500">Cargando mapa de mesas...</p>
      </div>
    );
  }

  const handleSaveTable = async () => {
    if (!editingTable) return;
    
    toast.success("Mesa actualizada");
    setEditingTable(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {tableId ? `Mesa ${tables.find((t) => t.id === tableId)?.number || "Detail"}` : "Mapa de Mesas"}
            </h2>
            <p className="text-sm text-gray-500">
              {tables.length} mesas Total
            </p>
          </div>
          {tableId && (
            <button
              onClick={handleSaveTable}
              className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-700"
            >
              <Save className="h-4 w-4" />
              Guardar
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          {tables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MapIcon className="mb-4 h-16 w-16 text-gray-300" />
              <p className="text-lg font-medium text-gray-500">No hay mesas registradas</p>
              <p className="mt-1 text-sm text-gray-400">Agrega mesas desde Configuración</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {tables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => setEditingTable(table.id)}
                   className="relative flex h-32 flex-col items-center justify-center rounded-2xl border-2 border-gray-300 bg-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="text-4xl font-bold text-gray-900">{table.number}</span>
                  <span className="mt-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-600 shadow-sm">
                    {table.capacity} personas
                  </span>
                   <div className="absolute top-3 right-3 h-3 w-3 rounded-full bg-gray-300" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Editar Mesa</h3>
              <button
                onClick={() => setEditingTable(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Número de Mesa</label>
                <input
                  type="number"
                  value={tableName || (tables.find((t) => t.id === editingTable)?.number || "")}
                  onChange={(e) => setTableName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-pink-500 focus:outline-none"
                  placeholder="Ej: 12"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Capacidad</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={tableCapacity}
                  onChange={(e) => setTableCapacity(parseInt(e.target.value) || 4)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-pink-500 focus:outline-none"
                  placeholder="Personas"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditingTable(null)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveTable}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-pink-600 py-2.5 text-sm font-semibold text-white hover:bg-pink-700"
                >
                  <Save className="h-4 w-4" />
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
