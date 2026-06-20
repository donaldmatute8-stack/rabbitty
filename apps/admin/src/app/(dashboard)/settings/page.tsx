"use client";

import { useState, useEffect } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Input, toast } from "@rabbitty/ui";
import { Store, DollarSign, Clock, Gift, Monitor, Sun, Moon, Edit3, Check, X, Mail, Phone, Shield, Key, Smartphone, Fingerprint, Trash2, Plus, QrCode, Lock, Eye, EyeOff } from "lucide-react";

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const { data: restaurants, isLoading, error } = trpc.admin.getRestaurants.useQuery();
  const r = restaurants?.[0];

  const update = trpc.admin.updateRestaurant.useMutation({
    onSuccess: () => {
      utils.admin.getRestaurants.invalidate();
      toast.success("Configuración actualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const profileQuery = trpc.settings.getProfile.useQuery();
  const securityQuery = trpc.settings.getSecuritySettings.useQuery();

  const updateEmail = trpc.settings.updateEmail.useMutation({
    onSuccess: () => { utils.settings.getProfile.invalidate(); utils.settings.getSecuritySettings.invalidate(); toast.success("Correo actualizado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateWhatsApp = trpc.settings.updateWhatsApp.useMutation({
    onSuccess: () => { utils.settings.getProfile.invalidate(); utils.settings.getSecuritySettings.invalidate(); toast.success("WhatsApp actualizado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateProfile = trpc.settings.updateProfile.useMutation({
    onSuccess: () => { utils.settings.getProfile.invalidate(); toast.success("Perfil actualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const generateTotp = trpc.totp.generateSecret.useMutation({
    onError: (e: any) => toast.error(e.message),
  });
  const verifyAndEnableTotp = trpc.totp.verifyAndEnable.useMutation({
    onSuccess: () => { utils.settings.getSecuritySettings.invalidate(); toast.success("2FA activada"); },
    onError: (e: any) => toast.error(e.message),
  });
  const verifyTotp = trpc.totp.verify.useMutation();
  const disableTotp = trpc.totp.disable.useMutation({
    onSuccess: () => { utils.settings.getSecuritySettings.invalidate(); toast.success("2FA desactivada"); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggleLoginReq = trpc.totp.toggleLoginRequirement.useMutation({
    onSuccess: () => { utils.settings.getSecuritySettings.invalidate(); toast.success("Requisito de 2FA actualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const passkeysQuery = trpc.passkeys.list.useQuery();
  const generatePasskeyOptions = trpc.passkeys.generateRegistrationOptions.useMutation();
  const verifyPasskeyRegistration = trpc.passkeys.verifyRegistration.useMutation({
    onSuccess: () => { utils.passkeys.list.invalidate(); toast.success("Passkey registrada"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deletePasskey = trpc.passkeys.delete.useMutation({
    onSuccess: () => { utils.passkeys.list.invalidate(); toast.success("Passkey eliminada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const trustedSessionsQuery = trpc.trustedSessions.list.useQuery();
  const createTrustedSession = trpc.trustedSessions.create.useMutation();
  const revokeSession = trpc.trustedSessions.revoke.useMutation({
    onSuccess: () => { utils.trustedSessions.list.invalidate(); toast.success("Sesión revocada"); },
    onError: (e: any) => toast.error(e.message),
  });
  const revokeAllSessions = trpc.trustedSessions.revokeAll.useMutation({
    onSuccess: () => { utils.trustedSessions.list.invalidate(); toast.success("Todas las sesiones revocadas"); },
    onError: (e: any) => toast.error(e.message),
  });

  const profile = profileQuery.data;
  const security = securityQuery.data;

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", taxRate: 0, defaultRewardRate: 0.05, acceptsBunz: true, happyHourStart: "", happyHourEnd: "", happyHourRewardRate: 0.1 });
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

  useEffect(() => {
    if (r) {
      setForm({
        name: r.name,
        taxRate: r.taxRate,
        defaultRewardRate: r.defaultRewardRate ?? 0.05,
        acceptsBunz: r.acceptsBunz ?? true,
        happyHourStart: r.happyHourStart ?? "",
        happyHourEnd: r.happyHourEnd ?? "",
        happyHourRewardRate: r.happyHourRewardRate ?? 0.1
      });
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
    setForm({
      name: r.name,
      taxRate: r.taxRate,
      defaultRewardRate: r.defaultRewardRate ?? 0.05,
      acceptsBunz: r.acceptsBunz ?? true,
      happyHourStart: r.happyHourStart ?? "",
      happyHourEnd: r.happyHourEnd ?? "",
      happyHourRewardRate: r.happyHourRewardRate ?? 0.1
    });
    setEditing(section);
  };

  const saveSection = () => {
    if (!r) return;
    update.mutate({ id: r.id, ...form });
    setEditing(null);
  };

  const handleRegisterPasskey = async () => {
    setRegisteringPasskey(true);
    try {
      const options = await generatePasskeyOptions.mutateAsync();
      const credential = await navigator.credentials.create({ publicKey: options as any });
      if (!credential) { toast.error("Registro cancelado"); return; }
      const response = (credential as any).response;
      const transports = response.getTransports?.() ?? [];
      const credentialData = {
        id: credential.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array((credential as any).rawId))),
        response: {
          clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))),
          attestationObject: btoa(String.fromCharCode(...new Uint8Array(response.attestationObject))),
          transports,
        },
        type: credential.type,
        clientExtensionResults: (credential as any).clientExtensionResults ?? {},
        authenticatorAttachment: (credential as any).authenticatorAttachment ?? null,
      };
      const deviceName = `Passkey (${navigator.platform ?? "dispositivo"})`;
      await verifyPasskeyRegistration.mutateAsync({ credential: credentialData, deviceName });
      toast.success("Passkey registrada");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al registrar passkey");
    } finally {
      setRegisteringPasskey(false);
    }
  };

  const handleSetupTotp = async () => {
    try {
      const data = await generateTotp.mutateAsync();
      setTotpSecretData(data);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleVerifyTotp = async () => {
    try {
      await verifyAndEnableTotp.mutateAsync({ code: totpCode });
      setTotpSecretData(null);
      setTotpCode("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDisableTotp = async () => {
    try {
      await disableTotp.mutateAsync({ code: totpDisableCode });
      setTotpDisableCode("");
    } catch (e: any) {
      toast.error(e.message);
    }
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

  if (error) {
    return (
      <Card className="p-6 border-red-500/20 bg-red-500/10 text-red-400 rounded-3xl max-w-xl">
        <h3 className="font-bold text-lg">Error al cargar la configuración</h3>
        <p className="text-sm mt-1">{error.message}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Configuración
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Ajustes generales del sistema y seguridad de la cuenta</p>
          </div>
        </div>
      </div>

      {/* ============================ GENERAL ============================ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Card */}
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.15)] shrink-0">
                <Store className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Perfil del Restaurante</h3>
            </div>
            {editing !== "profile" ? (
              <button onClick={() => startEdit("profile")} className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300">
                <Edit3 className="h-4.5 w-4.5" />
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button onClick={() => setEditing(null)} className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300"><X className="h-4.5 w-4.5" /></button>
                <button onClick={saveSection} className="rounded-xl border border-green-500/20 bg-green-500/10 p-2 text-green-400 hover:bg-green-500/20 hover:text-green-300 hover:border-green-500/30 transition-all duration-300"><Check className="h-4.5 w-4.5" /></button>
              </div>
            )}
          </div>
          {editing === "profile" ? (
            <div className="space-y-3">
              <Input label="Nombre" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 font-medium">Nombre</span>
                <span className="font-bold text-white text-base">{r?.name}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 font-medium">Slug</span>
                <span className="font-mono text-gray-300 bg-white/5 px-2 py-0.5 rounded border border-white/5 text-xs">{r?.slug}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 font-medium">Estado</span>
                <Badge variant={r?.isActive ? "success" : "danger"}>{r?.isActive ? "Activo" : "Inactivo"}</Badge>
              </div>
            </div>
          )}
        </Card>

        {/* Billing Card */}
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] shrink-0">
                <DollarSign className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Facturación</h3>
            </div>
            {editing !== "billing" ? (
              <button onClick={() => startEdit("billing")} className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300"><Edit3 className="h-4.5 w-4.5" /></button>
            ) : (
              <div className="flex gap-1.5">
                <button onClick={() => setEditing(null)} className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300"><X className="h-4.5 w-4.5" /></button>
                <button onClick={saveSection} className="rounded-xl border border-green-500/20 bg-green-500/10 p-2 text-green-400 hover:bg-green-500/20 hover:text-green-300 hover:border-green-500/30 transition-all duration-300"><Check className="h-4.5 w-4.5" /></button>
              </div>
            )}
          </div>
          {editing === "billing" ? (
            <Input label="Tasa de IVA (%)" type="number" value={form.taxRate * 100} onChange={(e) => setForm((f) => ({ ...f, taxRate: Number(e.target.value) / 100 }))} />
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 font-medium">Moneda</span>
                <span className="font-bold text-white uppercase">{r?.currency}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 font-medium">Tasa de IVA</span>
                <span className="font-bold text-white">{(r?.taxRate ?? 0) * 100}%</span>
              </div>
            </div>
          )}
        </Card>

        {/* Timezone Card */}
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)] shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base">Zona Horaria</h3>
          </div>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 font-medium">Zona</span>
              <span className="font-bold text-white font-mono bg-white/5 px-2.5 py-1 rounded border border-white/5 text-xs">{r?.timezone}</span>
            </div>
          </div>
        </Card>

        {/* Rewards Card */}
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)] shrink-0">
                <Gift className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Bunz Rewards</h3>
            </div>
            {editing !== "bunz" ? (
              <button onClick={() => startEdit("bunz")} className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300"><Edit3 className="h-4.5 w-4.5" /></button>
            ) : (
              <div className="flex gap-1.5">
                <button onClick={() => setEditing(null)} className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300"><X className="h-4.5 w-4.5" /></button>
                <button onClick={saveSection} className="rounded-xl border border-green-500/20 bg-green-500/10 p-2 text-green-400 hover:bg-green-500/20 hover:text-green-300 hover:border-green-500/30 transition-all duration-300"><Check className="h-4.5 w-4.5" /></button>
              </div>
            )}
          </div>
          {editing === "bunz" ? (
            <div className="space-y-4">
              <Input label="Tasa de recompensa (%)" type="number" value={form.defaultRewardRate * 100} onChange={(e) => setForm((f) => ({ ...f, defaultRewardRate: Number(e.target.value) / 100 }))} />
              <label className="flex items-center gap-2.5 text-sm text-gray-300 font-semibold cursor-pointer">
                <input type="checkbox" checked={form.acceptsBunz} onChange={(e) => setForm((f) => ({ ...f, acceptsBunz: e.target.checked }))} className="h-5 w-5 rounded border-white/10 bg-white/5 text-pink-500 focus:ring-pink-500/20 focus:ring-offset-0 transition-all duration-300 cursor-pointer" />
                Acepta Bunz
              </label>
              <div className="mt-4 rounded-2xl bg-white/5 p-5 border border-white/5">
                <h4 className="mb-3 text-sm font-bold text-pink-400">Happy Hours (Promociones Bunz)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Hora Inicio (ej. 14:00)" type="time" value={form.happyHourStart || ""} onChange={(e) => setForm((f) => ({ ...f, happyHourStart: e.target.value }))} />
                  <Input label="Hora Fin (ej. 18:00)" type="time" value={form.happyHourEnd || ""} onChange={(e) => setForm((f) => ({ ...f, happyHourEnd: e.target.value }))} />
                  <div className="col-span-2">
                    <Input label="Tasa de recompensa en Happy Hour (%)" type="number" value={(form.happyHourRewardRate || 0) * 100} onChange={(e) => setForm((f) => ({ ...f, happyHourRewardRate: Number(e.target.value) / 100 }))} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 font-medium">Tasa de recompensa</span>
                <span className="font-bold text-white">{r?.defaultRewardRate != null ? `${(r.defaultRewardRate * 100).toFixed(0)}%` : "5%"}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 font-medium">Acepta Bunz</span>
                <Badge variant={r?.acceptsBunz ? "success" : "default"}>{r?.acceptsBunz ? "Sí" : "No"}</Badge>
              </div>
              {r?.happyHourStart && r?.happyHourEnd && (
                <div className="mt-4 rounded-2xl bg-pink-500/10 border border-pink-500/20 p-4">
                  <p className="text-xs font-bold text-pink-400 mb-2">Happy Hour Configurado</p>
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <span className="text-pink-300/80 font-medium">Horario</span>
                    <span className="font-bold text-pink-200">{r.happyHourStart} - {r.happyHourEnd}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-pink-300/80 font-medium">Recompensa Happy Hour</span>
                    <span className="font-bold text-pink-200">{r.happyHourRewardRate != null ? `${(r.happyHourRewardRate * 100).toFixed(0)}%` : "N/A"}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Appearance Card */}
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/5 text-gray-400 shrink-0">
              <Monitor className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base">Apariencia</h3>
          </div>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 font-medium">Tema del Panel</span>
              <div className="flex gap-2.5">
                <button className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-4 py-2.5 text-gray-400 hover:bg-white/10 hover:text-white transition-all duration-350 cursor-pointer">
                  <Sun className="h-4 w-4" />Claro
                </button>
                <button className="flex items-center gap-2 rounded-xl border border-pink-500/20 bg-pink-500/15 px-4 py-2.5 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.15)] transition-all duration-350 cursor-pointer">
                  <Moon className="h-4 w-4 animate-pulse" />Oscuro
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ============================ SECCIÓN: SEGURIDAD ============================ */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 flex items-center gap-3">
            <Shield className="h-7 w-7 text-pink-400" />
            Seguridad de la Cuenta
          </h2>
          <p className="text-gray-400 mt-2 text-sm font-medium">Correo, WhatsApp, 2FA, Passkeys y dispositivos confiables</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* INFO PERSONAL */}
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.15)] shrink-0">
              <Mail className="h-5 w-5" />
            </div>
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
                      <Button size="sm" variant="secondary" onClick={() => { updateEmail.mutate({ email, verificationCode: emailVerifCode }); setEmailVerifCode(""); }} disabled={updateEmail.isPending || emailVerifCode.length !== 6}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => updateEmail.mutate({ email })} disabled={updateEmail.isPending}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">WhatsApp (Soporte y notificaciones)</label>
                <div className="flex gap-2 mt-2">
                  <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+521234567890" />
                  <Button size="sm" variant="secondary" onClick={() => updateWhatsApp.mutate({ supportWhatsApp: whatsapp })} disabled={updateWhatsApp.isPending}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nombre" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Apellido</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellido" />
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => updateProfile.mutate({ firstName, lastName })} disabled={updateProfile.isPending}>
                Guardar Perfil
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Cargando...</p>
          )}
        </Card>

        {/* 2FA TOTP */}
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)] shrink-0">
              <Key className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base">Autenticación en Dos Pasos (2FA)</h3>
          </div>
          {security?.totpEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="success">Activado</Badge>
                <span className="text-xs text-gray-400">Usa tu app de autenticación</span>
              </div>
              <label className="flex items-center gap-2.5 text-sm text-gray-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={security.requireTotpForLogin}
                  onChange={(e) => {
                    if (!e.target.checked && security.totpEnabled) {
                      setTogglingRequireOff(true);
                    } else {
                      toggleLoginReq.mutate({ require: e.target.checked });
                    }
                  }}
                  className="h-5 w-5 rounded border-white/10 bg-white/5 text-pink-500 focus:ring-pink-500/20 focus:ring-offset-0 transition-all duration-300 cursor-pointer"
                />
                Requerir 2FA para iniciar sesión
              </label>
              {togglingRequireOff && (
                <div className="flex gap-2">
                  <Input value={toggleReqCode} onChange={(e) => setToggleReqCode(e.target.value)} placeholder="Código 2FA" maxLength={6} className="w-36" />
                  <Button size="sm" variant="secondary" onClick={() => { toggleLoginReq.mutate({ require: false, verificationCode: toggleReqCode }); setToggleReqCode(""); setTogglingRequireOff(false); }} disabled={toggleLoginReq.isPending || toggleReqCode.length !== 6}>
                    Confirmar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setTogglingRequireOff(false); setToggleReqCode(""); }}>
                    Cancelar
                  </Button>
                </div>
              )}
              <div className="border-t border-white/5 pt-4">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Desactivar 2FA</label>
                <div className="flex gap-2">
                  <Input value={totpDisableCode} onChange={(e) => setTotpDisableCode(e.target.value)} placeholder="Código de 6 dígitos" maxLength={6} />
                  <Button size="sm" variant="danger" onClick={handleDisableTotp} disabled={disableTotp.isPending || totpDisableCode.length !== 6}>
                    Desactivar
                  </Button>
                </div>
              </div>
            </div>
          ) : totpSecretData ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-300">Escanea este código QR con tu app de autenticación (Google Authenticator, Authy, etc.)</p>
              <div className="flex justify-center">
                <img src={totpSecretData.qrCodeDataUrl} alt="TOTP QR Code" className="w-48 h-48 rounded-2xl bg-white p-2" />
              </div>
              <p className="text-xs text-gray-500 break-all font-mono bg-white/5 p-2 rounded">{totpSecretData.secret}</p>
              <div className="flex gap-2 max-w-xs mx-auto">
                <Input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="Código de 6 dígitos" maxLength={6} />
                <Button size="sm" onClick={handleVerifyTotp} disabled={verifyAndEnableTotp.isPending || totpCode.length !== 6}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">Protege tu cuenta con un segundo factor de autenticación usando Google Authenticator, Authy o cualquier app compatible con TOTP.</p>
              <Button onClick={handleSetupTotp} disabled={generateTotp.isPending}>
                <QrCode className="h-4 w-4" />
                Configurar 2FA
              </Button>
            </div>
          )}
        </Card>

        {/* PASSKEYS */}
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.15)] shrink-0">
              <Fingerprint className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base">Passkeys (Biométricos)</h3>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Usa tu huella digital, rostro o PIN de tu dispositivo para iniciar sesión de forma rápida y segura.</p>
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
                        <button onClick={() => { deletePasskey.mutate({ id: pk.id, verificationCode: deletePasskeyCode }); setDeletePasskeyCode(""); setDeletingPasskeyId(null); }} className="text-green-400 hover:text-green-300 transition-colors">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => { setDeletingPasskeyId(null); setDeletePasskeyCode(""); }} className="text-gray-400 hover:text-gray-300 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => {
                        if (security?.totpEnabled) {
                          setDeletingPasskeyId(pk.id);
                        } else {
                          deletePasskey.mutate({ id: pk.id });
                        }
                      }} className="text-red-400 hover:text-red-300 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Button onClick={handleRegisterPasskey} disabled={registeringPasskey || generatePasskeyOptions.isPending}>
              <Plus className="h-4 w-4" />
              {registeringPasskey ? "Registrando..." : "Registrar Passkey"}
            </Button>
          </div>
        </Card>

        {/* TRUSTED SESSIONS */}
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.15)] shrink-0">
              <Smartphone className="h-5 w-5" />
            </div>
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
                    <button onClick={() => revokeSession.mutate({ id: s.id })} className="text-red-400 hover:text-red-300 transition-colors shrink-0 ml-2">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {!revokingAll && (
                  <Button size="sm" variant="danger" onClick={() => {
                    if (security?.totpEnabled) {
                      setRevokingAll(true);
                    } else {
                      revokeAllSessions.mutate({});
                    }
                  }} disabled={revokeAllSessions.isPending} className="w-full mt-3">
                    <Trash2 className="h-4 w-4" />
                    Revocar Todos los Dispositivos
                  </Button>
                )}
                {revokingAll && (
                  <div className="flex gap-2 mt-3">
                    <Input value={revokeAllCode} onChange={(e) => setRevokeAllCode(e.target.value)} placeholder="Código 2FA" maxLength={6} className="w-36" />
                    <Button size="sm" variant="danger" onClick={() => { revokeAllSessions.mutate({ verificationCode: revokeAllCode }); setRevokeAllCode(""); setRevokingAll(false); }} disabled={revokeAllSessions.isPending || revokeAllCode.length !== 6}>
                      Confirmar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setRevokingAll(false); setRevokeAllCode(""); }}>
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>
            )}
            {(!trustedSessionsQuery.data || trustedSessionsQuery.data.length === 0) && (
              <p className="text-sm text-gray-500 italic">No hay dispositivos confiables. Aparecerán aquí cuando marques "Confiar en este dispositivo" al iniciar sesión con 2FA.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
