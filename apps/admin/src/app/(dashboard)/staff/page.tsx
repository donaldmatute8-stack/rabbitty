"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Dialog, Input, Select, toast } from "@rabbitty/ui";
import { Plus, Pencil, Trash2 } from "lucide-react";

const roleOptions = [
  { value: "waiter", label: "Mesero" },
  { value: "cook", label: "Cocina" },
  { value: "admin", label: "Admin" },
];

const roleColors: Record<string, "default" | "secondary" | "success" | "warning" | "danger"> = {
  admin: "danger",
  cook: "warning",
  waiter: "secondary",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  cook: "Cocina",
  waiter: "Mesero",
};

type StaffForm = { name: string; email: string; role: string; pinCode: string };

const defaultForm: StaffForm = { name: "", email: "", role: "waiter", pinCode: "" };

export default function StaffPage() {
  const utils = trpc.useUtils();
  const { data: staff } = trpc.staff.getStaff.useQuery({});
  const createStaff = trpc.staff.createStaff.useMutation({ onSuccess: () => { utils.staff.getStaff.invalidate(); toast.success("Personal creado"); setDialog(null); }, onError: (e) => toast.error(e.message) });
  const updateStaff = trpc.staff.updateStaff.useMutation({ onSuccess: () => { utils.staff.getStaff.invalidate(); toast.success("Personal actualizado"); setDialog(null); }, onError: (e) => toast.error(e.message) });
  const deleteStaff = trpc.staff.deleteStaff.useMutation({ onSuccess: () => { utils.staff.getStaff.invalidate(); toast.success("Personal eliminado"); setDelete(null); }, onError: (e) => toast.error(e.message) });

  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; id?: string } | null>(null);
  const [form, setForm] = useState<StaffForm>(defaultForm);
  const [delete_, setDelete] = useState<{ id: string; name: string } | null>(null);

  const openEdit = (m: NonNullable<typeof staff>[number]) => {
    setForm({ name: m.name, email: m.email, role: m.role, pinCode: "" });
    setDialog({ mode: "edit", id: m.id });
  };

  const save = () => {
    if (dialog?.mode === "create") {
      createStaff.mutate({ ...form, branchId: process.env.NEXT_PUBLIC_BRANCH_ID ?? "b1", role: form.role as "WAITER" | "CASHIER" | "MANAGER" | "ADMIN" });
    } else if (dialog?.id) {
      updateStaff.mutate({ id: dialog.id, name: form.name, email: form.email, role: form.role as "WAITER" | "CASHIER" | "MANAGER" | "ADMIN" });
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Personal
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Gestiona los empleados, credenciales y sus roles</p>
          </div>
          <Button onClick={() => { setForm(defaultForm); setDialog({ mode: "create" }); }}>
            <Plus className="h-5 w-5" />
            Agregar Personal
          </Button>
        </div>
      </div>

      <Card className="border border-white/5 bg-white/5 backdrop-blur-md overflow-hidden rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/5 bg-white/5">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Nombre</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Email</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Rol</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Estado</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {staff?.map((member) => (
                <tr key={member.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-bold text-white text-base">{member.name}</td>
                  <td className="px-6 py-4 text-gray-400 font-mono text-xs">{member.email}</td>
                  <td className="px-6 py-4">
                    <Badge variant={roleColors[member.role] ?? "default"}>
                      {roleLabels[member.role] ?? member.role}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={member.isActive ? "success" : "danger"}>
                      {member.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(member)}
                        className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDelete({ id: member.id, name: member.name })}
                        className="rounded-xl border border-red-500/10 bg-red-500/5 p-2 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 transition-all duration-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={dialog?.mode === "create" ? "Agregar Personal" : "Editar Personal"}
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Select
            label="Rol"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            options={roleOptions}
          />
          {dialog?.mode === "create" && (
            <Input
              label="PIN (4 dígitos)"
              maxLength={4}
              value={form.pinCode}
              onChange={(e) => setForm((f) => ({ ...f, pinCode: e.target.value }))}
            />
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={save} disabled={createStaff.isPending || updateStaff.isPending}>
              {dialog?.mode === "create" ? "Crear" : "Guardar"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!delete_}
        onClose={() => setDelete(null)}
        title="Confirmar eliminación"
      >
        <p className="text-sm text-gray-600">
          ¿Estás seguro de eliminar a <strong>{delete_?.name}</strong>? El registro se desactivará.
        </p>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={() => setDelete(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => delete_?.id &&         deleteStaff.mutate({ id: delete_.id })} disabled={deleteStaff.isPending}>
            Eliminar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
