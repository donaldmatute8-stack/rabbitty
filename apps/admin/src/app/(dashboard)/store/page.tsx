"use client";

import { useEffect, useMemo, useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Dialog, Input, Select, toast } from "@rabbitty/ui";
import { Package, Truck, ArrowUp, ArrowDown, Eye, EyeOff, AlertTriangle, ExternalLink, Percent } from "lucide-react";
import Link from "next/link";
import { useBranch } from "../../../components/DashboardClientWrapper";

/**
 * ── Tienda & Envíos ────────────────────────────────────────────────────────
 *
 * Dos cosas en un solo lugar porque son la misma conversación: qué vende el
 * negocio para llevar y cuánto cobra por llevarlo.
 *
 * - **Envíos**: `restaurants.deliveryConfig`. Con tarifa, el checkout de la app
 *   la suma a `orders.deliveryFee` y el POS no la vuelve a cobrar. Sin config no
 *   se cobra y la app dice "por confirmar" (nunca gratis en silencio).
 * - **Productos**: `menu_items` con `kind = 'PRODUCT'`. Existencias derivadas de
 *   la receta contra inventario (misma fuente que descuenta el POS/app), ventas
 *   de 30 días, publicar/ocultar y orden del escaparate.
 *
 * Crear o editar el producto en sí se hace en **Menú** (mismo formulario que un
 * platillo): aquí sólo se administra lo de tienda, sin duplicar formularios.
 */

type DeliveryConfig = {
  enabled?: boolean;
  mode?: "FLAT" | "PROVIDER";
  baseFee?: number;
  freeOver?: number;
  etaMinutes?: number;
  notes?: string;
};

export default function StorePage() {
  const utils = trpc.useUtils();
  const { branchId: activeBranchId } = useBranch();
  const branchesQuery = trpc.admin.getBranches.useQuery(undefined, { retry: false });
  const branchId = activeBranchId || branchesQuery.data?.[0]?.id || "";
  const restaurantsQuery = trpc.admin.getRestaurants.useQuery();
  const productsQuery = trpc.admin.getStoreProducts.useQuery(undefined, { refetchOnWindowFocus: false });
  const menuItemsQuery = trpc.pos.getMenuItems.useQuery({});

  const restaurant = restaurantsQuery.data?.[0];

  // ── Controlar existencias de un producto sin receta ──
  // Reusa `inventory.createItem` + `inventory.addRecipeIngredient`: el insumo y la
  // receta 1:1 son las piezas que ya descuentan stock al cobrar.
  // ── Editar producto (precio, foto, envío, peso, tope) ──
  const [editDialog, setEditDialog] = useState<{
    id: string;
    name: string;
    price: number;
    imageUrl: string;
    requiresShipping: boolean;
    weightGrams?: number;
    maxPerOrder?: number;
  } | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [stockDialog, setStockDialog] = useState<{
    id: string;
    name: string;
    inventoryItemId?: string | null;
    currentStock?: number | null;
  } | null>(null);
  const [stockForm, setStockForm] = useState({ stock: 0, minStock: 2, unit: "pieza" });

  // Comisión de plataforma: SOLO lectura aquí. La escribe God (es ingreso de
  // Rabbitty); el comercio no debe poder ponerla en 0.
  const commissionQuery = trpc.admin.getCommissionSummary.useQuery(undefined, { refetchOnWindowFocus: false });

  const [delivery, setDelivery] = useState<DeliveryConfig>({
    enabled: true,
    mode: "FLAT",
    baseFee: 0,
    freeOver: undefined,
    etaMinutes: 40,
    notes: "",
  });

  useEffect(() => {
    const cfg = (restaurant as { deliveryConfig?: DeliveryConfig | null } | undefined)?.deliveryConfig;
    if (cfg && typeof cfg === "object") {
      setDelivery({
        enabled: cfg.enabled ?? true,
        mode: cfg.mode === "PROVIDER" ? "PROVIDER" : "FLAT",
        baseFee: cfg.baseFee ?? 0,
        freeOver: cfg.freeOver ?? undefined,
        etaMinutes: cfg.etaMinutes ?? 40,
        notes: cfg.notes ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  const updateRestaurant = trpc.admin.updateRestaurant.useMutation({
    onSuccess: () => {
      utils.admin.getRestaurants.invalidate();
      toast.success("Configuración de envíos guardada");
    },
    onError: (error) => toast.error(error.message || "No se pudo guardar"),
  });

  const createInventoryItem = trpc.inventory.createItem.useMutation();
  const addRecipeIngredient = trpc.inventory.addRecipeIngredient.useMutation();
  const updateStock = trpc.inventory.updateStock.useMutation();

  const updateItem = trpc.admin.updateMenuItem.useMutation({
    onSuccess: () => {
      utils.admin.getStoreProducts.invalidate();
      utils.pos.getMenuItems.invalidate();
    },
    onError: (error) => toast.error(error.message || "No se pudo actualizar el producto"),
  });

  const products = productsQuery.data?.products ?? [];
  const totals = productsQuery.data?.totals;

  // ¿Hay productos en el menú que no están marcados como tienda? Sirve para
  // recordar que "Bolsa de café" ya existe como platillo y sólo falta marcarlo.
  const candidates = useMemo(() => {
    const all = menuItemsQuery.data ?? [];
    return all.filter((item) => (item.kind ?? "DISH") !== "PRODUCT").slice(0, 6);
  }, [menuItemsQuery.data]);

  /** Sube la foto al bucket (no dataURL en Postgres) y devuelve la URL pública. */
  const uploadPhoto = async (file: File) => {
    setPhotoError(null);
    if (!branchId) {
      setPhotoError("No sé a qué sucursal pertenece la foto");
      return;
    }
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("branchId", branchId);
      const res = await fetch("/api/uploads/product", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) throw new Error(data?.error || "No se pudo subir la foto");
      setEditDialog((d) => (d ? { ...d, imageUrl: data.url } : d));
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "No se pudo subir la foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveProduct = () => {
    if (!editDialog) return;
    updateItem.mutate(
      {
        id: editDialog.id,
        price: Number(editDialog.price) || 0,
        imageUrl: editDialog.imageUrl.trim() || undefined,
        requiresShipping: editDialog.requiresShipping,
        weightGrams: editDialog.weightGrams ?? null,
        maxPerOrder: editDialog.maxPerOrder ?? null,
      },
      {
        onSuccess: () => {
          toast.success("Producto actualizado");
          setEditDialog(null);
        },
      },
    );
  };

  /** Ajuste rápido: fija el stock absoluto del insumo 1:1 del producto. */
  const adjustStock = async () => {
    if (!stockDialog?.inventoryItemId) return;
    try {
      await updateStock.mutateAsync({
        itemId: stockDialog.inventoryItemId,
        quantity: Number(stockForm.stock) || 0,
        type: "ADJUST",
        notes: `Ajuste desde Tienda · ${stockDialog.name}`,
      });
      utils.admin.getStoreProducts.invalidate();
      utils.inventory.getItems.invalidate();
      toast.success("Existencias actualizadas");
      setStockDialog(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo ajustar el stock");
    }
  };

  const linkStock = async () => {
    if (!stockDialog) return;
    try {
      const item = await createInventoryItem.mutateAsync({
        name: stockDialog.name,
        unit: stockForm.unit || "pieza",
        stock: Number(stockForm.stock) || 0,
        minStock: Number(stockForm.minStock) || 0,
        costPerUnit: 0,
      });
      if (!item?.id) throw new Error("No se pudo crear el insumo");
      await addRecipeIngredient.mutateAsync({
        menuItemId: stockDialog.id,
        inventoryItemId: item.id,
        quantityRequired: 1,
        unit: stockForm.unit || "pieza",
      });
      utils.admin.getStoreProducts.invalidate();
      utils.inventory.getItems.invalidate();
      toast.success("Existencias ligadas al inventario");
      setStockDialog(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo ligar el inventario");
    }
  };

  const saveDelivery = () => {
    if (!restaurant?.id) {
      toast.error("No encontré tu restaurante");
      return;
    }
    updateRestaurant.mutate({
      id: restaurant.id,
      deliveryConfig:
        delivery.mode === "FLAT" && !(Number(delivery.baseFee) > 0)
          ? // Sin tarifa no hay envío configurado: se guarda igual para dejar
            // explícito que no se cobra (la app mostrará "por confirmar").
            { ...delivery, baseFee: 0 }
          : delivery,
    });
  };

  const move = (id: string, currentSort: number, direction: -1 | 1) => {
    updateItem.mutate({ id, sortOrder: Math.max(0, currentSort + direction * 10) });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-linear-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-400">Para llevar</p>
          <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-linear-to-r from-white via-gray-200 to-gray-500">
            Tienda & Envíos
          </h1>
          <p className="max-w-2xl text-sm font-medium text-gray-400">
            Lo que tu cliente se lleva a casa (café en grano, pan, botellas) y cuánto cobras por
            llevarlo. Los productos se crean en <strong className="text-gray-300">Menú</strong> como
            cualquier artículo, eligiendo el tipo “Producto de tienda”.
          </p>
        </div>
      </div>

      {/* ── Envíos ── */}
      <Card className="border border-white/5 bg-white/[0.03] p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-pink-500/20 bg-pink-500/10 text-pink-400">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Costo de envío</h2>
              <p className="text-xs text-gray-400">
                Se suma al total del pedido y aparece en el ticket. El POS deja de cobrarlo aparte.
              </p>
            </div>
          </div>
          <Badge variant={delivery.baseFee && delivery.baseFee > 0 ? "success" : "secondary"}>
            {delivery.baseFee && delivery.baseFee > 0 ? `$${delivery.baseFee}` : "Sin cobro"}
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Select
            label="Modo"
            value={delivery.mode}
            onChange={(e) =>
              setDelivery((d) => ({ ...d, mode: e.target.value === "PROVIDER" ? "PROVIDER" : "FLAT" }))
            }
            options={[
              { value: "FLAT", label: "Tarifa fija del negocio" },
              { value: "PROVIDER", label: "Cotizar con Uber Direct (si está configurado)" },
            ]}
          />
          <Input
            label="Tarifa fija (MXN)"
            type="number"
            min={0}
            step="1"
            value={delivery.baseFee ?? 0}
            onChange={(e) => setDelivery((d) => ({ ...d, baseFee: Number(e.target.value) }))}
          />
          <Input
            label="Envío gratis desde (MXN, opcional)"
            type="number"
            min={0}
            step="10"
            value={delivery.freeOver ?? ""}
            onChange={(e) =>
              setDelivery((d) => ({
                ...d,
                freeOver: e.target.value === "" ? undefined : Number(e.target.value),
              }))
            }
          />
          <Input
            label="Tiempo estimado (min)"
            type="number"
            min={0}
            value={delivery.etaMinutes ?? 40}
            onChange={(e) => setDelivery((d) => ({ ...d, etaMinutes: Number(e.target.value) }))}
          />
          <div className="lg:col-span-2">
            <Input
              label="Nota para el cliente (opcional)"
              placeholder="Ej. Enviamos dentro de Bucerías"
              value={delivery.notes ?? ""}
              onChange={(e) => setDelivery((d) => ({ ...d, notes: e.target.value.slice(0, 200) }))}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-gray-300">
            <input
              type="checkbox"
              checked={delivery.enabled !== false}
              onChange={(e) => setDelivery((d) => ({ ...d, enabled: e.target.checked }))}
              className="h-4 w-4 accent-pink-500"
            />
            Aceptar pedidos a domicilio
          </label>
          <Button onClick={saveDelivery} disabled={updateRestaurant.isPending}>
            {updateRestaurant.isPending ? "Guardando…" : "Guardar envíos"}
          </Button>
        </div>

        {delivery.mode === "PROVIDER" && (
          <p className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-[11px] leading-relaxed text-sky-200/80">
            Uber Direct cobra por distancia. Si no hay credenciales configuradas o la cotización
            falla, se usa la tarifa fija de arriba — nunca se deja el envío en cero sin avisar.
          </p>
        )}
      </Card>

      {/* ── Comisión de plataforma (solo lectura) ──
             Es ingreso de Rabbitty: el comercio no la edita (podría ponerla en 0).
             Se configura en God; aquí se muestra para que sepa qué paga. */}
      <Card className="border border-white/5 bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Comisión de plataforma</h2>
              <p className="text-[11px] text-gray-500">
                Sobre la parte pagada en dinero; los Bunz nunca pagan comisión.
              </p>
            </div>
          </div>
          <Badge variant={commissionQuery.data?.enabled ? "success" : "secondary"}>
            {commissionQuery.data?.enabled
              ? `${((commissionQuery.data.pct ?? 0) * 100).toFixed(2)} %`
              : "Sin comisión"}
          </Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-500">Comisión 30 d</p>
            <p className="mt-1 text-xl font-black text-white">
              ${((commissionQuery.data?.last30d ?? 0) / 100).toLocaleString("es-MX", { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-500">Del mes</p>
            <p className="mt-1 text-xl font-black text-white">
              ${((commissionQuery.data?.monthToDate ?? 0) / 100).toLocaleString("es-MX", { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-500">Ventas gravadas</p>
            <p className="mt-1 text-xl font-black text-white">{commissionQuery.data?.last30dOrders ?? 0}</p>
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
          La tarifa la define Rabbitty y aparece en tu anexo económico. El <strong>1 % por uso del método de
          pago</strong> es aparte y se ve en la conciliación de pagos.
        </p>
      </Card>

      {/* ── Resumen de la tienda ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Publicados", value: totals?.published ?? 0, tone: "text-white" },
          { label: "Agotados", value: totals?.outOfStock ?? 0, tone: "text-amber-400" },
          { label: "Vendidos (30 d)", value: totals?.sold30d ?? 0, tone: "text-emerald-400" },
          {
            label: "Ingresos (30 d)",
            value: `$${(totals?.revenue30d ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`,
            tone: "text-white",
          },
          {
            label: "Margen (30 d)",
            value: `$${(totals?.margin30d ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`,
            tone: (totals?.margin30d ?? 0) >= 0 ? "text-emerald-400" : "text-red-400",
          },
        ].map((stat) => (
          <Card key={stat.label} className="border border-white/5 bg-white/[0.03] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">{stat.label}</p>
            <p className={`mt-1 text-3xl font-black ${stat.tone}`}>{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* ── Productos ── */}
      <Card className="border border-white/5 bg-white/[0.03] p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Productos de la tienda</h2>
              <p className="text-xs text-gray-400">
                Existencias calculadas con la receta del producto contra inventario.
              </p>
            </div>
          </div>
          <Link
            href="/menu"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/10 hover:text-white"
          >
            Crear en Menú <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {productsQuery.isLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">Cargando productos…</p>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
            <Package className="mx-auto mb-3 h-6 w-6 text-gray-600" />
            <p className="text-sm font-bold text-gray-300">Todavía no hay productos de tienda</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-gray-500">
              En Menú, al crear un artículo elige <strong>Producto de tienda</strong>. Ahí mismo
              decides si se envía, su peso y el máximo por pedido.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {products.map((product) => {
              const outOfStock = product.stock !== null && product.stock <= 0;
              return (
                <div key={product.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-white">{product.name}</p>
                      {product.requiresShipping && (
                        <Badge variant="secondary">
                          <Truck className="mr-1 h-3 w-3" /> envío
                        </Badge>
                      )}
                      {outOfStock ? (
                        <Badge variant="warning">
                          <AlertTriangle className="mr-1 h-3 w-3" /> agotado
                        </Badge>
                      ) : product.stock !== null && product.lowStock ? (
                        <Badge variant="warning">bajo stock</Badge>
                      ) : null}
                      {!product.isAvailable && <Badge variant="secondary">oculto</Badge>}
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      ${product.price} · {product.stock === null ? "sin control de existencias" : `${product.stock} en stock`}
                      {" · "}
                      {product.sold30d} vendidos (30 d)
                      {product.maxPerOrder ? ` · máx ${product.maxPerOrder}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setEditDialog({
                          id: product.id,
                          name: product.name,
                          price: product.price,
                          imageUrl: product.imageUrl ?? "",
                          requiresShipping: product.requiresShipping,
                          weightGrams: product.weightGrams ?? undefined,
                          maxPerOrder: product.maxPerOrder ?? undefined,
                        })
                      }
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-gray-300 hover:bg-white/10 hover:text-white"
                    >
                      Editar
                    </button>
                    {product.inventoryItemId ? (
                      <button
                        onClick={() => {
                          setStockForm({
                            stock: product.stock ?? 0,
                            minStock: 2,
                            unit: "pieza",
                          });
                          setStockDialog({
                            id: product.id,
                            name: product.name,
                            inventoryItemId: product.inventoryItemId,
                            currentStock: product.stock,
                          });
                        }}
                        className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${
                          outOfStock
                            ? 'border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                            : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                        }`}
                        title="Ajustar existencias"
                      >
                        Stock: {product.stock ?? 0}
                      </button>
                    ) : product.stock === null ? (
                      <button
                        onClick={() => {
                          setStockForm({ stock: 0, minStock: 2, unit: "pieza" });
                          setStockDialog({ id: product.id, name: product.name });
                        }}
                        className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-bold text-sky-300 hover:bg-sky-500/20"
                      >
                        Controlar existencias
                      </button>
                    ) : null}
                    <button
                      onClick={() => move(product.id, product.sortOrder, -1)}
                      className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-gray-400 hover:text-white"
                      aria-label="Subir"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => move(product.id, product.sortOrder, 1)}
                      className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-gray-400 hover:text-white"
                      aria-label="Bajar"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        updateItem.mutate({ id: product.id, requiresShipping: !product.requiresShipping })
                      }
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${
                        product.requiresShipping
                          ? 'border-sky-500/20 bg-sky-500/10 text-sky-300'
                          : 'border-white/10 bg-white/5 text-gray-400'
                      }`}
                      title="¿Se envía a domicilio?"
                    >
                      <Truck className="h-3.5 w-3.5" />
                      {product.requiresShipping ? 'Envío' : 'Sin envío'}
                    </button>
                    <button
                      onClick={() => updateItem.mutate({ id: product.id, isAvailable: !product.isAvailable })}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${
                        product.isAvailable
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                          : "border-white/10 bg-white/5 text-gray-400"
                      }`}
                    >
                      {product.isAvailable ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {product.isAvailable ? "Publicado" : "Oculto"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Editar producto ── */}
      <Dialog
        open={Boolean(editDialog)}
        onClose={() => setEditDialog(null)}
        title={editDialog?.name ?? "Producto"}
        kicker="Tienda"
      >
        {editDialog && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
                {editDialog.imageUrl ? (
                  <img src={editDialog.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <img src="/Ra.png" alt="" className="h-10 w-10 object-contain opacity-25 grayscale" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <label className="inline-block cursor-pointer text-[11px] font-bold text-pink-400 hover:text-pink-300">
                  <span>{uploadingPhoto ? "Subiendo…" : "Subir foto (JPG, PNG o WebP · máx 5 MB)"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingPhoto}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void uploadPhoto(file);
                    }}
                  />
                </label>
                <Input
                  label="o pega una URL"
                  placeholder="https://…"
                  value={editDialog.imageUrl}
                  onChange={(e) => setEditDialog((d) => (d ? { ...d, imageUrl: e.target.value } : d))}
                />
                {photoError && <p className="text-[10px] font-bold text-red-400">{photoError}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Precio (MXN)"
                type="number"
                min={0}
                step="1"
                value={editDialog.price}
                onChange={(e) => setEditDialog((d) => (d ? { ...d, price: Number(e.target.value) } : d))}
              />
              <Input
                label="Peso (g, opcional)"
                type="number"
                min={0}
                value={editDialog.weightGrams ?? ""}
                onChange={(e) =>
                  setEditDialog((d) =>
                    d ? { ...d, weightGrams: e.target.value === "" ? undefined : Number(e.target.value) } : d,
                  )
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Máx. por pedido"
                type="number"
                min={1}
                value={editDialog.maxPerOrder ?? ""}
                onChange={(e) =>
                  setEditDialog((d) =>
                    d ? { ...d, maxPerOrder: e.target.value === "" ? undefined : Number(e.target.value) } : d,
                  )
                }
              />
              <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-xs font-bold text-gray-300">
                <input
                  type="checkbox"
                  checked={editDialog.requiresShipping}
                  onChange={(e) =>
                    setEditDialog((d) => (d ? { ...d, requiresShipping: e.target.checked } : d))
                  }
                  className="h-4 w-4 accent-pink-500"
                />
                Se envía a domicilio
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setEditDialog(null)}>
                Cancelar
              </Button>
              <Button onClick={saveProduct} disabled={updateItem.isPending || uploadingPhoto}>
                {updateItem.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={Boolean(stockDialog)}
        onClose={() => setStockDialog(null)}
        title={stockDialog?.inventoryItemId ? "Ajustar existencias" : "Controlar existencias"}
        kicker="Inventario"
      >
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-gray-400">
            {stockDialog?.inventoryItemId
              ? 'Escribe cuántas unidades hay hoy. Queda registrado como ajuste en Inventario, con su movimiento.'
              : 'Se crea un insumo con el nombre del producto y una receta 1:1. Desde ahí, cada venta descuenta una unidad del inventario (POS y app usan el mismo motor).'}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Stock inicial"
              type="number"
              min={0}
              value={stockForm.stock}
              onChange={(e) => setStockForm((f) => ({ ...f, stock: Number(e.target.value) }))}
            />
            <Input
              label="Mínimo"
              type="number"
              min={0}
              value={stockForm.minStock}
              onChange={(e) => setStockForm((f) => ({ ...f, minStock: Number(e.target.value) }))}
            />
            <Input
              label="Unidad"
              value={stockForm.unit}
              onChange={(e) => setStockForm((f) => ({ ...f, unit: e.target.value.slice(0, 12) }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setStockDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void (stockDialog?.inventoryItemId ? adjustStock() : linkStock())}
              disabled={createInventoryItem.isPending || addRecipeIngredient.isPending || updateStock.isPending}
            >
              {createInventoryItem.isPending || addRecipeIngredient.isPending || updateStock.isPending
                ? "Guardando…"
                : stockDialog?.inventoryItemId
                  ? "Guardar existencias"
                  : "Ligar inventario"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Candidatos: artículos del menú que ya son productos ── */}
      {candidates.length > 0 && (
        <Card className="border border-white/5 bg-white/[0.02] p-6">
          <p className="text-xs font-bold text-gray-300">¿Ya lo vendes como platillo?</p>
          <p className="mt-1 text-[11px] text-gray-500">
            Estos artículos del menú podrían ser productos de tienda. Se cambia el tipo desde Menú;
            aquí no se duplica nada.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {candidates.map((item) => (
              <span
                key={item.id}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-gray-300"
              >
                {item.name}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
