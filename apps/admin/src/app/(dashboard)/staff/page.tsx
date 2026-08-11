"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Dialog, Input, Select, toast } from "@rabbitty/ui";
import { Plus, Pencil, Trash2, Users, Shield, Crown, UtensilsCrossed, CreditCard, User, Hash } from "lucide-react";
import { cn } from "@rabbitty/ui";

const roleOptions = [
  { value: "WAITER", label: "Mesero" },
  { value: "CASHIER", label: "Cajero" },
  { value: "MANAGER", label: "Gerente" },
  { value: "ADMIN", label: "Admin" },
];

const roleConfig: Record<string, { label: string; icon: any; color: string; bg: string; badge: "default" | "secondary" | "success" | "warning" | "danger" }> = {
  ADMIN:   { label: "Admin",   icon: Crown,           color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",     badge: "danger" },
  MANAGER: { label: "Gerente", icon: Shield,           color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20", badge: "warning" },
  CASHIER: { label: "Cajero",  icon: CreditCard,       color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",   badge: "secondary" },
  WAITER:  { label: "Mesero",  icon: UtensilsCrossed,  color: "text-gray-400",   bg: "bg-gray-500/10 border-gray-500/20",   badge: "default" },
};

type StaffForm = { name: string; email: string; role: string; pinCode: string };
const defaultForm: StaffForm = { name: "", email: "", role: "WAITER", pinCode: "" };

// Random avatar bg from user name
function getAvatarColor(name: string) {
  const colors = ["from-pink-500 to-rose-500","from-violet-500 to-purple-500","from-blue-500 to-cyan-500","from-emerald-500 to-teal-500","from-amber-500 to-yellow-500","from-orange-500 to-red-500"];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export default function StaffPage() {
  const utils = trpc.useUtils();
  const { data: staff } = trpc.staff.getStaff.useQuery({});
  const createStaff = trpc.staff.createStaff.useMutation({ onSuccess: () => { utils.staff.getStaff.invalidate(); toast.success("Personal creado"); setDialog(null); }, onError: (e) => toast.error(e.message) });
  const updateStaff = trpc.staff.updateStaff.useMutation({ onSuccess: () => { utils.staff.getStaff.invalidate(); toast.success("Personal actualizado"); setDialog(null); }, onError: (e) => toast.error(e.message) });
  const deleteStaff = trpc.staff.deleteStaff.useMutation({ onSuccess: () => { utils.staff.getStaff.invalidate(); toast.success("Personal eliminado"); setDelete(null); }, onError: (e) => toast.error(e.message) });

  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; id?: string } | null>(null);
  const [form, setForm] = useState<StaffForm>(defaultForm);
  const [delete_, setDelete] = useState<{ id: string; name: string } | null>(null);
  const [filterRole, setFilterRole] = useState<string>("ALL");

  const openEdit = (m: NonNullable<typeof staff>[number]) => {
    setForm({ name: m.name, email: m.email, role: m.role, pinCode: "" });
    setDialog({ mode: "edit", id: m.id });
  };

  const save = () => {
    if (dialog?.mode === "create") {
      createStaff.mutate({ name: form.name, email: form.email, role: form.role as any, pinCode: form.pinCode || undefined });
    } else if (dialog?.id) {
      updateStaff.mutate({ id: dialog.id, name: form.name, email: form.email, role: form.role as any });
    }
  };

  const filtered = filterRole === "ALL" ? (staff ?? []) : (staff ?? []).filter(m => m.role === filterRole);
  const roleGroups = Object.entries(roleConfig).map(([role, cfg]) => ({
    role, cfg, count: (staff ?? []).filter(m => m.role === role).length
  }));

  return (
    <div className="space-y-8 pb-10">
      {/* ── Header Banner ── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-pink-500">
              <Users className="h-3.5 w-3.5" /> Equipo
            </span>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 mt-1">
              Personal & Roles
            </h1>
            <p className="text-gray-400 mt-1 text-sm font-medium">Gestiona empleados, credenciales PIN y permisos por rol.</p>
          </div>
          <Button onClick={() => { setForm(defaultForm); setDialog({ mode: "create" }); }}>
            <Plus className="h-4 w-4" /> Agregar Empleado
          </Button>
        </div>
      </div>

      {/* ── Role Stats Bento Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {roleGroups.map(({ role, cfg, count }) => {
          const Icon = cfg.icon;
          return (
            <button
              key={role}
              onClick={() => setFilterRole(filterRole === role ? "ALL" : role)}
              className={cn(
                "relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 cursor-pointer group",
                filterRole === role ? cfg.bg : "border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10"
              )}
            >
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border mb-4", cfg.bg)}>
                <Icon className={cn("h-5 w-5", cfg.color)} />
              </div>
              <p className="text-2xl font-black text-white">{count}</p>
              <p className={cn("text-xs font-bold mt-0.5", filterRole === role ? cfg.color : "text-gray-400")}>{cfg.label}</p>
              {filterRole === role && (
                <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-pink-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Staff Cards Bento Grid ── */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-white/5 bg-white/5 p-16 text-center">
          <div className="text-5xl mb-3">👤</div>
          <p className="text-white font-bold text-lg">Sin empleados</p>
          <p className="text-gray-400 text-sm mt-1">Agrega tu primer empleado usando el botón de arriba.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((member) => {
            const cfg = roleConfig[member.role] ?? roleConfig.WAITER;
            const Icon = cfg.icon;
            const avatarGrad = getAvatarColor(member.name);
            const initials = member.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

            return (
              <div
                key={member.id}
                className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 p-5 hover:border-white/15 hover:bg-white/8 transition-all duration-300"
              >
                {/* Role accent */}
                <div className={cn("absolute top-0 left-0 right-0 h-1 rounded-t-2xl", {
                  "bg-gradient-to-r from-red-500 to-rose-400": member.role === "ADMIN",
                  "bg-gradient-to-r from-amber-500 to-yellow-400": member.role === "MANAGER",
                  "bg-gradient-to-r from-blue-500 to-cyan-400": member.role === "CASHIER",
                  "bg-gradient-to-r from-gray-500 to-gray-400": member.role === "WAITER",
                })} />

                <div className="flex items-start justify-between mb-4 mt-1">
                  <div className={cn("h-12 w-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-black text-base shrink-0", avatarGrad)}>
                    {initials}
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <button onClick={() => openEdit(member)} className="rounded-xl border border-white/5 bg-white/5 p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDelete({ id: member.id, name: member.name })} className="rounded-xl border border-red-500/10 bg-red-500/5 p-1.5 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <p className="font-black text-white text-sm">{member.name}</p>
                  <p className="text-[11px] text-gray-500 font-mono truncate mt-0.5">{member.email}</p>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                  <div className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold", cfg.bg, cfg.color)}>
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                  </div>
                  <Badge variant={member.isActive ? "success" : "danger"} className="text-[10px]">
                    {member.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </div>

                <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-600">
                  <Hash className="h-2.5 w-2.5" />
                  PIN configurado
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={!!dialog} onClose={() => setDialog(null)} title={dialog?.mode === "create" ? "Agregar Empleado" : "Editar Empleado"}>
        <div className="space-y-4">
          <Input label="Nombre" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Select label="Rol" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} options={roleOptions} />
          {dialog?.mode === "create" && (
            <Input label="PIN (4 dígitos)" maxLength={4} value={form.pinCode} onChange={(e) => setForm((f) => ({ ...f, pinCode: e.target.value }))} />
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={save} disabled={createStaff.isPending || updateStaff.isPending}>
              {dialog?.mode === "create" ? "Crear" : "Guardar"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={!!delete_} onClose={() => setDelete(null)} title="Confirmar eliminación">
        <p className="text-sm text-gray-400">¿Eliminar a <strong className="text-white">{delete_?.name}</strong>? El registro se desactivará.</p>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={() => setDelete(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => delete_?.id && deleteStaff.mutate({ id: delete_.id })} disabled={deleteStaff.isPending}>Eliminar</Button>
        </div>
      </Dialog>
    </div>
  );
}
