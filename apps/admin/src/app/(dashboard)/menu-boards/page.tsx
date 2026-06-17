"use client";

import { useState, useEffect } from "react";
import { Card, Button, toast } from "@rabbitty/ui";
import { Monitor, ExternalLink, Copy, Smartphone, QrCode } from "lucide-react";

export default function MenuBoardsPage() {
  const [branchId] = useState(process.env.NEXT_PUBLIC_BRANCH_ID ?? "b1");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const boardUrl = `${origin}/menu-board/${branchId}`;
  const apiUrl = `${origin}/api/menu-board/${branchId}`;

  const copyUrl = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    toast.success(`${label} copiado al portapapeles`);
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Menú Digital
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Pantallas digitales para mostrar tu menú en tiempo real</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Monitor className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Vista TV</h3>
              <p className="text-xs text-gray-400 mt-0.5">Pantalla optimizada para monitores y TVs</p>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Abre esta URL en tu TV o monitor para mostrar el menú actualizado automáticamente.
            Los cambios que hagas en el menú del admin se reflejarán al recargar la página.
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 mb-4">
            <code className="flex-1 text-xs text-gray-300 truncate">{boardUrl}</code>
            <button
              onClick={() => copyUrl(boardUrl, "URL de TV")}
              className="rounded-lg border border-white/5 bg-white/5 p-2 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <Copy className="h-4 w-4" />
            </button>
            <a
              href={boardUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/5 bg-white/5 p-2 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <Button onClick={() => window.open(boardUrl, "_blank")} className="w-full">
            <Monitor className="h-4 w-4" />
            Abrir Vista TV
          </Button>
        </Card>

        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <QrCode className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">API JSON</h3>
              <p className="text-xs text-gray-400 mt-0.5">Endpoint público para integraciones</p>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Consume el menú como JSON desde cualquier aplicación. Ideal para integraciones
            con pantallas inteligentes, kioscos o apps de terceros.
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 mb-2">
            <code className="flex-1 text-xs text-gray-300 truncate">{apiUrl}</code>
            <button
              onClick={() => copyUrl(apiUrl, "URL de API")}
              className="rounded-lg border border-white/5 bg-white/5 p-2 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <Copy className="h-4 w-4" />
            </button>
            <a
              href={apiUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/5 bg-white/5 p-2 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <p className="text-xs text-gray-500">
            <Smartphone className="h-3 w-3 inline mr-1" />
            Auto-actualización: los cambios en el menú se reflejan inmediatamente vía API
          </p>
        </Card>
      </div>

      <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
        <h3 className="font-bold text-lg text-white mb-4">Vista Previa del Menú</h3>
        <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-gray-900 to-black/80 p-6">
          <iframe
            src={boardUrl}
            className="w-full h-[500px] rounded-xl border border-white/5"
            style={{ background: "#0f0f0f" }}
          />
        </div>
      </Card>
    </div>
  );
}
