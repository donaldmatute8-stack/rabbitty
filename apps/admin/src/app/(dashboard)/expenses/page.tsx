"use client";

import { useState, useEffect } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Dialog, Input, Select, toast, cn } from "@rabbitty/ui";
import { Receipt, Plus, Trash2, Pencil, TrendingDown, TrendingUp, DollarSign, PieChart, Calendar, Shield, Search, X, Check, Building2, UserX } from "lucide-react";

function SmartSupplierPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const utils = trpc.useUtils();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const [searchTerm, setSearchTerm] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const createSupplier = trpc.suppliers.create.useMutation({
    onSuccess: (newSupp) => {
      utils.suppliers.list.invalidate();
      onChange(newSupp.name);
      setSearchTerm(newSupp.name);
      setIsCreatingInline(false);
      setIsOpen(false);
      toast.success(`Proveedor "${newSupp.name}" registrado`);
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  const filtered = (suppliers ?? []).filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.contactName && s.contactName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const exactMatch = (suppliers ?? []).some(
    (s) => s.name.trim().toLowerCase() === searchTerm.trim().toLowerCase()
  );

  return (
    <div className="space-y-1.5 relative">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-300">
          Pagado a (Proveedor / Beneficiario)
        </label>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setSearchTerm("");
            }}
            className="text-xs text-pink-400 hover:text-pink-300 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <X className="h-3 w-3" /> Omitir / Sin Proveedor
          </button>
        )}
      </div>

      {/* Input de búsqueda inteligente */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          placeholder="Buscar o escribir nombre del proveedor..."
          className="w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-10 py-3 text-sm font-medium text-white transition-all duration-300 placeholder:text-gray-500 hover:bg-white/10 hover:border-white/20 focus:bg-white/10 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/30"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setSearchTerm("");
            }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown flotante inteligente */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => {
              setIsOpen(false);
              setIsCreatingInline(false);
            }}
          />
          <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-2xl border border-white/10 bg-gray-950/95 backdrop-blur-2xl shadow-2xl p-2 space-y-1 max-h-60 overflow-y-auto">
            {/* Opciones filtradas */}
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onChange(s.name);
                  setSearchTerm(s.name);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between p-2.5 rounded-xl text-left text-sm transition-all cursor-pointer",
                  value === s.name
                    ? "bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-4 w-4 text-pink-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-white leading-tight">{s.name}</p>
                    {s.contactName && (
                      <p className="text-xs text-gray-400 mt-0.5">{s.contactName} {s.phone ? `· ${s.phone}` : ""}</p>
                    )}
                  </div>
                </div>
                {value === s.name && <Check className="h-4 w-4 text-pink-400" />}
              </button>
            ))}

            {/* Si no hay coincidencia exacta y se escribió algo */}
            {searchTerm.trim().length > 0 && !exactMatch && !isCreatingInline && (
              <div className="pt-1 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsCreatingInline(true)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 text-sm font-bold transition-all border border-pink-500/20 cursor-pointer"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>+ Agregar <strong>"{searchTerm.trim()}"</strong> como nuevo proveedor</span>
                </button>
              </div>
            )}

            {/* Mini formulario inline para agregar proveedor rápido */}
            {isCreatingInline && (
              <div className="p-3 rounded-xl bg-black/60 border border-pink-500/30 space-y-2.5">
                <p className="text-xs font-bold text-pink-400">Nuevo Proveedor: {searchTerm.trim()}</p>
                <input
                  type="text"
                  placeholder="Persona de contacto (opcional)"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500"
                />
                <input
                  type="text"
                  placeholder="Teléfono (opcional)"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingInline(false)}
                    className="text-xs text-gray-400 hover:text-white px-2 py-1 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <Button
                    size="sm"
                    onClick={() => {
                      createSupplier.mutate({
                        name: searchTerm.trim(),
                        contactName: newContactName || undefined,
                        phone: newPhone || undefined,
                      });
                    }}
                    disabled={createSupplier.isPending || !searchTerm.trim()}
                  >
                    {createSupplier.isPending ? "Guardando..." : "Guardar y Seleccionar"}
                  </Button>
                </div>
              </div>
            )}

            {/* Opción para omitir */}
            <button
              type="button"
              onClick={() => {
                onChange("");
                setSearchTerm("");
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              <UserX className="h-3.5 w-3.5" />
              <span>Omitir proveedor (Sin proveedor)</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const CATEGORIES = [
  { value: "RENT", label: "Renta" },
  { value: "PAYROLL", label: "Nómina" },
  { value: "UTILITIES", label: "Servicios" },
  { value: "SUPPLIES", label: "Insumos" },
  { value: "MAINTENANCE", label: "Mantenimiento" },
  { value: "REMODELING", label: "Remodelación" },
  { value: "CONSTRUCTION", label: "Construcción" },
  { value: "MARKETING", label: "Marketing" },
  { value: "INSURANCE", label: "Seguros" },
  { value: "OTHER", label: "Otros" },
];

const CATEGORY_COLORS: Record<string, string> = {
  RENT: "from-red-500/20 to-red-600/20 text-red-400",
  PAYROLL: "from-blue-500/20 to-blue-600/20 text-blue-400",
  UTILITIES: "from-amber-500/20 to-amber-600/20 text-amber-400",
  SUPPLIES: "from-green-500/20 to-green-600/20 text-green-400",
  MAINTENANCE: "from-purple-500/20 to-purple-600/20 text-purple-400",
  REMODELING: "from-orange-500/20 to-orange-600/20 text-orange-400",
  CONSTRUCTION: "from-yellow-500/20 to-amber-600/20 text-yellow-400",
  MARKETING: "from-pink-500/20 to-pink-600/20 text-pink-400",
  INSURANCE: "from-cyan-500/20 to-cyan-600/20 text-cyan-400",
  OTHER: "from-gray-500/20 to-gray-600/20 text-gray-400",
};

export default function ExpensesPage() {
  const utils = trpc.useUtils();
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  const { data: expenses } = trpc.expenses.list.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const { data: pandl } = trpc.expenses.getPandL.useQuery(dateRange);
  const { data: suppliers } = trpc.suppliers.list.useQuery();

  const createExpense = trpc.expenses.create.useMutation({
    onSuccess: () => { utils.expenses.list.invalidate(); utils.expenses.getPandL.invalidate(); toast.success("Gasto registrado"); setDialog(false); },
    onError: (e) => toast.error(e.message),
  });

  const updateExpense = trpc.expenses.update.useMutation({
    onSuccess: () => {
      utils.expenses.list.invalidate();
      utils.expenses.getPandL.invalidate();
      toast.success("Gasto actualizado correctamente");
      setEditExpense(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteExpense = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      utils.expenses.list.invalidate();
      utils.expenses.getPandL.invalidate();
      toast.success("Gasto eliminado");
      setDeleteExpenseId(null);
      setDeletePin("");
    },
    onError: (e) => toast.error(e.message),
  });

  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ category: "SUPPLIES", description: "", amount: 0, reference: "", paidTo: "", notes: "", expenseDate: new Date().toISOString().split("T")[0] });
  
  const [editExpense, setEditExpense] = useState<{
    id: string;
    category: string;
    description: string;
    amount: number;
    expenseDate: string;
    paidTo: string;
    reference: string;
    notes: string;
    editReason: string;
    adminPin: string;
  } | null>(null);

  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [deletePin, setDeletePin] = useState("");

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Gastos y Rentabilidad
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Control de gastos operativos y estado de resultados</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange((d) => ({ ...d, startDate: e.target.value }))}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-pink-500 focus:outline-none"
              />
              <span className="text-gray-500">—</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange((d) => ({ ...d, endDate: e.target.value }))}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-pink-500 focus:outline-none"
              />
            </div>
            <Button onClick={() => setDialog(true)}>
              <Plus className="h-4 w-4" />
              Registrar Gasto
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="h-5 w-5 text-green-400" />
            <span className="text-sm text-gray-400 font-semibold">Ingresos</span>
          </div>
          <p className="text-2xl font-black text-green-400">${(pandl?.revenue ?? 0).toFixed(2)}</p>
        </Card>
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <TrendingDown className="h-5 w-5 text-red-400" />
            <span className="text-sm text-gray-400 font-semibold">Gastos</span>
          </div>
          <p className="text-2xl font-black text-red-400">${(pandl?.expenses ?? 0).toFixed(2)}</p>
        </Card>
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <DollarSign className="h-5 w-5 text-blue-400" />
            <span className="text-sm text-gray-400 font-semibold">Utilidad Neta</span>
          </div>
          <p className={`text-2xl font-black ${(pandl?.netProfit ?? 0) >= 0 ? "text-blue-400" : "text-red-400"}`}>
            ${(pandl?.netProfit ?? 0).toFixed(2)}
          </p>
        </Card>
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <PieChart className="h-5 w-5 text-amber-400" />
            <span className="text-sm text-gray-400 font-semibold">Margen</span>
          </div>
          <p className={`text-2xl font-black ${(pandl?.margin ?? 0) >= 30 ? "text-green-400" : (pandl?.margin ?? 0) >= 10 ? "text-amber-400" : "text-red-400"}`}>
            {(pandl?.margin ?? 0).toFixed(1)}%
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
            <h3 className="font-bold text-lg text-white mb-4">Gastos Registrados</h3>
            <div className="space-y-3">
              {expenses?.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4 hover:border-white/10 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${CATEGORY_COLORS[expense.category] ?? CATEGORY_COLORS["OTHER"]} border border-white/5 flex items-center justify-center`}>
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{expense.description}</p>
                      <p className="text-xs text-gray-400">
                        {CATEGORIES.find((c) => c.value === expense.category)?.label ?? expense.category}
                        {expense.paidTo && ` · ${expense.paidTo}`}
                        <span className="ml-2">
                          {expense.expenseDate ? new Date(expense.expenseDate).toLocaleDateString("es-MX") : ""}
                        </span>
                      </p>
                      {expense.notes && (
                        <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-md">{expense.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-red-400">-${expense.amount.toFixed(2)}</p>
                      {expense.reference && (
                        <p className="text-xs text-gray-500">{expense.reference}</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setEditExpense({
                          id: expense.id,
                          category: expense.category,
                          description: expense.description,
                          amount: expense.amount,
                          expenseDate: expense.expenseDate ? new Date(expense.expenseDate).toISOString().split("T")[0]! : new Date().toISOString().split("T")[0]!,
                          paidTo: expense.paidTo ?? "",
                          reference: expense.reference ?? "",
                          notes: expense.notes ?? "",
                          editReason: "",
                          adminPin: "",
                        });
                      }}
                      className="p-2 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Editar gasto"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setDeleteExpenseId(expense.id); setDeletePin(""); }}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Eliminar gasto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {!expenses?.length && (
                <p className="text-center text-sm text-gray-500 py-8">No hay gastos registrados en este período</p>
              )}
            </div>
          </Card>
        </div>

        <div>
          <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
            <h3 className="font-bold text-lg text-white mb-4">Por Categoría</h3>
            <div className="space-y-3">
              {pandl?.byCategory?.map((cat) => (
                <div key={cat.category} className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">{CATEGORIES.find((c) => c.value === cat.category)?.label ?? cat.category}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">${cat.total.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{cat.count} transacciones</p>
                  </div>
                </div>
              ))}
              {!pandl?.byCategory?.length && (
                <p className="text-center text-sm text-gray-500 py-4">Sin datos</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Dialog para Registrar Gasto */}
      <Dialog open={dialog} onClose={() => setDialog(false)} title="Registrar Gasto" className="max-w-3xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Categoría"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              options={CATEGORIES}
            />
            <Input
              label="Descripción del Gasto"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Ej. Compra de insumos, Mantenimiento..."
            />
            <Input
              label="Monto ($ MXN)"
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value === "" ? ("" as any) : Number(e.target.value) }))}
            />
            <Input
              label="Fecha"
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
            />
            <div className="md:col-span-2">
              <SmartSupplierPicker
                value={form.paidTo}
                onChange={(val) => setForm((f) => ({ ...f, paidTo: val }))}
              />
            </div>
            <Input
              label="Referencia (factura / ticket)"
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder="Ej. Factura #08786, Nota de remisión..."
            />
            <Input
              label="Notas adicionales"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notas u observaciones del gasto..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
            <Button variant="secondary" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={() => createExpense.mutate(form as any)} disabled={createExpense.isPending || !form.description || !form.amount}>
              Registrar Gasto
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog para Editar Gasto con PIN y Motivo de Cambio */}
      <Dialog open={!!editExpense} onClose={() => setEditExpense(null)} title="Editar Gasto Registrado" className="max-w-3xl">
        {editExpense && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center gap-2">
              <Shield className="h-4 w-4 shrink-0" />
              <span>La edición de gastos requiere PIN de Administrador y un motivo de auditoría.</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Categoría"
                value={editExpense.category}
                onChange={(e) => setEditExpense((prev) => prev ? ({ ...prev, category: e.target.value }) : null)}
                options={CATEGORIES}
              />
              <Input
                label="Descripción del Gasto"
                value={editExpense.description}
                onChange={(e) => setEditExpense((prev) => prev ? ({ ...prev, description: e.target.value }) : null)}
              />
              <Input
                label="Monto ($ MXN)"
                type="number"
                step="0.01"
                value={editExpense.amount}
                onChange={(e) => setEditExpense((prev) => prev ? ({ ...prev, amount: e.target.value === "" ? ("" as any) : Number(e.target.value) }) : null)}
              />
              <Input
                label="Fecha"
                type="date"
                value={editExpense.expenseDate}
                onChange={(e) => setEditExpense((prev) => prev ? ({ ...prev, expenseDate: e.target.value }) : null)}
              />
              <div className="md:col-span-2">
                <SmartSupplierPicker
                  value={editExpense.paidTo}
                  onChange={(val) => setEditExpense((prev) => prev ? ({ ...prev, paidTo: val }) : null)}
                />
              </div>
              <Input
                label="Referencia (factura / ticket)"
                value={editExpense.reference}
                onChange={(e) => setEditExpense((prev) => prev ? ({ ...prev, reference: e.target.value }) : null)}
              />
              <Input
                label="Notas adicionales"
                value={editExpense.notes}
                onChange={(e) => setEditExpense((prev) => prev ? ({ ...prev, notes: e.target.value }) : null)}
              />

              {/* Motivo de cambio obligatorio */}
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-pink-400 block mb-1">
                  Motivo del Cambio (Auditoría) *
                </label>
                <Input
                  placeholder="Ej. Se corrigió el monto según factura / Categoría corregida"
                  value={editExpense.editReason}
                  onChange={(e) => setEditExpense((prev) => prev ? ({ ...prev, editReason: e.target.value }) : null)}
                />
              </div>

              {/* PIN de Administrador */}
              <div className="md:col-span-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white block">
                    PIN de Administrador (4 dígitos) *
                  </label>
                  <p className="text-xs text-gray-400 mt-0.5">Autorización requerida para guardar los cambios</p>
                </div>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={editExpense.adminPin}
                  onChange={(e) => setEditExpense((prev) => prev ? ({ ...prev, adminPin: e.target.value.replace(/\D/g, "") }) : null)}
                  className="w-36 rounded-xl border border-white/10 bg-black/60 p-2.5 text-center text-xl tracking-[0.5em] text-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
              <Button variant="secondary" onClick={() => setEditExpense(null)}>Cancelar</Button>
              <Button
                onClick={() => {
                  if (editExpense && editExpense.editReason && editExpense.adminPin.length === 4) {
                    updateExpense.mutate({
                      id: editExpense.id,
                      category: editExpense.category as any,
                      description: editExpense.description,
                      amount: editExpense.amount,
                      expenseDate: editExpense.expenseDate,
                      paidTo: editExpense.paidTo || undefined,
                      reference: editExpense.reference || undefined,
                      notes: editExpense.notes || undefined,
                      editReason: editExpense.editReason,
                      adminPin: editExpense.adminPin,
                    });
                  }
                }}
                disabled={updateExpense.isPending || !editExpense.description || !editExpense.amount || !editExpense.editReason || editExpense.adminPin.length !== 4}
              >
                {updateExpense.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* PIN Confirmation Dialog for Deleting Expense */}
      <Dialog open={!!deleteExpenseId} onClose={() => { setDeleteExpenseId(null); setDeletePin(""); }} title="Autorización de Administrador Requerida">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Eliminar un gasto registrado es una acción de riesgo financiero. Ingresa el <strong className="text-white">PIN de 4 dígitos</strong> de Administrador para confirmar.
          </p>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">PIN de Administrador</label>
            <input
              type="password"
              maxLength={4}
              placeholder="••••"
              value={deletePin}
              onChange={(e) => setDeletePin(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-white/10 bg-gray-900 p-3 text-center text-2xl tracking-[0.5em] text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setDeleteExpenseId(null); setDeletePin(""); }}>Cancelar</Button>
            <Button
              className="bg-red-600 hover:bg-red-500 text-white"
              onClick={() => {
                if (deleteExpenseId) {
                  deleteExpense.mutate({ id: deleteExpenseId, adminPin: deletePin });
                }
              }}
              disabled={deleteExpense.isPending || deletePin.length !== 4}
            >
              {deleteExpense.isPending ? "Verificando..." : "Eliminar Gasto"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
