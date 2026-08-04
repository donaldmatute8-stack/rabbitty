"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { AlertTriangle, CheckCircle, RefreshCw, Settings } from "lucide-react";
import { toast } from "@rabbitty/ui";

export default function FastApiSettingsPage() {
  const { data: config } = trpc.fastapi.getConfig.useQuery();
  const { mutate: configure, isPending } = trpc.fastapi.configure.useMutation({
    onSuccess: () => toast.success("FastAPI configurado"),
    onError: (err) => toast.error(err.message),
  });
   const { data: configData } = trpc.fastapi.testConnection.useQuery();
   const { mutate: saveConfig, isPending: testing } = trpc.fastapi.configure.useMutation({
     onSuccess: () => toast.success("Configuración guardada"),
     onError: (err) => toast.error(err.message),
   });

   const [url, setUrl] = useState(config?.url || "");
   const [apiKey, setApiKey] = useState(config?.apiKey || "");

   const handleSave = () => {
     configure({ url, apiKey });
   };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Header Banner */}
          <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
            <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400">FastAPI Webhook Bridge</h1>
            <p className="text-sm font-medium text-gray-400 mt-1">Configura la sincronización con FastAPI para transacciones Core</p>
          </div>

          {/* Status Card */}
          <div className={`rounded-3xl border p-6 backdrop-blur-xl ${config?.isActive ? "border-emerald-500/20 bg-emerald-500/10" : "border-amber-500/20 bg-amber-500/10"}`}>
            <div className="flex items-center gap-3 mb-4">
              {config?.isActive ? (
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-amber-400" />
              )}
              <div>
                <h3 className="text-lg font-bold text-white">
                  {config?.isActive ? "FastAPI Webhook Activo" : "FastAPI Webhook Pendiente"}
                </h3>
                <p className="text-sm text-gray-400">
                  {config?.isActive 
                    ? "Webhook configurado y activo para sincronizar transacciones" 
                    : "No se ha configurado un endpoint FastAPI todavía"}
                </p>
              </div>
            </div>

            {config?.isActive && config.url && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl">
                <p className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">URL Configurada:</p>
                <code className="block rounded-xl bg-black/40 p-3 text-sm text-emerald-400 font-mono">
                  {config.url}
                </code>
              </div>
            )}
          </div>

          {/* Quick Actions */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <button
               onClick={() => saveConfig({ url, apiKey })}
               disabled={testing || !config?.url}
               className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-pink-300"
             >
              <RefreshCw className={`h-5 w-5 ${testing ? "animate-spin" : ""}`} />
              <div className="text-left">
                <p className="font-semibold text-gray-900">Probar Conexión</p>
                <p className="text-xs text-gray-500">Verifica conectividad con FastAPI</p>
              </div>
            </button>

            <button
              onClick={() => setUrl("")}
              disabled={!config}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
            >
              <Settings className="h-5 w-5 text-gray-500" />
              <div className="text-left">
                <p className="font-semibold text-gray-900">Reconfigurar</p>
                <p className="text-xs text-gray-500">Cambiar endpoint FastAPI</p>
              </div>
            </button>
          </div>

          {/* Configuration Form */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Settings className="h-5 w-5 text-pink-600" />
              Configuración del Webhook
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL del FastAPI
                </label>
                <input
                  type="url"
                  placeholder="https://api.tu-empresa.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-pink-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">
                  URL base de tu FastAPI (ej: https://api.rabbitty.com)
                </p>
              </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                   API Key
                 </label>
                 <input
                   type="text"
                   placeholder="Ingresa tu API key"
                   value={apiKey}
                   onChange={(e) => setApiKey(e.target.value)}
                   disabled={isPending || (!url && !apiKey)}
                   className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-pink-500 focus:outline-none"
                 />
                 <p className="mt-1 text-xs text-gray-400">
                   API key para autenticación con FastAPI
                 </p>
               </div>
             </div>

             <button
               type="button"
               onClick={handleSave}
               disabled={isPending || !url}
               className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-3 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50"
             >
               {isPending ? "Guardando..." : "Guardar Configuración"}
             </button>
          </div>

          {/* Sync History */}
          <p className="text-xs text-gray-400">Configuración de FastAPI guardada</p>
        </div>
      </div>
    </div>
  );
}
