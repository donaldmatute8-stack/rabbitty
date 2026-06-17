"use client";

import { useState } from "react";
import { trpc } from "../../../../lib/trpc-client";
import { Card, Badge, Button, toast } from "@rabbitty/ui";
import { Clock, LogIn, LogOut, User, Calendar, Timer, RefreshCw } from "lucide-react";

export default function StaffShiftsPage() {
  const utils = trpc.useUtils();
  const { data: staff } = trpc.staff.getStaff.useQuery({});
  const { data: activeShifts } = trpc.staff.getActiveShifts.useQuery();
  const clockIn = trpc.staff.clockIn.useMutation({
    onSuccess: () => { utils.staff.getActiveShifts.invalidate(); toast.success("Entrada registrada"); },
    onError: (e) => toast.error(e.message),
  });
  const clockOut = trpc.staff.clockOut.useMutation({
    onSuccess: () => { utils.staff.getActiveShifts.invalidate(); toast.success("Salida registrada"); },
    onError: (e) => toast.error(e.message),
  });

  const onShift = activeShifts?.map((s) => s.staff[0]).filter(Boolean) ?? [];

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Control de Turnos
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Registro de entrada y salida del personal</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-3.5 py-2 text-xs font-bold text-green-400">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse mr-2" />
              {onShift.length} en turno
            </div>
            <Button variant="secondary" size="sm" onClick={() => utils.staff.getActiveShifts.invalidate()}>
              <RefreshCw className="h-4 w-4" />
              Refrescar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
              <LogIn className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Registrar Entrada</h3>
              <p className="text-xs text-gray-400 mt-0.5">Selecciona el personal para iniciar turno</p>
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {staff?.filter((s) => !onShift.find((o) => o.id === s.id)).map((member) => (
              <button
                key={member.id}
                onClick={() => clockIn.mutate({ staffId: member.id, branchId: process.env.NEXT_PUBLIC_BRANCH_ID ?? "b1" })}
                disabled={clockIn.isPending}
                className="w-full flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 hover:bg-white/10 hover:border-white/10 transition-all text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{member.name}</p>
                    <p className="text-xs text-gray-400">{member.role}</p>
                  </div>
                </div>
                <LogIn className="h-4 w-4 text-blue-400" />
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <LogOut className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Registrar Salida</h3>
              <p className="text-xs text-gray-400 mt-0.5">Finalizar turno del personal activo</p>
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activeShifts?.map((shift) => (
              <div key={shift.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                    {shift.staff[0]?.name?.charAt(0) ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{shift.staff[0]?.name ?? "—"}</p>
                    <p className="text-xs text-gray-400">
                      <Timer className="h-3 w-3 inline mr-1" />
                      {shift.checkIn ? new Date(shift.checkIn).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => clockOut.mutate({ staffId: shift.staffId })}
                  disabled={clockOut.isPending}
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Salida
                </Button>
              </div>
            ))}
            {!activeShifts?.length && (
              <div className="py-8 text-center text-sm text-gray-500">No hay personal con turno activo</div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
        <div className="mb-5 flex items-center gap-3">
          <Calendar className="h-5 w-5 text-pink-400" />
          <h3 className="font-bold text-lg text-white">Turnos del Día</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/5">
              <tr>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Empleado</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Rol</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Entrada</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Salida</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Duración</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {activeShifts?.map((shift) => {
                const checkIn = shift.checkIn ? new Date(shift.checkIn) : null;
                const checkOut = shift.checkOut ? new Date(shift.checkOut) : null;
                const duration = checkIn && checkOut
                  ? `${Math.round((checkOut.getTime() - checkIn.getTime()) / 3600000)}h`
                  : checkIn
                    ? `${Math.round((Date.now() - checkIn.getTime()) / 3600000)}h (en curso)`
                    : "—";
                return (
                  <tr key={shift.id} className="hover:bg-white/5 transition-all">
                    <td className="px-4 py-3 font-bold text-white">{shift.staff[0]?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-400">{shift.staff[0]?.role ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                      {checkIn?.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                      {checkOut?.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{duration}</td>
                    <td className="px-4 py-3">
                      <Badge variant={shift.status === "ACTIVE" ? "success" : "default"}>
                        {shift.status === "ACTIVE" ? "Activo" : "Finalizado"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {!activeShifts?.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    No hay turnos registrados hoy
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
