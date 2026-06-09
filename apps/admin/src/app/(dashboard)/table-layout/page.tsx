"use client";

import { useState } from "react";
import { Map as MapIcon, Plus, Trash2, Save } from "lucide-react";
import { toast } from "@rabbitty/ui";

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
  const [tables, setTables] = useState<TableLayout[]>([
    { id: "t1", x: 10, y: 10, width: 80, height: 60, capacity: 4, number: 1 },
    { id: "t2", x: 120, y: 10, width: 80, height: 60, capacity: 4, number: 2 },
    { id: "t3", x: 230, y: 10, width: 80, height: 60, capacity: 6, number: 3 },
    { id: "t4", x: 10, y: 90, width: 80, height: 60, capacity: 2, number: 4 },
    { id: "t5", x: 120, y: 90, width: 80, height: 60, capacity: 8, number: 5 },
  ]);

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [editingTable, setEditingTable] = useState<string | null>(null);

  const handleAddTable = () => {
    const newTable: TableLayout = {
      id: `t${Date.now()}`,
      x: 50 + Math.random() * 100,
      y: 50 + Math.random() * 100,
      width: 60,
      height: 40,
      capacity: 4,
      number: tables.length + 1,
    };
    setTables([...tables, newTable]);
    toast.success("Mesa agregada");
  };

  const handleUpdateTable = (id: string, updates: Partial<TableLayout>) => {
    setTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const handleDeleteTable = (id: string) => {
    setTables((prev) => prev.filter((t) => t.id !== id));
    if (selectedTable === id) setSelectedTable(null);
    if (editingTable === id) setEditingTable(null);
    toast.success("Mesa eliminada");
  };

  const handleSaveLayout = () => {
    toast.success("Diseño de mesas guardado");
  };

  const handleSelectTable = (id: string) => {
    setSelectedTable(id === selectedTable ? null : id);
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Editor de Diseño de Mesas</h2>
            <p className="text-sm text-gray-500">
              Arrastra y configura la distribución de tu restaurante
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddTable}
              className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-700"
            >
              <Plus className="h-4 w-4" />
              Agregar Mesa
            </button>
            <button
              onClick={handleSaveLayout}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              <Save className="h-4 w-4" />
              Guardar Diseño
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 bg-gray-100 p-6 overflow-auto relative">
          <div className="relative mx-auto max-w-4xl bg-white p-8 shadow-lg">
            {/* Room labels */}
            <div className="absolute top-4 left-4 text-sm font-semibold text-gray-400">
              Restaurante
            </div>

            {tables.map((table) => (
              <div
                key={table.id}
                onClick={() => handleSelectTable(table.id)}
                onDragStart={(e) => {
                  e.dataTransfer.setData("tableId", table.id);
                  e.stopPropagation();
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const tableId = e.dataTransfer.getData("tableId");
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  handleUpdateTable(tableId, { x, y });
                }}
                style={{
                  position: "absolute",
                  left: `${table.x}px`,
                  top: `${table.y}px`,
                  width: `${table.width}px`,
                  height: `${table.height}px`,
                }}
                className={`cursor-grab rounded-xl border-2 transition-all hover:shadow-lg ${
                  selectedTable === table.id
                    ? "border-pink-500 bg-pink-50/50"
                    : "border-gray-300 bg-white"
                }`}
              >
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <span className="text-3xl font-bold text-gray-900">
                    {table.number}
                  </span>
                  <span className="text-xs font-semibold text-gray-500">
                    {table.capacity} personas
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-gray-200 bg-gray-50 p-6">
          {editingTable ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Editar Mesa
                </h3>
                <button
                  onClick={() => setEditingTable(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {(() => {
                const table = tables.find((t) => t.id === editingTable);
                if (!table) return null;
                return (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Número de Mesa
                      </label>
                      <input
                        type="number"
                        value={table.number}
                        onChange={(e) =>
                          handleUpdateTable(table.id, {
                            number: parseInt(e.target.value) || 1,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-pink-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Capacidad
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={table.capacity}
                        onChange={(e) =>
                          handleUpdateTable(table.id, {
                            capacity: parseInt(e.target.value) || 4,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-pink-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Coordenada X
                      </label>
                      <input
                        type="number"
                        value={table.x}
                        onChange={(e) =>
                          handleUpdateTable(table.id, {
                            x: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-pink-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Coordenada Y
                      </label>
                      <input
                        type="number"
                        value={table.y}
                        onChange={(e) =>
                          handleUpdateTable(table.id, {
                            y: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-pink-500 focus:outline-none"
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div>
              <div className="mb-6 flex items-center gap-3">
                <MapIcon className="h-6 w-6 text-gray-400" />
                <span className="text-sm font-semibold text-gray-500">
                  {tables.length} mesas configuradas
                </span>
              </div>

              <div className="space-y-3">
                {tables.length === 0 ? (
                  <p className="text-center text-sm text-gray-400">
                    No hay mesas. Agrega una para comenzar.
                  </p>
                ) : (
                  tables.map((table) => (
                    <div
                      key={table.id}
                      onClick={() => setEditingTable(table.id)}
                      className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div>
                        <div className="text-sm font-bold text-gray-900">
                          Mesa {table.number}
                        </div>
                        <div className="text-xs text-gray-500">
                          {table.capacity} personas
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTable(table.id);
                        }}
                        className="rounded-lg p-2 text-gray-300 hover:bg-red-50 hover:text-red-500"
                      >
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
