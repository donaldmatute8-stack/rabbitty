"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Button, toast } from "@rabbitty/ui";
import { Gift, Cake, Users, Settings, Save, CalendarDays } from "lucide-react";

export default function BirthdaysPage() {
  const utils = trpc.useUtils();
  const { data: birthdays } = trpc.admin.getUpcomingBirthdays.useQuery();
  const { data: settings } = trpc.admin.getBirthdaySettings.useQuery();
  const updateSettings = trpc.admin.updateBirthdaySettings.useMutation({
    onSuccess: () => { utils.admin.getBirthdaySettings.invalidate(); toast.success("Configuración guardada"); },
    onError: (e) => toast.error(e.message),
  });

  const [bonus, setBonus] = useState(100);
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">Cumpleaños</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border border-white/5 bg-white/5 backdrop-blur-md">
            <div className="p-5 border-b border-white/5 flex items-center gap-3">
              <Cake className="h-5 w-5 text-pink-400" />
              <h2 className="font-bold text-white">Próximos Cumpleaños</h2>
            </div>
            <div className="divide-y divide-white/5">
              {birthdays?.length === 0 && <p className="p-5 text-sm text-gray-500">Sin cumpleaños registrados</p>}
              {birthdays?.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 text-lg">
                      🎂
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{c.name || "Sin nombre"}</p>
                      <p className="text-xs text-gray-400">{c.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {c.daysUntilBirthday !== null && (
                      <span className={`text-xs font-bold ${c.daysUntilBirthday <= 7 ? "text-pink-400" : c.daysUntilBirthday <= 30 ? "text-yellow-400" : "text-gray-400"}`}>
                        {c.daysUntilBirthday <= 0 ? "¡Hoy!" : `${Math.round(c.daysUntilBirthday)} días`}
                      </span>
                    )}
                    <p className="text-xs text-gray-500">{c.birthDate ? new Date(c.birthDate).toLocaleDateString("es-MX", { day: "numeric", month: "long" }) : ""}</p>
                  </div>
                </div>
              ))}
              {!birthdays && <p className="p-5 text-sm text-gray-500">Cargando...</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4">
              <Settings className="h-5 w-5 text-pink-400" />
              <h2 className="font-bold text-white">Configuración</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Bunz de Regalo</label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none mt-1"
                  defaultValue={settings?.birthdayBonusBunz ?? 100}
                  onChange={(e) => setBonus(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mensaje</label>
                <textarea
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none mt-1 h-24 resize-none"
                  defaultValue={settings?.birthdayMessageTemplate ?? ""}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Usa {"{name}"} y {"{bonus}"} como variables</p>
              </div>
              <Button
                className="w-full"
                onClick={() => updateSettings.mutate({ birthdayBonusBunz: bonus, birthdayMessageTemplate: message || settings?.birthdayMessageTemplate || "", isActive: true })}
              >
                <Save className="h-4 w-4" />
                Guardar
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card className="border border-white/5 bg-white/5 p-4 backdrop-blur-md text-center">
              <p className="text-2xl font-black text-white">{birthdays?.length ?? 0}</p>
              <p className="text-xs text-gray-400">Con cumpleaños</p>
            </Card>
            <Card className="border border-white/5 bg-white/5 p-4 backdrop-blur-md text-center">
              <p className="text-2xl font-black text-pink-400">
                {birthdays?.filter((c: any) => c.daysUntilBirthday !== null && c.daysUntilBirthday <= 7).length ?? 0}
              </p>
              <p className="text-xs text-gray-400">Esta semana</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
