"use client";

/**
 * ── Mi Negocio ── ÚNICO lugar para configurar el negocio.
 *
 * Antes estaba disperso: identidad y "acerca de" no existían como editor,
 * la sucursal (fiscal/contacto) vivía en /restaurants, y la operación del POS
 * (propinas, USD, tabs, Bunz, happy hour) estaba enterrada en /settings junto
 * a la seguridad de la cuenta. Aquí se centraliza por pestañas.
 *
 * Fuentes de datos (sin duplicar lógica):
 *   · identidad pública → settings.getBusinessProfile / updateBusinessProfile
 *   · sucursal + operación + Bunz → admin.getRestaurants / updateRestaurant
 *   · sonido de pedidos → pos.getOrderAlertSettings / setOrderAlertSound
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Store, Save, Globe, Clock, MapPin, Info, RefreshCw, Receipt, Volume2,
  Coins, Users, ChevronRight, Building2, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Card, Button, Input, toast } from "@rabbitty/ui";
import { trpc } from "../../../lib/trpc-client";

const DAYS = [
  { id: 1, label: "Lun" }, { id: 2, label: "Mar" }, { id: 3, label: "Mié" },
  { id: 4, label: "Jue" }, { id: 5, label: "Vie" }, { id: 6, label: "Sáb" },
  { id: 7, label: "Dom" },
];

type Tab = "perfil" | "sucursal" | "pos" | "bunz" | "equipo";

const TABS: Array<{ id: Tab; label: string; Icon: typeof Store }> = [
  { id: "perfil", label: "Perfil público", Icon: Info },
  { id: "sucursal", label: "Sucursal", Icon: Building2 },
  { id: "pos", label: "Operación POS", Icon: Receipt },
  { id: "bunz", label: "Bunz", Icon: Coins },
  { id: "equipo", label: "Equipo & Hardware", Icon: Users },
];

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div>
    <label className="text-[11px] font-bold text-gray-400">{label}</label>
    <div className="mt-1">{children}</div>
    {hint && <p className="text-[10px] text-gray-500 mt-1 m-0">{hint}</p>}
  </div>
);

const textInput = "bg-black/50 border-white/10 text-white text-xs h-9";

export default function BusinessProfilePage() {
  const [tab, setTab] = useState<Tab>("perfil");
  const utils = trpc.useUtils();

  // ── Identidad pública ──
  const profileQuery = trpc.settings.getBusinessProfile.useQuery(undefined, { retry: false });
  const saveProfile = trpc.settings.updateBusinessProfile.useMutation();
  const biz = profileQuery.data?.business ?? null;

  // ── Sucursal / operación ──
  const restaurantsQuery = trpc.admin.getRestaurants.useQuery(undefined, { retry: false });
  const updateRestaurant = trpc.admin.updateRestaurant.useMutation({
    onSuccess: () => {
      toast.success("✅ Guardado — ya aplica en el POS");
      void utils.admin.getRestaurants.invalidate();
    },
    onError: (e) => toast.error(e.message || "No se pudo guardar"),
  });
  const rest = (restaurantsQuery.data as Array<Record<string, unknown>> | undefined)?.[0] ?? null;
  const restaurantId = typeof rest?.id === "string" ? rest.id : null;

  // ── Canal de respuesta del chat del negocio ──
  const chatQuery = trpc.settings.getChatReplyChannel.useQuery(undefined, { retry: false });
  const setChatChannel = trpc.settings.setChatReplyChannel.useMutation({
    onSuccess: () => toast.success("✅ Canal del chat actualizado"),
    onError: () => toast.error("No se pudo guardar el canal del chat"),
  });

  // ── Sonido de pedidos ──
  const alertCfg = trpc.pos.getOrderAlertSettings.useQuery(undefined, { retry: false, staleTime: 60_000 });
  const setAlertSound = trpc.pos.setOrderAlertSound.useMutation({
    onSuccess: (r) => {
      toast.success(r.soundEnabled ? "🔔 Sonido activado" : "🔕 Sonido desactivado");
      void utils.pos.getOrderAlertSettings.invalidate();
    },
    onError: () => toast.error("No se pudo guardar el sonido"),
  });

  // ── Formularios ──
  const [form, setForm] = useState({
    name: "", description: "", address: "", website: "",
    startTime: "09:00", endTime: "21:00", timezone: "America/Mexico_City",
    activeDays: [1, 2, 3, 4, 5, 6, 7] as number[],
    rewardPercentage: "10",
    coverImageUrl: "", logoUrl: "",
  });

  const [branch, setBranch] = useState({
    name: "", slug: "", currency: "MXN", taxRate: "16", timezone: "America/Mexico_City",
    address: "", phone: "", email: "", legalName: "", rfc: "", taxRegime: "", ticketFooter: "",
  });

  const [pos, setPos] = useState({
    happyHourStart: "", happyHourEnd: "", happyHourRewardRate: "40",
    usdRateMode: "AUTO" as "AUTO" | "MANUAL", usdRate: "18",
    staleOrderHours: "12", showUsdTicket: false, tipPayoutEnabled: false,
    gratuityMode: "OFF" as "OFF" | "POS" | "DIGITAL" | "BOTH",
    gratuityPcts: [10] as number[],
  });

  const [bunz, setBunz] = useState({
    acceptsBunz: true,
    bunzAvailabilityMode: "ALWAYS" as "ALWAYS" | "SCHEDULE",
    bunzMinOrderAmount: "0", bunzMaxOrderAmount: "0",
    bunzDailyLimit: "0", bunzMaxPctOfBill: "100",
  });

  useEffect(() => {
    if (!biz) return;
    let days: number[] = [1, 2, 3, 4, 5, 6, 7];
    try {
      const parsed = JSON.parse(biz.activeDays || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) days = parsed.map(Number);
    } catch { /* default */ }
    setForm({
      name: biz.name ?? "",
      description: biz.description ?? "",
      address: biz.address ?? "",
      website: biz.website ?? "",
      startTime: biz.startTime ?? "09:00",
      endTime: biz.endTime ?? "21:00",
      timezone: biz.timezone ?? "America/Mexico_City",
      activeDays: days,
      rewardPercentage: String(biz.rewardPercentage ?? 10),
      coverImageUrl: (() => {
        try {
          const g = JSON.parse(biz.gallery || "[]");
          return Array.isArray(g) && typeof g[0] === "string" ? g[0] : "";
        } catch { return ""; }
      })(),
      logoUrl: biz.logoUrl ?? "",
    });
  }, [biz]);

  useEffect(() => {
    if (!rest) return;
    const r = rest;
    setBranch({
      name: String(r.name ?? ""),
      slug: String(r.slug ?? ""),
      currency: String(r.currency ?? "MXN"),
      taxRate: String(Math.round(Number(r.taxRate ?? 0.16) * 100)),
      timezone: String(r.timezone ?? "America/Mexico_City"),
      address: String(r.address ?? ""),
      phone: String(r.phone ?? ""),
      email: String(r.email ?? ""),
      legalName: String(r.legalName ?? ""),
      rfc: String(r.rfc ?? ""),
      taxRegime: String(r.taxRegime ?? ""),
      ticketFooter: String(r.ticketFooter ?? ""),
    });
    setPos({
      happyHourStart: String(r.happyHourStart ?? ""),
      happyHourEnd: String(r.happyHourEnd ?? ""),
      happyHourRewardRate: String(r.happyHourRewardRate ?? 40),
      usdRateMode: (String(r.usdRateMode ?? "AUTO") === "MANUAL" ? "MANUAL" : "AUTO") as "AUTO" | "MANUAL",
      usdRate: String(r.usdRate ?? 18),
      staleOrderHours: String(r.staleOrderHours ?? 12),
      showUsdTicket: Boolean(r.showUsdTicket),
      tipPayoutEnabled: Boolean(r.tipPayoutEnabled),
      gratuityMode: (["OFF", "POS", "DIGITAL", "BOTH"].includes(String(r.gratuityMode)) ? String(r.gratuityMode) : "OFF") as "OFF" | "POS" | "DIGITAL" | "BOTH",
      gratuityPcts: (() => {
        try {
          const parsed = JSON.parse(String(r.gratuityPcts ?? "[]"));
          return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(Number) : [10];
        } catch { return [10]; }
      })(),
    });
    setBunz({
      acceptsBunz: Boolean(r.acceptsBunz ?? true),
      bunzAvailabilityMode: (String(r.bunzAvailabilityMode ?? "ALWAYS") === "SCHEDULE" ? "SCHEDULE" : "ALWAYS") as "ALWAYS" | "SCHEDULE",
      bunzMinOrderAmount: String(r.bunzMinOrderAmount ?? 0),
      bunzMaxOrderAmount: String(r.bunzMaxOrderAmount ?? 0),
      bunzDailyLimit: String(r.bunzDailyLimit ?? 0),
      bunzMaxPctOfBill: String(r.bunzMaxPctOfBill ?? 100),
    });
  }, [rest]);

  const loading = profileQuery.isLoading || restaurantsQuery.isLoading;

  const savePublic = async () => {
    if (!form.name.trim()) return toast.error("El nombre no puede quedar vacío");
    if (form.activeDays.length === 0) return toast.error("Selecciona al menos un día de servicio");
    try {
      await saveProfile.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim() || null,
        address: form.address.trim(),
        website: form.website.trim() || null,
        activeDays: form.activeDays,
        startTime: form.startTime,
        endTime: form.endTime,
        timezone: form.timezone,
        rewardPercentage: Number(form.rewardPercentage) || 10,
        coverImageUrl: form.coverImageUrl.trim() || null,
        logoUrl: form.logoUrl.trim() || null,
      });
      toast.success("✅ Perfil actualizado — ya se ve en la app");
      void utils.settings.getBusinessProfile.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    }
  };

  const saveBranch = async () => {
    if (!restaurantId) return toast.error("No hay sucursal asociada");
    try {
      await updateRestaurant.mutateAsync({
        id: restaurantId,
        name: branch.name.trim() || undefined,
        slug: branch.slug.trim() || undefined,
        currency: branch.currency || "MXN",
        taxRate: (Number(branch.taxRate) || 0) / 100,
        timezone: branch.timezone,
        address: branch.address || null,
        phone: branch.phone || null,
        email: branch.email || null,
        legalName: branch.legalName || null,
        rfc: branch.rfc || null,
        taxRegime: branch.taxRegime || null,
        ticketFooter: branch.ticketFooter || null,
      });
    } catch { /* toast ya lo muestra */ }
  };

  const savePos = async () => {
    if (!restaurantId) return toast.error("No hay sucursal asociada");
    try {
      await updateRestaurant.mutateAsync({
        id: restaurantId,
        happyHourStart: pos.happyHourStart || null,
        happyHourEnd: pos.happyHourEnd || null,
        happyHourRewardRate: Number(pos.happyHourRewardRate) || null,
        usdRateMode: pos.usdRateMode,
        usdRate: Number(pos.usdRate) || 18,
        staleOrderHours: Number(pos.staleOrderHours) || 12,
        showUsdTicket: pos.showUsdTicket,
        tipPayoutEnabled: pos.tipPayoutEnabled,
        gratuityMode: pos.gratuityMode,
        gratuityPcts: pos.gratuityPcts,
      });
    } catch { /* toast */ }
  };

  const saveBunz = async () => {
    if (!restaurantId) return toast.error("No hay sucursal asociada");
    try {
      await updateRestaurant.mutateAsync({
        id: restaurantId,
        acceptsBunz: bunz.acceptsBunz,
        bunzAvailabilityMode: bunz.bunzAvailabilityMode,
        bunzMinOrderAmount: Number(bunz.bunzMinOrderAmount) || 0,
        bunzMaxOrderAmount: Number(bunz.bunzMaxOrderAmount) || 0,
        bunzDailyLimit: Number(bunz.bunzDailyLimit) || 0,
        bunzMaxPctOfBill: Number(bunz.bunzMaxPctOfBill) || 100,
      });
    } catch { /* toast */ }
  };

  const dirtyCount = useMemo(() => 0, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] p-6 lg:p-10">
        <div className="max-w-3xl mx-auto text-sm text-gray-400">Cargando tu negocio…</div>
      </div>
    );
  }

  if (!biz && !restaurantId) {
    return (
      <div className="min-h-screen bg-[#050508] p-6 lg:p-10">
        <div className="max-w-3xl mx-auto space-y-3">
          <h1 className="text-2xl font-black text-white">Mi negocio</h1>
          <p className="text-sm text-gray-400">
            Esta cuenta no tiene un comercio afiliado. Si eres staff, pide al dueño que lo configure.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] p-6 lg:p-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-pink-500/15 border border-pink-500/30">
            <Store className="h-7 w-7 text-pink-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-white m-0">Mi negocio</h1>
            <p className="text-xs text-gray-400 m-0 truncate">
              Todo lo que ve el Rabbitter y cómo opera tu POS, en un solo lugar
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => { void profileQuery.refetch(); void restaurantsQuery.refetch(); }}
            className="ml-auto rounded-xl bg-white/5 border border-white/10 text-gray-200 text-xs font-bold cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto p-1 rounded-2xl bg-white/5 border border-white/10 scrollbar-hide">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                tab === id ? "bg-pink-500/25 text-pink-100" : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── PERFIL PÚBLICO ── */}
        {tab === "perfil" && (
          <div className="space-y-4">
            <Card className="p-5 border border-white/10 bg-white/5 space-y-3">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 m-0">
                <Info className="h-4 w-4 text-pink-400" /> Lo que ve el Rabbitter
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Nombre del negocio">
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={textInput} />
                </Field>
                <Field label="Categoría" hint="La define Rabbitty al dar de alta (afecta el tema del feed)">
                  <div className="h-9 rounded-lg bg-black/30 border border-white/10 text-gray-400 text-xs px-2 flex items-center">
                    {biz?.category || "Sin categoría"}
                  </div>
                </Field>
              </div>
              <Field label="Acerca de" hint={`${form.description.length}/600 · aparece en la pestaña del negocio`}>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  maxLength={600}
                  placeholder="Qué te hace especial, qué sirves, el ambiente…"
                  className="w-full rounded-lg bg-black/50 border border-white/10 text-white text-xs p-2.5 resize-none"
                />
              </Field>
            </Card>

            <Card className="p-5 border border-white/10 bg-white/5 space-y-3">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 m-0">
                <MapPin className="h-4 w-4 text-emerald-400" /> Ubicación & sitio
              </h2>
              <Field label="Dirección">
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={textInput} />
              </Field>
              <Field label="Sitio web" hint="Vacío = la app no muestra el bloque 'Sitio Web Oficial'">
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="midominio.com" className={textInput} />
              </Field>
            </Card>

            <Card className="p-5 border border-white/10 bg-white/5 space-y-3">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 m-0">
                <Sparkles className="h-4 w-4 text-pink-400" /> Portada y logo
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Portada (URL)" hint="Es la imagen del home y del feed. Vacío = pool temático de Rabbitty.">
                  <Input
                    value={form.coverImageUrl}
                    onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
                    placeholder="https://…/portada.webp"
                    className={textInput}
                  />
                </Field>
                <Field label="Logo (URL)" hint="Sale en la tarjeta de seguimiento y en el POS.">
                  <Input
                    value={form.logoUrl}
                    onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                    placeholder="https://…/logo.png"
                    className={textInput}
                  />
                </Field>
              </div>
              {(form.coverImageUrl || form.logoUrl) && (
                <div className="flex items-center gap-3 pt-1">
                  {form.coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.coverImageUrl} alt="Portada" className="h-16 w-28 object-cover rounded-xl border border-white/10" />
                  )}
                  {form.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logoUrl} alt="Logo" className="h-16 w-16 object-cover rounded-xl border border-white/10" />
                  )}
                </div>
              )}
            </Card>

            <Card className="p-5 border border-white/10 bg-white/5 space-y-3">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 m-0">
                <Clock className="h-4 w-4 text-amber-400" /> Horario de servicio
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        activeDays: f.activeDays.includes(d.id)
                          ? f.activeDays.filter((x) => x !== d.id)
                          : [...f.activeDays, d.id].sort(),
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer border ${
                      form.activeDays.includes(d.id)
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                        : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Abre">
                  <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={textInput} />
                </Field>
                <Field label="Cierra">
                  <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={textInput} />
                </Field>
                <Field label="Zona horaria">
                  <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className={textInput} />
                </Field>
              </div>
              <Field label="Cashback Bunz (%)">
                <Input
                  inputMode="numeric"
                  value={form.rewardPercentage}
                  onChange={(e) => setForm({ ...form, rewardPercentage: e.target.value.replace(/[^\d]/g, "") })}
                  className={`${textInput} w-24`}
                />
              </Field>
            </Card>

            <Card className="p-5 border border-white/10 bg-white/5 space-y-3">
              <h2 className="text-sm font-black text-white uppercase tracking-wider m-0">💬 Atención por chat</h2>
              <Field label="¿Quién responde a los Rabbitters?" hint="Aplica a la bandeja del negocio y a las notificaciones de mensaje.">
                <select
                  value={chatQuery.data?.chatReplyChannel ?? "hybrid"}
                  onChange={(e) => setChatChannel.mutate({ channel: e.target.value as "hybrid" | "telegram" | "admin" | "mobile" })}
                  className="w-full rounded-lg border border-white/10 text-white text-xs h-9 px-2 bg-black/50"
                >
                  <option value="hybrid">Híbrido (app + Telegram)</option>
                  <option value="mobile">Solo app móvil</option>
                  <option value="admin">Solo admin (web)</option>
                  <option value="telegram">Solo Telegram</option>
                </select>
              </Field>
            </Card>

            <div className="flex items-center justify-end pb-8">
              <Button onClick={() => void savePublic()} disabled={saveProfile.isPending}
                className="rounded-xl px-4 py-2 text-xs font-black bg-linear-to-r from-pink-600 to-purple-600 text-white cursor-pointer disabled:opacity-50">
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {saveProfile.isPending ? "Guardando…" : "Guardar perfil"}
              </Button>
            </div>
          </div>
        )}

        {/* ── SUCURSAL ── */}
        {tab === "sucursal" && (
          <div className="space-y-4">
            <Card className="p-5 border border-white/10 bg-white/5 space-y-3">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 m-0">
                <Building2 className="h-4 w-4 text-cyan-400" /> Identidad de la sucursal
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Nombre en el ticket">
                  <Input value={branch.name} onChange={(e) => setBranch({ ...branch, name: e.target.value })} className={textInput} />
                </Field>
                <Field label="Slug (QR / links)" hint="minúsculas, números y guiones">
                  <Input value={branch.slug} onChange={(e) => setBranch({ ...branch, slug: e.target.value })} className={textInput} />
                </Field>
                <Field label="Dirección">
                  <Input value={branch.address} onChange={(e) => setBranch({ ...branch, address: e.target.value })} className={textInput} />
                </Field>
                <Field label="Teléfono">
                  <Input value={branch.phone} onChange={(e) => setBranch({ ...branch, phone: e.target.value })} className={textInput} />
                </Field>
                <Field label="Email de contacto">
                  <Input value={branch.email} onChange={(e) => setBranch({ ...branch, email: e.target.value })} className={textInput} />
                </Field>
                <Field label="Pie del ticket" hint="Mensaje que sale impreso abajo">
                  <Input value={branch.ticketFooter} onChange={(e) => setBranch({ ...branch, ticketFooter: e.target.value })} className={textInput} />
                </Field>
              </div>
            </Card>

            <Card className="p-5 border border-white/10 bg-white/5 space-y-3">
              <h2 className="text-sm font-black text-white uppercase tracking-wider m-0">🧾 Datos fiscales</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Razón social">
                  <Input value={branch.legalName} onChange={(e) => setBranch({ ...branch, legalName: e.target.value })} className={textInput} />
                </Field>
                <Field label="RFC">
                  <Input value={branch.rfc} onChange={(e) => setBranch({ ...branch, rfc: e.target.value })} className={textInput} />
                </Field>
                <Field label="Régimen fiscal">
                  <Input value={branch.taxRegime} onChange={(e) => setBranch({ ...branch, taxRegime: e.target.value })} className={textInput} />
                </Field>
                <Field label="Moneda">
                  <Input value={branch.currency} onChange={(e) => setBranch({ ...branch, currency: e.target.value })} className={textInput} />
                </Field>
                <Field label="IVA (%)">
                  <Input inputMode="numeric" value={branch.taxRate} onChange={(e) => setBranch({ ...branch, taxRate: e.target.value.replace(/[^\d.]/g, "") })} className={textInput} />
                </Field>
                <Field label="Zona horaria">
                  <Input value={branch.timezone} onChange={(e) => setBranch({ ...branch, timezone: e.target.value })} className={textInput} />
                </Field>
              </div>
            </Card>

            <div className="flex items-center justify-end pb-8">
              <Button onClick={() => void saveBranch()} disabled={updateRestaurant.isPending}
                className="rounded-xl px-4 py-2 text-xs font-black bg-linear-to-r from-cyan-600 to-blue-600 text-white cursor-pointer disabled:opacity-50">
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {updateRestaurant.isPending ? "Guardando…" : "Guardar sucursal"}
              </Button>
            </div>
          </div>
        )}

        {/* ── POS ── */}
        {tab === "pos" && (
          <div className="space-y-4">
            <Card className="p-5 border border-white/10 bg-white/5 space-y-3">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 m-0">
                <Receipt className="h-4 w-4 text-amber-400" /> Caja y ticket
              </h2>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Happy Hour desde">
                  <Input type="time" value={pos.happyHourStart} onChange={(e) => setPos({ ...pos, happyHourStart: e.target.value })} className={textInput} />
                </Field>
                <Field label="Happy Hour hasta">
                  <Input type="time" value={pos.happyHourEnd} onChange={(e) => setPos({ ...pos, happyHourEnd: e.target.value })} className={textInput} />
                </Field>
                <Field label="% Bunz en Happy Hour">
                  <Input inputMode="numeric" value={pos.happyHourRewardRate} onChange={(e) => setPos({ ...pos, happyHourRewardRate: e.target.value.replace(/[^\d]/g, "") })} className={textInput} />
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Tipo de cambio USD">
                  <select
                    value={pos.usdRateMode}
                    onChange={(e) => setPos({ ...pos, usdRateMode: e.target.value as "AUTO" | "MANUAL" })}
                    className={`w-full rounded-lg border border-white/10 text-white text-xs h-9 px-2 bg-black/50`}
                  >
                    <option value="AUTO">Automático (API)</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </Field>
                <Field label="MXN por USD">
                  <Input inputMode="decimal" value={pos.usdRate} onChange={(e) => setPos({ ...pos, usdRate: e.target.value.replace(/[^\d.]/g, "") })} className={textInput} />
                </Field>
              </div>
              <Field label="Horas antes de expirar una comanda sin pagar (1–72)" hint="Barrido automático de tabs huérfanas">
                <Input inputMode="numeric" value={pos.staleOrderHours} onChange={(e) => setPos({ ...pos, staleOrderHours: e.target.value.replace(/[^\d]/g, "") })} className={`${textInput} w-24`} />
              </Field>
            </Card>

            <Card className="p-5 border border-white/10 bg-white/5 space-y-3">
              <h2 className="text-sm font-black text-white uppercase tracking-wider m-0">🔔 Avisos y propinas</h2>

              <div className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl bg-black/40 border border-white/5">
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-gray-100 m-0">Sonido al entrar un pedido</p>
                  <p className="text-[11px] text-gray-500 m-0">Alerta a pantalla completa + dos tonos.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={alertCfg.data?.soundEnabled !== false}
                  onClick={() => setAlertSound.mutate({ enabled: !(alertCfg.data?.soundEnabled !== false) })}
                  disabled={setAlertSound.isPending}
                  className={`shrink-0 px-3 py-2 rounded-xl text-[11px] font-black border cursor-pointer ${
                    alertCfg.data?.soundEnabled !== false
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : "bg-white/5 border-white/10 text-gray-400"
                  }`}
                >
                  {alertCfg.data?.soundEnabled !== false ? "🔔 Activo" : "🔕 Silencio"}
                </button>
              </div>

              {[
                { key: "showUsdTicket" as const, label: "Mostrar USD en el ticket", hint: "Solo si cobras en dólares" },
                { key: "tipPayoutEnabled" as const, label: "Propinas de tarjeta pagables en caja", hint: "Se liquidan al cerrar turno" },
              ].map(({ key, label, hint }) => (
                <div key={key} className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl bg-black/40 border border-white/5">
                  <div className="min-w-0">
                    <p className="text-[12px] font-black text-gray-100 m-0">{label}</p>
                    <p className="text-[11px] text-gray-500 m-0">{hint}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={pos[key]}
                    onClick={() => setPos({ ...pos, [key]: !pos[key] })}
                    className={`shrink-0 w-12 h-6.5 rounded-full transition-colors cursor-pointer ${pos[key] ? "bg-emerald-500" : "bg-white/15"}`}
                  >
                    <span className={`block h-5.5 w-5.5 rounded-full bg-white shadow transition-transform ${pos[key] ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              ))}

              <Field label="Gratificación voluntaria en el POS" hint="Catálogo controlado por Rabbitty (5/10/15%)">
                <select
                  value={pos.gratuityMode}
                  onChange={(e) => setPos({ ...pos, gratuityMode: e.target.value as "OFF" | "POS" | "DIGITAL" | "BOTH" })}
                  className="w-full rounded-lg border border-white/10 text-white text-xs h-9 px-2 bg-black/50"
                >
                  <option value="OFF">Desactivada</option>
                  <option value="POS">Solo POS presencial</option>
                  <option value="DIGITAL">Solo digital (próximamente)</option>
                  <option value="BOTH">POS + digital</option>
                </select>
              </Field>

              {pos.gratuityMode !== "OFF" && (
                <Field label="Opciones que ve el cajero" hint="Catálogo fijo de Rabbitty — el cajero no puede inventar porcentajes.">
                  <div className="flex gap-2">
                    {[5, 10, 15].map((pct) => {
                      const active = pos.gratuityPcts.includes(pct);
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() =>
                            setPos({
                              ...pos,
                              gratuityPcts: active
                                ? (pos.gratuityPcts.filter((x) => x !== pct).length > 0
                                    ? pos.gratuityPcts.filter((x) => x !== pct)
                                    : pos.gratuityPcts)
                                : [...pos.gratuityPcts, pct].sort((a, b) => a - b),
                            })
                          }
                          className={`px-4 py-2 rounded-xl text-xs font-black border cursor-pointer transition-all ${
                            active
                              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                              : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                          }`}
                        >
                          {pct}%
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}
            </Card>

            <div className="flex items-center justify-end pb-8">
              <Button onClick={() => void savePos()} disabled={updateRestaurant.isPending}
                className="rounded-xl px-4 py-2 text-xs font-black bg-linear-to-r from-amber-600 to-orange-600 text-white cursor-pointer disabled:opacity-50">
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {updateRestaurant.isPending ? "Guardando…" : "Guardar operación"}
              </Button>
            </div>
          </div>
        )}

        {/* ── BUNZ ── */}
        {tab === "bunz" && (
          <div className="space-y-4">
            <Card className="p-5 border border-white/10 bg-white/5 space-y-3">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 m-0">
                <Coins className="h-4 w-4 text-pink-400" /> Pagos con Bunz
              </h2>
              <div className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl bg-black/40 border border-white/5">
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-gray-100 m-0">Aceptar Bunz como pago</p>
                  <p className="text-[11px] text-gray-500 m-0">Los Rabbitters pagan parte o todo con Bunz</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={bunz.acceptsBunz}
                  onClick={() => setBunz({ ...bunz, acceptsBunz: !bunz.acceptsBunz })}
                  className={`shrink-0 w-12 h-6.5 rounded-full transition-colors cursor-pointer ${bunz.acceptsBunz ? "bg-emerald-500" : "bg-white/15"}`}
                >
                  <span className={`block h-5.5 w-5.5 rounded-full bg-white shadow transition-transform ${bunz.acceptsBunz ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Disponibilidad">
                  <select
                    value={bunz.bunzAvailabilityMode}
                    onChange={(e) => setBunz({ ...bunz, bunzAvailabilityMode: e.target.value as "ALWAYS" | "SCHEDULE" })}
                    className="w-full rounded-lg border border-white/10 text-white text-xs h-9 px-2 bg-black/50"
                  >
                    <option value="ALWAYS">Siempre</option>
                    <option value="SCHEDULE">Por horario</option>
                  </select>
                </Field>
                <Field label="Mínimo de compra ($)" hint="0 = sin mínimo">
                  <Input inputMode="decimal" value={bunz.bunzMinOrderAmount} onChange={(e) => setBunz({ ...bunz, bunzMinOrderAmount: e.target.value.replace(/[^\d.]/g, "") })} className={textInput} />
                </Field>
                <Field label="Máximo de compra ($)" hint="0 = sin máximo">
                  <Input inputMode="decimal" value={bunz.bunzMaxOrderAmount} onChange={(e) => setBunz({ ...bunz, bunzMaxOrderAmount: e.target.value.replace(/[^\d.]/g, "") })} className={textInput} />
                </Field>
                <Field label="% máximo de la cuenta pagable con Bunz">
                  <Input inputMode="numeric" value={bunz.bunzMaxPctOfBill} onChange={(e) => setBunz({ ...bunz, bunzMaxPctOfBill: e.target.value.replace(/[^\d]/g, "") })} className={textInput} />
                </Field>
                <Field label="Límite de Bunz por día" hint="0 = sin límite">
                  <Input inputMode="numeric" value={bunz.bunzDailyLimit} onChange={(e) => setBunz({ ...bunz, bunzDailyLimit: e.target.value.replace(/[^\d]/g, "") })} className={textInput} />
                </Field>
              </div>
            </Card>

            <div className="flex items-center justify-end pb-8">
              <Button onClick={() => void saveBunz()} disabled={updateRestaurant.isPending}
                className="rounded-xl px-4 py-2 text-xs font-black bg-linear-to-r from-pink-600 to-purple-600 text-white cursor-pointer disabled:opacity-50">
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {updateRestaurant.isPending ? "Guardando…" : "Guardar Bunz"}
              </Button>
            </div>
          </div>
        )}

        {/* ── EQUIPO ── */}
        {tab === "equipo" && (
          <div className="space-y-3 pb-8">
            {[
              { href: "/staff", title: "Personal & roles", desc: "Empleados, permisos y PIN de caja", Icon: Users },
              { href: "/hardware", title: "Impresoras & hardware", desc: "Térmica, cajón, Bluetooth", Icon: Receipt },
              { href: "/menu", title: "Menú & productos", desc: "Platillos, precios y categorías", Icon: Sparkles },
              { href: "/restaurants", title: "Sucursales & afiliados", desc: "Altas, estado y aprobaciones", Icon: Building2 },
            ].map(({ href, title, desc, Icon }) => (
              <Link key={href} href={href} className="block no-underline">
                <Card className="p-4 border border-white/10 bg-white/5 hover:bg-white/8 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-gray-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black text-white m-0">{title}</p>
                      <p className="text-[11px] text-gray-500 m-0 truncate">{desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                  </div>
                </Card>
              </Link>
            ))}
            <p className="text-[11px] text-gray-500 text-center pt-2">
              {dirtyCount === 0 ? "Estos módulos viven en su propia pantalla porque son operativos, no configuración." : ""}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
