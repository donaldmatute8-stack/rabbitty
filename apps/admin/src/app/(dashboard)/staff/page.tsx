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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personal</h1>
          <p className="text-sm text-gray-500">Gestiona los empleados y sus roles</p>
        </div>
        <Button onClick={() => { setForm(defaultForm); setDialog({ mode: "create" }); }}>
          <Plus className="h-4 w-4" />
          Agregar Personal
        </Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-5 py-3 font-medium text-gray-500">Nombre</th>
              <th className="px-5 py-3 font-medium text-gray-500">Email</th>
              <th className="px-5 py-3 font-medium text-gray-500">Rol</th>
              <th className="px-5 py-3 font-medium text-gray-500">Estado</th>
              <th className="px-5 py-3 font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staff?.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 font-medium text-gray-900">{member.name}</td>
                <td className="px-5 py-4 text-gray-500">{member.email}</td>
                <td className="px-5 py-4">
                  <Badge variant={roleColors[member.role] ?? "default"}>
                    {roleLabels[member.role] ?? member.role}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <Badge variant={member.isActive ? "success" : "danger"}>
                    {member.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(member)}
                      className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDelete({ id: member.id, name: member.name })}
                      className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
