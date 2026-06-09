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
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">FastAPI Webhook Bridge</h2>
          <p className="text-sm text-gray-500">
            Configura la sincronización con FastAPI para transacciones Core
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Status Card */}
          <div className={`rounded-2xl border p-6 ${config?.isActive ? "border-green-200 bg-green-50/30" : "border-yellow-200 bg-yellow-50/30"}`}>
            <div className="flex items-center gap-3 mb-4">
              {config?.isActive ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {config?.isActive ? "FastAPI Webhook Activo" : "FastAPI Webhook Desactivado"}
                </h3>
                <p className="text-sm text-gray-500">
                  {config?.isActive 
                    ? " webhook configurado y activo para sincronizar transacciones" 
                    : "no se ha configurado un endpoint FastAPI"}
                </p>
              </div>
            </div>

            {config?.isActive && config.url && (
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">URL Configurada:</p>
                <code className="block rounded bg-gray-100 p-2 text-sm text-gray-700">
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
