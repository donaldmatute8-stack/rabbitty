"use client";

import { useState, useEffect } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Input, toast } from "@rabbitty/ui";
import { 
  Store, DollarSign, Gift, Monitor, Edit3, Check, X, 
  Mail, Shield, Key, Smartphone, Fingerprint, Trash2, Plus, QrCode, 
  Coffee, UtensilsCrossed, Wine, Truck, ChefHat, Zap, Settings, 
  ToggleLeft, ToggleRight, Table2, Package, Users, CalendarCheck, 
  Sparkles, BookUser, Receipt
} from "lucide-react";
import { cn } from "@rabbitty/ui";

// ─────────────────────────────────────────────────────────────────
// BUSINESS TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────

type BusinessType = "restaurant" | "cafe" | "bar" | "dark_kitchen" | "food_truck";

interface BusinessPreset {
  id: BusinessType;
  label: string;
  emoji: string;
  icon: any;
  description: string;
  color: string;
  defaultModules: string[];
  optionalModules: string[];
}

const BUSINESS_PRESETS: BusinessPreset[] = [
  {
    id: "restaurant",
    label: "Restaurante",
    emoji: "🍽️",
    icon: UtensilsCrossed,
    description: "Servicio a la mesa, cocina compleja, reservas y eventos.",
    color: "from-pink-500/20 to-rose-500/10 border-pink-500/30",
    defaultModules: ["menu", "kitchen", "table_layout", "reservations", "staff", "inventory", "recipes", "expenses", "suppliers", "loyalty", "customers", "qr", "hardware"],
    optionalModules: ["catering", "pricing", "birthdays", "campaigns", "referrals", "menu_boards"],
  },
  {
    id: "cafe",
    label: "Café / Bakeshop",
    emoji: "☕",
    icon: Coffee,
    description: "Bebidas de especialidad, postres, servicio rápido.",
    color: "from-amber-500/20 to-yellow-500/10 border-amber-500/30",
    defaultModules: ["menu", "kitchen", "inventory", "expenses", "loyalty", "customers", "qr", "hardware"],
    optionalModules: ["table_layout", "reservations", "staff", "suppliers", "recipes", "catering", "pricing", "campaigns"],
  },
  {
    id: "bar",
    label: "Bar / Cantina",
    emoji: "🍹",
    icon: Wine,
    description: "Barras, cuentas abiertas, Happy Hour y control de licores.",
    color: "from-purple-500/20 to-violet-500/10 border-purple-500/30",
    defaultModules: ["menu", "kitchen", "table_layout", "staff", "inventory", "expenses", "pricing", "loyalty", "customers"],
    optionalModules: ["reservations", "suppliers", "recipes", "catering", "birthdays", "campaigns", "referrals", "menu_boards"],
  },
  {
    id: "dark_kitchen",
    label: "Dark Kitchen",
    emoji: "📦",
    icon: Truck,
    description: "Cocina virtual, despacho, inventario intensivo.",
    color: "from-blue-500/20 to-cyan-500/10 border-blue-500/30",
    defaultModules: ["menu", "kitchen", "inventory", "recipes", "expenses", "suppliers"],
    optionalModules: ["loyalty", "customers", "campaigns", "pricing", "staff"],
  },
  {
    id: "food_truck",
    label: "Food Truck",
    emoji: "🚚",
    icon: ChefHat,
    description: "Movilidad, menú simple, cobro rápido.",
    color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30",
    defaultModules: ["menu", "kitchen", "inventory", "expenses", "loyalty", "qr"],
    optionalModules: ["staff", "customers", "campaigns", "pricing"],
  },
];

interface ModuleConfig {
  id: string;
  label: string;
  description: string;
  icon: any;
  category: "operations" | "catalog" | "growth" | "config";
}

const ALL_MODULES: ModuleConfig[] = [
  { id: "menu", label: "Menú & Platillos", description: "Gestión del catálogo digital de alimentos", icon: UtensilsCrossed, category: "catalog" },
  { id: "kitchen", label: "Cocina / KDS", description: "Pantalla de cocina con comandas en tiempo real", icon: ChefHat, category: "operations" },
  { id: "table_layout", label: "Mapa de Mesas 2D", description: "Editor visual del salón y estado de mesas", icon: Table2, category: "operations" },
  { id: "reservations", label: "Reservaciones", description: "Control de reservas y lista de espera", icon: BookUser, category: "operations" },
  { id: "staff", label: "Personal & Roles", description: "Gestión de empleados y permisos por PIN", icon: Users, category: "config" },
  { id: "inventory", label: "Inventario & Stock", description: "Control de insumos y alertas de stock bajo", icon: Package, category: "catalog" },
  { id: "recipes", label: "Recetas & Escandallos", description: "Costos de platillos y margen de utilidad", icon: Sparkles, category: "catalog" },
  { id: "expenses", label: "Gastos Operativos", description: "Registro de egresos y compras del negocio", icon: Receipt, category: "catalog" },
  { id: "suppliers", label: "Proveedores", description: "Directorio de proveedores y órdenes de compra", icon: Truck, category: "catalog" },
  { id: "loyalty", label: "Cashback Bunz & Lealtad", description: "Sistema de puntos y fidelización de clientes", icon: Gift, category: "growth" },
  { id: "customers", label: "CRM de Clientes", description: "Directorio, historial y niveles de Rabbitters", icon: Users, category: "growth" },
  { id: "catering", label: "Eventos & Catering", description: "Gestión de banquetes y eventos privados", icon: CalendarCheck, category: "growth" },
  { id: "campaigns", label: "Campañas de Marketing", description: "Promociones segmentadas y push notifications", icon: Zap, category: "growth" },
  { id: "pricing", label: "Precios Dinámicos", description: "Precios por hora, Happy Hour y temporada", icon: DollarSign, category: "catalog" },
  { id: "birthdays", label: "Cumpleaños", description: "Automatización de promociones por cumpleaños", icon: Gift, category: "growth" },
  { id: "referrals", label: "Red de Referidos", description: "Comisiones y red de clientes embajadores", icon: Sparkles, category: "growth" },
  { id: "menu_boards", label: "Menú Digital TV", description: "Carteleras digitales para pantallas del local", icon: Monitor, category: "config" },
  { id: "qr", label: "Generador de QR", description: "QR para mesas, autoservicio y login Telegram", icon: QrCode, category: "config" },
  { id: "hardware", label: "Impresoras & POS Hardware", description: "Configuración de impresoras y dispositivos", icon: Settings, category: "config" },
];

const STORAGE_KEY = "rabbitty_business_type";
const MODULES_STORAGE_KEY = "rabbitty_active_modules";
const MODULES_CHANGED_EVENT = "rabbitty-modules-changed";

// Las tasas de recompensa se guardan como porcentaje entero (20 = 20%).
// Normaliza valores legacy almacenados como fracción (< 1) al percent.
const normalizePercent = (v: number | null | undefined, fallback = 20) => {
  if (v == null) return fallback;
  return v > 0 && v < 1 ? Math.round(v * 100) : v;
};

// btoa con String.fromCharCode(...bytes) rompe con buffers grandes (RangeError).
// Se codifica por chunks de 0x8000 bytes.
const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const persistModules = (modules: Set<string>) => {
  try {
    localStorage.setItem(MODULES_STORAGE_KEY, JSON.stringify([...modules]));
  } catch {
    // Almacenamiento no disponible o lleno — el estado en memoria sigue valiendo
  }
  window.dispatchEvent(new CustomEvent(MODULES_CHANGED_EVENT, { detail: { modules: [...modules] } }));
};

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const { data: restaurants, isLoading, error } = trpc.admin.getRestaurants.useQuery();
  const r = restaurants?.[0];

  const update = trpc.admin.updateRestaurant.useMutation({
    onSuccess: () => { utils.admin.getRestaurants.invalidate(); toast.success("Configuración actualizada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const profileQuery = trpc.settings.getProfile.useQuery();
  const securityQuery = trpc.settings.getSecuritySettings.useQuery();
  const updateEmail = trpc.settings.updateEmail.useMutation({ onSuccess: () => { utils.settings.getProfile.invalidate(); utils.settings.getSecuritySettings.invalidate(); toast.success("Correo actualizado"); }, onError: (e: any) => toast.error(e.message) });
  const updateWhatsApp = trpc.settings.updateWhatsApp.useMutation({ onSuccess: () => { utils.settings.getProfile.invalidate(); utils.settings.getSecuritySettings.invalidate(); toast.success("WhatsApp actualizado"); }, onError: (e: any) => toast.error(e.message) });
  const updateProfile = trpc.settings.updateProfile.useMutation({ onSuccess: () => { utils.settings.getProfile.invalidate(); toast.success("Perfil actualizado"); }, onError: (e: any) => toast.error(e.message) });
  const generateTotp = trpc.totp.generateSecret.useMutation({ onError: (e: any) => toast.error(e.message) });
  const verifyAndEnableTotp = trpc.totp.verifyAndEnable.useMutation({ onSuccess: () => { utils.settings.getSecuritySettings.invalidate(); toast.success("2FA activada"); }, onError: (e: any) => toast.error(e.message) });
  const disableTotp = trpc.totp.disable.useMutation({ onSuccess: () => { utils.settings.getSecuritySettings.invalidate(); toast.success("2FA desactivada"); }, onError: (e: any) => toast.error(e.message) });
  const toggleLoginReq = trpc.totp.toggleLoginRequirement.useMutation({ onSuccess: () => { utils.settings.getSecuritySettings.invalidate(); toast.success("Requisito de 2FA actualizado"); }, onError: (e: any) => toast.error(e.message) });
  const passkeysQuery = trpc.passkeys.list.useQuery();
  const generatePasskeyOptions = trpc.passkeys.generateRegistrationOptions.useMutation();
  const verifyPasskeyRegistration = trpc.passkeys.verifyRegistration.useMutation({ onSuccess: () => { utils.passkeys.list.invalidate(); toast.success("Passkey registrada"); }, onError: (e: any) => toast.error(e.message) });
  const deletePasskey = trpc.passkeys.delete.useMutation({ onSuccess: () => { utils.passkeys.list.invalidate(); toast.success("Passkey eliminada"); }, onError: (e: any) => toast.error(e.message) });
  const trustedSessionsQuery = trpc.trustedSessions.list.useQuery();
  const revokeSession = trpc.trustedSessions.revoke.useMutation({ onSuccess: () => { utils.trustedSessions.list.invalidate(); toast.success("Sesión revocada"); }, onError: (e: any) => toast.error(e.message) });
  const revokeAllSessions = trpc.trustedSessions.revokeAll.useMutation({ onSuccess: () => { utils.trustedSessions.list.invalidate(); toast.success("Todas las sesiones revocadas"); }, onError: (e: any) => toast.error(e.message) });

  const profile = profileQuery.data;
  const security = securityQuery.data;

  // ─── Business Type State (inicialización lazy desde localStorage) ───
  const [selectedType, setSelectedType] = useState<BusinessType>(() => {
    if (typeof window === "undefined") return "restaurant";
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as BusinessType | null;
      if (saved && BUSINESS_PRESETS.find((p) => p.id === saved)) return saved;
    } catch {
      // localStorage corrupto o bloqueado — default
    }
    return "restaurant";
  });
  const [activeModules, setActiveModules] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set(BUSINESS_PRESETS[0].defaultModules);
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as BusinessType | null;
      if (saved && BUSINESS_PRESETS.find((p) => p.id === saved)) {
        const savedModules = localStorage.getItem(MODULES_STORAGE_KEY);
        if (savedModules) {
          const parsed = JSON.parse(savedModules);
          if (Array.isArray(parsed)) return new Set(parsed);
        }
        return new Set(BUSINESS_PRESETS.find((p) => p.id === saved)!.defaultModules);
      }
    } catch {
      // localStorage corrupto o bloqueado — default
    }
    return new Set(BUSINESS_PRESETS[0].defaultModules);
  });
  const [activeTab, setActiveTab] = useState<"business" | "general" | "security">("business");

  // Form states
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", taxRate: 0, defaultRewardRate: 20, acceptsBunz: true, happyHourStart: "", happyHourEnd: "", happyHourRewardRate: 40 });
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [totpSecretData, setTotpSecretData] = useState<{ secret: string; qrCodeDataUrl: string; otpauth: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpDisableCode, setTotpDisableCode] = useState("");
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [emailVerifCode, setEmailVerifCode] = useState("");
  const [deletingPasskeyId, setDeletingPasskeyId] = useState<string | null>(null);
  const [deletePasskeyCode, setDeletePasskeyCode] = useState("");
  const [togglingRequireOff, setTogglingRequireOff] = useState(false);
  const [toggleReqCode, setToggleReqCode] = useState("");
  const [revokingAll, setRevokingAll] = useState(false);
  const [revokeAllCode, setRevokeAllCode] = useState("");

  // Load business type and modules from localStorage (lazy init arriba)

  const handleSelectType = (type: BusinessType) => {
    setSelectedType(type);
    const preset = BUSINESS_PRESETS.find((p) => p.id === type)!;
    const newModules = new Set(preset.defaultModules);
    setActiveModules(newModules);
    try {
      localStorage.setItem(STORAGE_KEY, type);
    } catch {
      // Almacenamiento no disponible
    }
    persistModules(newModules);
    toast.success(`Perfil de negocio cambiado a ${preset.label}`);
  };

  const toggleModule = (moduleId: string) => {
    const next = new Set(activeModules);
    if (next.has(moduleId)) {
      next.delete(moduleId);
    } else {
      next.add(moduleId);
    }
    setActiveModules(next);
    persistModules(next);
  };

  useEffect(() => {
    if (r) {
      setForm({ name: r.name, taxRate: r.taxRate, defaultRewardRate: normalizePercent(r.defaultRewardRate, 20), acceptsBunz: r.acceptsBunz ?? true, happyHourStart: r.happyHourStart ?? "", happyHourEnd: r.happyHourEnd ?? "", happyHourRewardRate: normalizePercent(r.happyHourRewardRate, 40) });
    }
  }, [r]);

  useEffect(() => {
    if (profile) {
      setEmail(profile.email ?? "");
      setWhatsapp(profile.supportWhatsApp ?? "");
      setFirstName(profile.firstName ?? "");
      setLastName(profile.lastName ?? "");
    }
  }, [profile]);

  const startEdit = (section: string) => {
    if (!r) return;
    setForm({ name: r.name, taxRate: r.taxRate, defaultRewardRate: normalizePercent(r.defaultRewardRate, 20), acceptsBunz: r.acceptsBunz ?? true, happyHourStart: r.happyHourStart ?? "", happyHourEnd: r.happyHourEnd ?? "", happyHourRewardRate: normalizePercent(r.happyHourRewardRate, 40) });
    setEditing(section);
  };

  const saveSection = () => { if (!r) return; update.mutate({ id: r.id, ...form }); setEditing(null); };

  const handleRegisterPasskey = async () => {
    setRegisteringPasskey(true);
    try {
      const options = await generatePasskeyOptions.mutateAsync();
      const credential = await navigator.credentials.create({ publicKey: options as any });
      if (!credential) { toast.error("Registro cancelado"); return; }
      const response = (credential as any).response;
      const transports = response.getTransports?.() ?? [];
      const credentialData = { id: credential.id, rawId: toBase64(new Uint8Array((credential as any).rawId)), response: { clientDataJSON: toBase64(new Uint8Array(response.clientDataJSON)), attestationObject: toBase64(new Uint8Array(response.attestationObject)), transports }, type: credential.type, clientExtensionResults: (credential as any).clientExtensionResults ?? {}, authenticatorAttachment: (credential as any).authenticatorAttachment ?? null };
      await verifyPasskeyRegistration.mutateAsync({ credential: credentialData, deviceName: `Passkey (${navigator.platform ?? "dispositivo"})` });
    } catch (e: any) { toast.error(e?.message ?? "Error al registrar passkey"); } finally { setRegisteringPasskey(false); }
  };

  const handleSetupTotp = async () => {
    try { const data = await generateTotp.mutateAsync(); setTotpSecretData(data); } catch (e: any) { toast.error(e.message); }
  };
  const handleVerifyTotp = async () => {
    try { await verifyAndEnableTotp.mutateAsync({ code: totpCode }); setTotpSecretData(null); setTotpCode(""); } catch (e: any) { toast.error(e.message); }
  };
  const handleDisableTotp = async () => {
    try { await disableTotp.mutateAsync({ code: totpDisableCode }); setTotpDisableCode(""); } catch (e: any) { toast.error(e.message); }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-pink-500 border-t-transparent mx-auto" />
          <p className="text-sm text-gray-400 font-bold">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  const currentPreset = BUSINESS_PRESETS.find(p => p.id === selectedType)!;

  return (
    <div className="space-y-8 pb-10">
      {/* ── Page Header ── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-pink-500">
              <Settings className="h-3.5 w-3.5" /> Sistema
            </span>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 mt-1">
              Configuración del Negocio
            </h1>
            <p className="text-gray-400 mt-1 text-sm font-medium">
              Perfil de negocio, módulos activos, ajustes generales y seguridad de cuenta.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
            {["business", "general", "security"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  "rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                  activeTab === tab ? "bg-pink-500/20 text-pink-400 border border-pink-500/30" : "text-gray-400 hover:text-white"
                )}
              >
                {tab === "business" ? "🏬 Negocio" : tab === "general" ? "⚙️ General" : "🔐 Seguridad"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300 font-semibold">
          No se pudieron cargar los datos del negocio: {error.message}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB: BUSINESS TYPE & MODULES
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "business" && (
        <div className="space-y-8">
          {/* Business Type Selector */}
          <div>
            <h2 className="text-lg font-black text-white mb-1 flex items-center gap-2">
              <span>Tipo de Negocio</span>
              <Badge variant="success" className="text-[10px]">Activo: {currentPreset.emoji} {currentPreset.label}</Badge>
            </h2>
            <p className="text-sm text-gray-400 mb-5">Elige el perfil que mejor describe tu operación. El sistema habilitará automáticamente los módulos más útiles para ti.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {BUSINESS_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isActive = selectedType === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectType(preset.id)}
                    className={cn(
                      "relative group flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all duration-300 cursor-pointer",
                      isActive
                        ? `bg-gradient-to-br ${preset.color} shadow-lg`
                        : "border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-3xl">{preset.emoji}</span>
                      {isActive && <div className="h-2.5 w-2.5 rounded-full bg-pink-500 shadow-[0_0_8px_#ec4899] animate-pulse" />}
                    </div>
                    <div>
                      <p className={cn("font-bold text-sm", isActive ? "text-white" : "text-gray-300")}>{preset.label}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{preset.description}</p>
                    </div>
                    <div className="text-[10px] text-gray-500 font-semibold mt-auto">
                      {preset.defaultModules.length} módulos base
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Module Feature Flags */}
          <div>
            <h2 className="text-lg font-black text-white mb-1 flex items-center gap-2">
              <Zap className="h-5 w-5 text-pink-400" /> Módulos Activos
            </h2>
            <p className="text-sm text-gray-400 mb-5">Activa o desactiva cualquier herramienta de forma individual. Los módulos desactivados se ocultan del menú lateral.</p>

            {(["operations", "catalog", "growth", "config"] as const).map((category) => {
              const categoryLabels = { operations: "⚡ Operación En Vivo", catalog: "🍔 Carta & Productos", growth: "🚀 Crecimiento & Lealtad", config: "⚙️ Configuración" };
              const categoryModules = ALL_MODULES.filter(m => m.category === category);
              return (
                <div key={category} className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 border-b border-white/5 pb-2">{categoryLabels[category]}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryModules.map((mod) => {
                      const Icon = mod.icon;
                      const isOn = activeModules.has(mod.id);
                      const isDefault = currentPreset.defaultModules.includes(mod.id);
                      return (
                        <button
                          key={mod.id}
                          onClick={() => toggleModule(mod.id)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer",
                            isOn
                              ? "border-pink-500/30 bg-pink-500/10 hover:bg-pink-500/15"
                              : "border-white/5 bg-white/5 hover:bg-white/10 opacity-60 hover:opacity-80"
                          )}
                        >
                          <div className={cn("p-2 rounded-lg border shrink-0", isOn ? "border-pink-500/30 bg-pink-500/20 text-pink-400" : "border-white/10 bg-white/5 text-gray-500")}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-xs font-bold truncate", isOn ? "text-white" : "text-gray-400")}>{mod.label}</p>
                            <p className="text-[10px] text-gray-500 truncate">{mod.description}</p>
                          </div>
                          <div className="shrink-0">
                            {isOn
                              ? <ToggleRight className="h-5 w-5 text-pink-400" />
                              : <ToggleLeft className="h-5 w-5 text-gray-600" />
                            }
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB: GENERAL
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "general" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Profile Card */}
          <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 shrink-0"><Store className="h-5 w-5" /></div>
                <h3 className="font-bold text-white text-base">Perfil del Restaurante</h3>
              </div>
              {editing !== "profile" ? (
                <button onClick={() => startEdit("profile")} className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"><Edit3 className="h-4 w-4" /></button>
              ) : (
                <div className="flex gap-1.5">
                  <button onClick={() => setEditing(null)} className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"><X className="h-4 w-4" /></button>
                  <button onClick={saveSection} className="rounded-xl border border-green-500/20 bg-green-500/10 p-2 text-green-400 hover:bg-green-500/20 transition-all cursor-pointer"><Check className="h-4 w-4" /></button>
                </div>
              )}
            </div>
            {editing === "profile" ? (
              <div className="space-y-3"><Input label="Nombre" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center py-0.5"><span className="text-gray-400 font-medium">Nombre</span><span className="font-bold text-white">{r?.name}</span></div>
                <div className="flex justify-between items-center py-0.5"><span className="text-gray-400 font-medium">Slug</span><span className="font-mono text-gray-300 bg-white/5 px-2 py-0.5 rounded border border-white/5 text-xs">{r?.slug}</span></div>
                <div className="flex justify-between items-center py-0.5"><span className="text-gray-400 font-medium">Estado</span><Badge variant={r?.isActive ? "success" : "danger"}>{r?.isActive ? "Activo" : "Inactivo"}</Badge></div>
              </div>
            )}
          </Card>

          {/* Billing Card */}
          <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0"><DollarSign className="h-5 w-5" /></div>
                <h3 className="font-bold text-white text-base">Facturación & Impuestos</h3>
              </div>
              {editing !== "billing" ? (
                <button onClick={() => startEdit("billing")} className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"><Edit3 className="h-4 w-4" /></button>
              ) : (
                <div className="flex gap-1.5">
                  <button onClick={() => setEditing(null)} className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 transition-all cursor-pointer"><X className="h-4 w-4" /></button>
                  <button onClick={saveSection} className="rounded-xl border border-green-500/20 bg-green-500/10 p-2 text-green-400 hover:bg-green-500/20 transition-all cursor-pointer"><Check className="h-4 w-4" /></button>
                </div>
              )}
            </div>
            {editing === "billing" ? (
              <Input label="Tasa de IVA (%)" type="number" value={form.taxRate * 100} onChange={(e) => setForm((f) => ({ ...f, taxRate: Number(e.target.value) / 100 }))} />
            ) : (
              <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center py-0.5"><span className="text-gray-400 font-medium">Moneda</span><span className="font-bold text-white uppercase">{r?.currency}</span></div>
                <div className="flex justify-between items-center py-0.5"><span className="text-gray-400 font-medium">Tasa de IVA</span><span className="font-bold text-white">{(r?.taxRate ?? 0) * 100}%</span></div>
                <div className="flex justify-between items-center py-0.5"><span className="text-gray-400 font-medium">Zona Horaria</span><span className="font-mono text-gray-300 bg-white/5 px-2 py-0.5 rounded border border-white/5 text-xs">{r?.timezone}</span></div>
              </div>
            )}
          </Card>

          {/* Bunz Rewards */}
          <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300 lg:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0"><Gift className="h-5 w-5" /></div>
                <div><h3 className="font-bold text-white text-base">Bunz Rewards & Happy Hour</h3><p className="text-xs text-gray-400">Configura la tasa de cashback y las horas de doble recompensa</p></div>
              </div>
              {editing !== "bunz" ? (
                <button onClick={() => startEdit("bunz")} className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"><Edit3 className="h-4 w-4" /></button>
              ) : (
                <div className="flex gap-1.5">
                  <button onClick={() => setEditing(null)} className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 cursor-pointer hover:bg-white/10 transition-all"><X className="h-4 w-4" /></button>
                  <button onClick={saveSection} className="rounded-xl border border-green-500/20 bg-green-500/10 p-2 text-green-400 cursor-pointer hover:bg-green-500/20 transition-all"><Check className="h-4 w-4" /></button>
                </div>
              )}
            </div>
            {editing === "bunz" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Input label="Tasa de recompensa (%)" type="number" value={form.defaultRewardRate} onChange={(e) => setForm((f) => ({ ...f, defaultRewardRate: Number(e.target.value) }))} />
                  <label className="flex items-center gap-2.5 text-sm text-gray-300 font-semibold cursor-pointer">
                    <input type="checkbox" checked={form.acceptsBunz} onChange={(e) => setForm((f) => ({ ...f, acceptsBunz: e.target.checked }))} className="h-5 w-5 rounded border-white/10 bg-white/5 text-pink-500 cursor-pointer" />
                    Acepta Bunz como forma de pago
                  </label>
                </div>
                <div className="rounded-2xl bg-white/5 p-5 border border-white/5">
                  <h4 className="mb-3 text-sm font-bold text-pink-400">Happy Hour (Bunz x2)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Hora Inicio" type="time" value={form.happyHourStart || ""} onChange={(e) => setForm((f) => ({ ...f, happyHourStart: e.target.value }))} />
                    <Input label="Hora Fin" type="time" value={form.happyHourEnd || ""} onChange={(e) => setForm((f) => ({ ...f, happyHourEnd: e.target.value }))} />
                    <div className="col-span-2">
                      <Input label="Recompensa Happy Hour (%)" type="number" value={form.happyHourRewardRate || 0} onChange={(e) => setForm((f) => ({ ...f, happyHourRewardRate: Number(e.target.value) }))} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <p className="text-2xl font-black text-pink-400">{r?.defaultRewardRate != null ? `${normalizePercent(r.defaultRewardRate, 20)}%` : "20%"}</p>
                  <p className="text-xs text-gray-400 mt-1">Cashback Bunz</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <p className="text-2xl font-black text-white">{r?.acceptsBunz ? "✅" : "❌"}</p>
                  <p className="text-xs text-gray-400 mt-1">Acepta Bunz</p>
                </div>
                <div className={cn("rounded-xl border p-4 text-center", r?.happyHourStart ? "border-pink-500/20 bg-pink-500/10" : "border-white/5 bg-white/5")}>
                  <p className="text-sm font-bold text-pink-300">{r?.happyHourStart && r?.happyHourEnd ? `${r.happyHourStart} - ${r.happyHourEnd}` : "Sin Happy Hour"}</p>
                  <p className="text-xs text-gray-400 mt-1">{r?.happyHourRewardRate ? `×${normalizePercent(r.happyHourRewardRate, 40)}% Bunz` : "Happy Hour"}</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB: SECURITY
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "security" && (
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-6 backdrop-blur-xl">
            <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex items-center gap-3">
              <Shield className="h-7 w-7 text-pink-400" />
              <div>
                <h2 className="text-2xl font-black text-white">Seguridad de la Cuenta</h2>
                <p className="text-gray-400 text-sm">Correo, WhatsApp, 2FA, Passkeys y dispositivos confiables</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* INFO PERSONAL */}
            <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0"><Mail className="h-5 w-5" /></div>
                <h3 className="font-bold text-white text-base">Correo y Contacto</h3>
              </div>
              {profile ? (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Correo Electrónico</label>
                    <div className="flex gap-2 mt-2">
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
                      {security?.totpEnabled ? (
                        <div className="flex gap-2">
                          <Input value={emailVerifCode} onChange={(e) => setEmailVerifCode(e.target.value)} placeholder="Código 2FA" maxLength={6} className="w-28 text-center" />
                          <Button size="sm" variant="secondary" onClick={() => { updateEmail.mutate({ email, verificationCode: emailVerifCode }); setEmailVerifCode(""); }} disabled={updateEmail.isPending || emailVerifCode.length !== 6}><Check className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => updateEmail.mutate({ email })} disabled={updateEmail.isPending}><Check className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">WhatsApp (Soporte)</label>
                    <div className="flex gap-2 mt-2">
                      <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+521234567890" />
                      <Button size="sm" variant="secondary" onClick={() => updateWhatsApp.mutate({ supportWhatsApp: whatsapp })} disabled={updateWhatsApp.isPending}><Check className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre</label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nombre" /></div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Apellido</label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellido" /></div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => updateProfile.mutate({ firstName, lastName })} disabled={updateProfile.isPending}>Guardar Perfil</Button>
                </div>
              ) : <p className="text-sm text-gray-400">Cargando...</p>}
            </Card>

            {/* 2FA */}
            <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0"><Key className="h-5 w-5" /></div>
                <h3 className="font-bold text-white text-base">Autenticación en Dos Pasos (2FA)</h3>
              </div>
              {security?.totpEnabled ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2"><Badge variant="success">Activado</Badge><span className="text-xs text-gray-400">Usa tu app de autenticación</span></div>
                  <label className="flex items-center gap-2.5 text-sm text-gray-300 font-semibold cursor-pointer">
                    <input type="checkbox" checked={security.requireTotpForLogin} onChange={(e) => { if (!e.target.checked && security.totpEnabled) { setTogglingRequireOff(true); } else { toggleLoginReq.mutate({ require: e.target.checked }); } }} className="h-5 w-5 rounded border-white/10 bg-white/5 text-pink-500 cursor-pointer" />
                    Requerir 2FA para iniciar sesión
                  </label>
                  {togglingRequireOff && (
                    <div className="flex gap-2">
                      <Input value={toggleReqCode} onChange={(e) => setToggleReqCode(e.target.value)} placeholder="Código 2FA" maxLength={6} className="w-36" />
                      <Button size="sm" variant="secondary" onClick={() => { toggleLoginReq.mutate({ require: false, verificationCode: toggleReqCode }); setToggleReqCode(""); setTogglingRequireOff(false); }} disabled={toggleLoginReq.isPending || toggleReqCode.length !== 6}>Confirmar</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setTogglingRequireOff(false); setToggleReqCode(""); }}>Cancelar</Button>
                    </div>
                  )}
                  <div className="border-t border-white/5 pt-4">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Desactivar 2FA</label>
                    <div className="flex gap-2">
                      <Input value={totpDisableCode} onChange={(e) => setTotpDisableCode(e.target.value)} placeholder="Código de 6 dígitos" maxLength={6} />
                      <Button size="sm" variant="danger" onClick={handleDisableTotp} disabled={disableTotp.isPending || totpDisableCode.length !== 6}>Desactivar</Button>
                    </div>
                  </div>
                </div>
              ) : totpSecretData ? (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-gray-300">Escanea este QR con tu app de autenticación</p>
                  <div className="flex justify-center"><img src={totpSecretData.qrCodeDataUrl} alt="TOTP QR" className="w-48 h-48 rounded-2xl bg-white p-2" /></div>
                  <p className="text-xs text-gray-500 break-all font-mono bg-white/5 p-2 rounded">{totpSecretData.secret}</p>
                  <div className="flex gap-2 max-w-xs mx-auto">
                    <Input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="Código de 6 dígitos" maxLength={6} />
                    <Button size="sm" onClick={handleVerifyTotp} disabled={verifyAndEnableTotp.isPending || totpCode.length !== 6}><Check className="h-4 w-4" /></Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">Protege tu cuenta con un segundo factor usando Google Authenticator, Authy o cualquier app compatible con TOTP.</p>
                  <Button onClick={handleSetupTotp} disabled={generateTotp.isPending}><QrCode className="h-4 w-4" />Configurar 2FA</Button>
                </div>
              )}
            </Card>

            {/* PASSKEYS */}
            <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 shrink-0"><Fingerprint className="h-5 w-5" /></div>
                <h3 className="font-bold text-white text-base">Passkeys (Biométricos)</h3>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-gray-400">Usa huella digital, rostro o PIN de tu dispositivo para iniciar sesión de forma rápida y segura.</p>
                {passkeysQuery.data && passkeysQuery.data.length > 0 && (
                  <div className="space-y-2">
                    {passkeysQuery.data.map((pk) => (
                      <div key={pk.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/5">
                        <div className="flex items-center gap-3">
                          <Fingerprint className="h-4 w-4 text-violet-400" />
                          <span className="text-sm text-white font-medium">{pk.deviceName}</span>
                          <span className="text-xs text-gray-500">{pk.createdAt ? new Date(pk.createdAt).toLocaleDateString() : ""}</span>
                        </div>
                        {deletingPasskeyId === pk.id && security?.totpEnabled ? (
                          <div className="flex gap-2 items-center">
                            <Input value={deletePasskeyCode} onChange={(e) => setDeletePasskeyCode(e.target.value)} placeholder="Código 2FA" maxLength={6} className="w-24 text-center" />
                            <button onClick={() => { deletePasskey.mutate({ id: pk.id, verificationCode: deletePasskeyCode }); setDeletePasskeyCode(""); setDeletingPasskeyId(null); }} className="text-green-400 hover:text-green-300 cursor-pointer"><Check className="h-4 w-4" /></button>
                            <button onClick={() => { setDeletingPasskeyId(null); setDeletePasskeyCode(""); }} className="text-gray-400 hover:text-gray-300 cursor-pointer"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <button onClick={() => { if (security?.totpEnabled) { setDeletingPasskeyId(pk.id); } else { deletePasskey.mutate({ id: pk.id }); } }} className="text-red-400 hover:text-red-300 transition-colors cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Button onClick={handleRegisterPasskey} disabled={registeringPasskey || generatePasskeyOptions.isPending}>
                  <Plus className="h-4 w-4" />{registeringPasskey ? "Registrando..." : "Registrar Passkey"}
                </Button>
              </div>
            </Card>

            {/* TRUSTED SESSIONS */}
            <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 shrink-0"><Smartphone className="h-5 w-5" /></div>
                <h3 className="font-bold text-white text-base">Dispositivos Confiables</h3>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-gray-400">Dispositivos que no requerirán 2FA al iniciar sesión. Cada sesión expira después de 30 días.</p>
                {trustedSessionsQuery.data && trustedSessionsQuery.data.length > 0 && (
                  <div className="space-y-2">
                    {trustedSessionsQuery.data.map((s) => (
                      <div key={s.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/5">
                        <div className="flex items-center gap-3 min-w-0">
                          <Smartphone className="h-4 w-4 text-teal-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm text-white font-medium truncate">{s.deviceName}</p>
                            <p className="text-xs text-gray-500">Expira: {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : ""}</p>
                          </div>
                        </div>
                        <button onClick={() => revokeSession.mutate({ id: s.id })} className="text-red-400 hover:text-red-300 transition-colors shrink-0 ml-2 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                    {!revokingAll && (
                      <Button size="sm" variant="danger" onClick={() => { if (security?.totpEnabled) { setRevokingAll(true); } else { revokeAllSessions.mutate({}); } }} disabled={revokeAllSessions.isPending} className="w-full mt-3"><Trash2 className="h-4 w-4" />Revocar Todos los Dispositivos</Button>
                    )}
                    {revokingAll && (
                      <div className="flex gap-2 mt-3">
                        <Input value={revokeAllCode} onChange={(e) => setRevokeAllCode(e.target.value)} placeholder="Código 2FA" maxLength={6} className="w-36" />
                        <Button size="sm" variant="danger" onClick={() => { revokeAllSessions.mutate({ verificationCode: revokeAllCode }); setRevokeAllCode(""); setRevokingAll(false); }} disabled={revokeAllSessions.isPending || revokeAllCode.length !== 6}>Confirmar</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setRevokingAll(false); setRevokeAllCode(""); }}>Cancelar</Button>
                      </div>
                    )}
                  </div>
                )}
                {(!trustedSessionsQuery.data || trustedSessionsQuery.data.length === 0) && (
                  <p className="text-sm text-gray-500 italic">No hay dispositivos confiables registrados aún.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
