"use client";

import { useState } from "react";
import { useFullscreen } from "../../hooks/useFullscreen";
import { Monitor, Bell, Volume2, Maximize, ChefHat } from "lucide-react";

export default function KdsSettingsPage() {
  const { isFullscreen, toggle } = useFullscreen();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrint, setAutoPrint] = useState(true);
  const [slaWarning, setSlaWarning] = useState(10);

  return (
    <div className="flex h-screen flex-col bg-[#0A0A0A]">
      <header className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-600 text-lg font-black">R</div>
        <h1 className="text-xl font-bold text-white">Configuración de Cocina</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Pantalla</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Maximize className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-200">Pantalla completa</p>
                    <p className="text-xs text-gray-500">Ocupa toda la pantalla</p>
                  </div>
                </div>
                <button
                  onClick={toggle}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${isFullscreen ? "bg-green-600/30 text-green-400" : "bg-white/10 text-gray-400"}`}
                >
                  {isFullscreen ? "Activo" : "Activar"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Sonido</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Volume2 className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-200">Sonido de nuevas órdenes</p>
                    <p className="text-xs text-gray-500">Reproduce un sonido al llegar una orden</p>
                  </div>
                </div>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${soundEnabled ? "bg-green-600/30 text-green-400" : "bg-white/10 text-gray-400"}`}
                >
                  {soundEnabled ? "Activado" : "Desactivado"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Impresión</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Monitor className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-200">Auto-impresión</p>
                    <p className="text-xs text-gray-500">Imprimir tickets automáticamente</p>
                  </div>
                </div>
                <button
                  onClick={() => setAutoPrint(!autoPrint)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${autoPrint ? "bg-green-600/30 text-green-400" : "bg-white/10 text-gray-400"}`}
                >
                  {autoPrint ? "Activado" : "Desactivado"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">SLA</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ChefHat className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-200">Tiempo máximo de preparación</p>
                    <p className="text-xs text-gray-500">Minutos antes de marcar como tardado</p>
                  </div>
                </div>
                <select
                  value={slaWarning}
                  onChange={(e) => setSlaWarning(parseInt(e.target.value))}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                >
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={20}>20 min</option>
                  <option value={30}>30 min</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
