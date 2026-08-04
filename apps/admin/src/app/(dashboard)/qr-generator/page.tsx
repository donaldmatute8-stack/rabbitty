"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "../../../lib/trpc-client";
import { QrCode, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "@rabbitty/ui";

export default function QRGeneratorPage() {
  const { data: tables } = trpc.pos.getTables.useQuery();
  const { mutate: generateQR, isPending } = trpc.pos.generateQR.useMutation({
    onSuccess: () => toast.success("QR generado"),
    onError: (e) => toast.error(e.message),
  });

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const { data: qrData } = trpc.pos.getTableQR.useQuery(selectedTable ? { tableId: selectedTable } : skipToken);

  const handleGenerate = (tableId: string) => {
      generateQR({ tableId });
  };

  return (
    <div className="flex h-screen flex-col bg-black">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header Banner */}
          <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
            <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400">Códigos QR de Mesa</h1>
            <p className="text-sm font-medium text-gray-400 mt-1">Genera códigos QR únicos por mesa para auto-pedido y pago</p>
          </div>

          {tables?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl">
              <AlertTriangle className="mb-4 h-16 w-16 text-pink-500/30" />
              <p className="text-lg font-bold text-white">No hay mesas registradas</p>
              <p className="mt-1 text-sm text-gray-400">Agrega mesas desde el menú de Mesas & Disposición</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
                <h3 className="mb-4 text-lg font-bold text-white">Mesas Disponibles</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {tables?.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => setSelectedTable(table.id)}
                      className={`flex flex-col items-center justify-center rounded-2xl border p-4 transition-all ${
                        selectedTable === table.id
                          ? "border-pink-500 bg-pink-500/10 text-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.2)]"
                          : "border-white/5 bg-white/5 text-gray-400 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      <span className="text-3xl font-bold">{table.number}</span>
                      <span className="mt-2 text-xs font-medium">
                        {table.capacity} personas
                      </span>
                      {qrData && qrData.qrCode && (
                        <CheckCircle className="mt-2 h-5 w-5 text-green-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {selectedTable && qrData && (
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <QrCode className="h-5 w-5 text-pink-600" />
                    QR Generado
                  </h3>

                  <div className="flex flex-col items-center gap-4">
                    <div className="rounded-xl bg-white p-4 shadow-lg">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData.qrCode || "")}`}
                        alt="QR Code"
                        className="mx-auto"
                      />
                    </div>
                    <div className="w-full max-w-md rounded-lg bg-gray-50 p-4">
                      <p className="text-xs text-gray-500 mb-1">URL del QR:</p>
                      <code className="block break-all text-sm text-gray-700 font-mono">
                        {qrData.qrCode}
                      </code>
                      <p className="mt-2 text-xs text-pink-600">
                        Escanea con la miniapp de Rabbitty para identificar la mesa
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGenerate(selectedTable)}
                        disabled={isPending}
                        className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
                        Generar Nuevo QR
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
