"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Mail, Phone, QrCode, Sparkles, UserCheck, Clock, ChevronDown, Check, Compass, ScanFace } from "lucide-react";
import QRDiscovery from "@/components/QRDiscovery";
import RabbittyLoader from "@/components/RabbittyLoader";
import { resolveApiUrl } from "@/lib/api-config";

interface CountryCode {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
}

const COUNTRIES: CountryCode[] = [
  { code: "MX", dialCode: "+52", flag: "🇲🇽", name: "México" },
  { code: "US", dialCode: "+1", flag: "🇺🇸", name: "EE.UU. / Canadá" },
  { code: "ES", dialCode: "+34", flag: "🇪🇸", name: "España" },
  { code: "CO", dialCode: "+57", flag: "🇨🇴", name: "Colombia" },
  { code: "AR", dialCode: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "CL", dialCode: "+56", flag: "🇨🇱", name: "Chile" },
  { code: "PE", dialCode: "+51", flag: "🇵🇪", name: "Perú" },
];

export default function LoginPage() {
  const [inputVal, setInputVal] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRIES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentMode, setSentMode] = useState<"email" | "phone">("email");
  const [targetDisplay, setTargetDisplay] = useState("");
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const [otpCode, setOtpCode] = useState("");
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const handlePasskeyLogin = async () => {
    if (passkeyBusy) return;
    setPasskeyBusy(true);
    try {
      const b64urlToBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
      const bytesToB64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      // 1. Options (challenge server-side, single-use)
      const optRes = await fetch(resolveApiUrl("/api/trpc/passkeys.loginOptions?batch=1"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ "0": { json: null } }) });
      const optData = await optRes.json();
      if (optData?.[0]?.error) throw new Error(optData[0].error.message);
      const optionsRes = optData[0].result.data.json;
      const options = optionsRes.options;

      // 2. Face ID / Touch ID / Windows Hello elige la passkey
      const cred = (await navigator.credentials.get({
        publicKey: {
          challenge: b64urlToBytes(options.challenge),
          userVerification: options.userVerification ?? 'required',
          timeout: options.timeout ?? 60000,
          rpId: options.rpId,
        },
      })) as PublicKeyCredential | null;
      if (!cred) throw new Error('Sin credencial');

      const resp = cred.response as unknown as AuthenticatorAssertionResponse;

      // 3. Verificación server-side + token single-use
      const verRes = await fetch(resolveApiUrl("/api/trpc/passkeys.loginVerify?batch=1"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ "0": { json: { loginId: optionsRes.loginId, response: {
          id: bytesToB64url(new Uint8Array(cred.rawId)),
          rawId: bytesToB64url(new Uint8Array(cred.rawId)),
          type: cred.type,
          authenticatorData: bytesToB64url(new Uint8Array(resp.authenticatorData)),
          clientDataJSON: bytesToB64url(new Uint8Array(resp.clientDataJSON)),
          signature: bytesToB64url(new Uint8Array(resp.signature)),
        } } } }),
      });
      const verData = await verRes.json();
      if (verData?.[0]?.error) throw new Error(verData[0].error.message);
      const verify = verData[0].result.data.json;
      if (!verify?.success) throw new Error('Verificación fallida');

      if (!verify?.success) throw new Error('Verificación fallida');

      // 4. Sesión NextAuth
      const result = await signIn('passkey', { token: verify.token, email: verify.email, redirect: false });
      if (result?.error) throw new Error('No se pudo crear la sesión');
      window.location.href = '/';
    } catch (err: any) {
      const m = err?.message || err?.name || 'Error';
      if (m.includes('NotAllowed')) {
        console.warn('[PasskeyLogin] cancelado o no permitido');
      } else if (m.includes('No passkey') || m.includes('no registrada')) {
        alert('No hay passkeys registradas en este servidor. Entra con OTP y registra tu Face ID en Configuración → Seguridad.');
      } else {
        alert(`Error passkey: ${m}`);
      }
    } finally {
      setPasskeyBusy(false);
    }
  };
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  const [qrToken, setQrToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recentEmails, setRecentEmails] = useState<string[]>([]);
  const [isLocalDev, setIsLocalDev] = useState(false);

  // Determinar si lo que el usuario está escribiendo parece un número de teléfono
  const isPhoneNumber = (() => {
    const trimmed = inputVal.trim();
    if (!trimmed) return false;
    if (trimmed.includes("@")) return false;
    // Si contiene sólo dígitos, espacios, guiones o empieza con +
    return /^[\d\s\-\+\(\)]+$/.test(trimmed) && trimmed.replace(/\D/g, "").length >= 1;
  })();

  // Autodetectar país si el usuario escribe prefijo internacional
  useEffect(() => {
    const trimmed = inputVal.trim();
    if (trimmed.startsWith("+52")) setSelectedCountry(COUNTRIES.find((c) => c.code === "MX")!);
    else if (trimmed.startsWith("+1")) setSelectedCountry(COUNTRIES.find((c) => c.code === "US")!);
    else if (trimmed.startsWith("+34")) setSelectedCountry(COUNTRIES.find((c) => c.code === "ES")!);
    else if (trimmed.startsWith("+57")) setSelectedCountry(COUNTRIES.find((c) => c.code === "CO")!);
    else if (trimmed.startsWith("+54")) setSelectedCountry(COUNTRIES.find((c) => c.code === "AR")!);
    else if (trimmed.startsWith("+56")) setSelectedCountry(COUNTRIES.find((c) => c.code === "CL")!);
    else if (trimmed.startsWith("+51")) setSelectedCountry(COUNTRIES.find((c) => c.code === "PE")!);
  }, [inputVal]);

  useEffect(() => {
    // Solo activar bypass en desarrollo local (nunca en producción ni en Vercel)
    if (
      process.env.NODE_ENV === "development" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ) {
      setIsLocalDev(true);
    }

    // Generar sesión QR para login
    fetch(resolveApiUrl("/api/auth/qr/generate"), { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.qrToken) {
          setQrToken(data.qrToken);
          setSessionId(data.sessionId);
        }
      })
      .catch(() => {});

    // Cargar historial de correos del almacenamiento local / navegador
    try {
      const saved = localStorage.getItem("rabbitty_recent_emails");
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentEmails(parsed);
          setInputVal(parsed[0]);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      fetch(resolveApiUrl(`/api/auth/qr/poll?sessionId=${sessionId}`))
        .then((r) => r.json())
        .then((data) => {
          if (data.authenticated && data.user) {
            window.location.href = `/magic?token=${qrToken}&sid=${sessionId}`;
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionId, qrToken]);

  const saveRecentEmail = (emailToSave: string) => {
    if (!emailToSave || !emailToSave.includes("@")) return;
    try {
      const updated = [emailToSave, ...recentEmails.filter((e) => e !== emailToSave)].slice(0, 3);
      localStorage.setItem("rabbitty_recent_emails", JSON.stringify(updated));
      setRecentEmails(updated);
    } catch {
      // ignore
    }
  };

  const getCanonicalRecipient = () => {
    const trimmed = inputVal.trim();
    if (trimmed.includes("@")) {
      return trimmed.toLowerCase();
    }
    // Es teléfono
    if (trimmed.startsWith("+")) {
      return trimmed;
    }
    // Agregar prefijo de país seleccionado si no lo tiene
    const cleanDigits = trimmed.replace(/\D/g, "");
    const dialDigits = selectedCountry.dialCode.replace(/\D/g, "");
    if (cleanDigits.startsWith(dialDigits)) {
      return `+${cleanDigits}`;
    }
    return `${selectedCountry.dialCode}${cleanDigits}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    setSubmitLoading(true);
    setOtpError("");
    setDevOtpHint(null);

    const recipient = getCanonicalRecipient();
    const isEmail = recipient.includes("@");

    if (isEmail) {
      saveRecentEmail(recipient);
    }

    try {
      // Usar nuestro endpoint /api/auth/otp/send para generar el token de 6 dígitos
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: recipient }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSentMode(data.mode || (isEmail ? "email" : "phone"));
        setTargetDisplay(recipient);
        if (data.otpCode) {
          setDevOtpHint(data.otpCode);
        }
        setSent(true);
      } else {
        // Fallback a NextAuth signIn("resend") si el endpoint reporta error
        if (isEmail) {
          await signIn("resend", { email: recipient, redirect: false });
          setSentMode("email");
          setTargetDisplay(recipient);
          setSent(true);
        } else {
          setOtpError(data.error || "No pudimos enviar el código. Revisa el número ingresado.");
        }
      }
    } catch {
      if (isEmail) {
        await signIn("resend", { email: recipient, redirect: false });
        setSentMode("email");
        setTargetDisplay(recipient);
        setSent(true);
      } else {
        setOtpError("Error al procesar la solicitud. Intenta nuevamente.");
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleQuickLogin = async () => {
    await signIn("test-e2e", { password: "test", callbackUrl: "/" });
  };

  if (sent) {
    const isPhone = sentMode === "phone";

    return (
      <div className="relative flex min-h-screen items-center justify-center bg-black text-white overflow-hidden p-4">
        {/* Blurry decorative background blobs */}
        <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-bounce-slow">
            {isPhone ? <Phone className="h-8 w-8" /> : <Mail className="h-8 w-8" />}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white">
              {isPhone ? "Revisa tu teléfono" : "Revisa tu correo"}
            </h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Te hemos enviado un código de acceso a <strong className="text-white font-semibold">{targetDisplay}</strong>.
            </p>
          </div>

          {/* Opción de ingreso de código de 6 dígitos OTP con margen generoso */}
          <div className="mt-8 mb-6 pt-5 pb-5 space-y-4 border-y border-white/10">
            <span className="text-[12px] font-bold text-gray-300 uppercase tracking-wider block">
              Ingresa tu código de 6 dígitos:
            </span>
            <div className="flex gap-2 justify-center">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtpCode(val);
                  setOtpError("");
                }}
                className="w-48 h-13 text-center text-2xl font-mono font-bold tracking-[0.28em] bg-black/50 border border-white/20 rounded-xl focus:border-pink-500 focus:ring-2 focus:ring-pink-500/25 text-white outline-none shadow-inner transition-all"
              />
              <button
                type="button"
                disabled={otpCode.length !== 6 || otpLoading}
                onClick={async () => {
                  if (otpCode.length !== 6) return;
                  setOtpLoading(true);
                  setOtpError("");
                  try {
                    // Al omitir redirect: false, NextAuth realiza un POST HTTP nativo
                    // con respuesta 302 Redirect. Esto garantiza que WKWebView en iPad/iOS
                    // persista las cookies HttpOnly de sesión antes de que el navegador cambie de página.
                    await signIn("email-token", {
                      email: targetDisplay,
                      token: otpCode,
                      callbackUrl: "/",
                    });
                  } catch {
                    setOtpError("Error al verificar código.");
                    setOtpLoading(false);
                  }
                }}
                className="px-6 h-13 rounded-xl bg-pink-500 font-bold text-sm text-white hover:bg-pink-600 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-[0_0_15px_rgba(236,72,153,0.3)] cursor-pointer"
              >
                {otpLoading ? "..." : "Entrar"}
              </button>
            </div>
            {otpError && (
              <p className="text-xs text-rose-400 font-medium pt-1">{otpError}</p>
            )}

            {/* Hint en desarrollo local para pruebas rápidas */}
            {isLocalDev && devOtpHint && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setOtpCode(devOtpHint)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-[11px] font-mono font-bold hover:bg-pink-500/25 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-pink-400" />
                  Auto-llenar OTP de prueba: {devOtpHint}
                </button>
              </div>
            )}
          </div>

          {/* Acciones: Volver o Reenviar */}
          <div className="pt-2 space-y-3">
            <button
              type="button"
              onClick={async () => {
                setOtpError("");
                try {
                  const res = await fetch("/api/auth/otp/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ input: targetDisplay }),
                  });
                  const data = await res.json();
                  if (data.otpCode) setDevOtpHint(data.otpCode);
                } catch {
                  // ignore
                }
              }}
              className="w-full py-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-bold hover:bg-pink-500/20 transition-all cursor-pointer"
            >
              Reenviar código
            </button>

            <button
              type="button"
              onClick={() => {
                setSent(false);
                setOtpCode("");
                setOtpError("");
                setDevOtpHint(null);
              }}
              className="w-full py-2.5 rounded-2xl border border-white/10 bg-white/5 text-gray-400 text-xs font-bold hover:bg-white/10 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              ← Usar otro número/correo o Escanear QR
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black text-white overflow-hidden p-4">
      {/* Blurry decorative background blobs */}
      <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        {/* LADO IZQUIERDO: QR LOGIN */}
        <div className="flex flex-col items-center justify-center p-6 border-b md:border-b-0 md:border-r border-white/10 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Acceso Rápido 1-Clic
          </div>
          <h2 className="text-xl font-black text-white">Escanea con tu App</h2>
          <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
            Abre tu app de <strong className="text-white">Rabbitty</strong> en tu celular, ve a <strong className="text-white">Perfil ➔ Escanear</strong> y apunta tu cámara a este código.
          </p>

          <div className="p-4 bg-white/5 border border-pink-500/30 rounded-2xl shadow-[0_0_30px_rgba(236,72,153,0.15)] relative min-w-[212px] min-h-[212px] flex flex-col items-center justify-center gap-3">
            {qrToken ? (
              <QRDiscovery
                value={`https://app.rabbitty.me/scan?qrlogin_${qrToken}`}
                variant="admin"
                size={210}
                revealMode="discovery"
                surfaceKey="admin-login"
              />
            ) : (
              <div className="w-[180px] h-[180px] flex flex-col items-center justify-center text-center p-4 space-y-3 relative overflow-hidden">
                {/* Concentric Neon Radar Rings */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-28 h-28 rounded-full border border-pink-500/20 animate-ping" />
                  <div className="w-20 h-20 rounded-full border border-purple-500/30 animate-pulse" />
                </div>

                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500/20 to-purple-500/20 border border-pink-500/30 text-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.3)]">
                  <QrCode className="h-6 w-6 animate-pulse" />
                </div>

                <div className="relative z-10 space-y-1">
                  <p className="text-xs font-bold text-white tracking-wide">Generando QR...</p>
                  <p className="text-[10px] text-pink-400/80 font-medium">Conexión cifrada</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* LADO DERECHO: FORMULARIO CORREO / TELÉFONO Y OTP */}
        <div className="flex flex-col justify-center space-y-6 p-2">
          <div className="text-center md:text-left space-y-2">
            <img
              src="/Ra.png"
              alt="Rabbitty Logo"
              className="h-28 w-28 object-contain drop-shadow-[0_0_20px_rgba(236,72,153,0.5)] mx-auto md:mx-0"
            />
            <h1 className="text-2xl font-black tracking-tight text-white">
              Rabbitty Admin
            </h1>
            <p className="text-gray-400 text-xs font-medium">
              Ingresa con tu correo registrado o número celular con código OTP
            </p>
          </div>

          {passkeyBusy && <RabbittyLoader message="Verificando tu identidad…" />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="loginInput" className="sr-only">Correo electrónico o número celular</label>

              <div className="relative flex items-center">
                {/* Indicador / Selector de País animado si se detecta número telefónico */}
                {isPhoneNumber && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCountryPicker(!showCountryPicker)}
                      className="h-12 pl-3.5 pr-2 mr-2 flex items-center gap-1.5 rounded-2xl border border-pink-500/30 bg-pink-500/10 text-white hover:bg-pink-500/20 transition-all cursor-pointer shadow-[0_0_12px_rgba(236,72,153,0.15)] animate-in fade-in zoom-in-95 duration-200"
                    >
                      <span className="text-base">{selectedCountry.flag}</span>
                      <span className="text-xs font-bold text-pink-300 font-mono">{selectedCountry.dialCode}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    </button>

                    {/* Menú Desplegable de Países */}
                    {showCountryPicker && (
                      <div className="absolute left-0 bottom-full mb-2 z-50 w-60 rounded-2xl border border-white/15 bg-[#121218] p-1.5 shadow-2xl backdrop-blur-2xl space-y-1">
                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Selecciona tu país
                        </div>
                        {COUNTRIES.map((country) => (
                          <button
                            key={country.code}
                            type="button"
                            onClick={() => {
                              setSelectedCountry(country);
                              setShowCountryPicker(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                              selectedCountry.code === country.code
                                ? "bg-pink-500/20 text-pink-300"
                                : "text-gray-300 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{country.flag}</span>
                              <span>{country.name}</span>
                            </span>
                            <span className="font-mono text-xs text-gray-400 flex items-center gap-1">
                              {country.dialCode}
                              {selectedCountry.code === country.code && <Check className="w-3 h-3 text-pink-400" />}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <input
                  id="loginInput"
                  name="loginInput"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="tu@correo.com / número celular"
                  value={inputVal}
                  onChange={(e) => {
                    setInputVal(e.target.value);
                    setOtpError("");
                  }}
                  required
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder-gray-500 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all duration-300"
                />
              </div>

              {/* Detección de Correos Recientes */}
              {!isPhoneNumber && recentEmails.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-400">
                    <Clock className="w-3 h-3 text-pink-400" /> Usados recientemente:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {recentEmails.map((savedEmail) => (
                      <button
                        key={savedEmail}
                        type="button"
                        onClick={() => setInputVal(savedEmail)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                          inputVal === savedEmail
                            ? "bg-pink-500/20 border border-pink-500/40 text-pink-300 shadow-[0_0_12px_rgba(236,72,153,0.2)]"
                            : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5 text-pink-400" />
                        {savedEmail}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitLoading || !inputVal.trim()}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-pink-500 to-pink-600 font-bold text-white transition-all hover:scale-[1.02] active:scale-95 shadow-[0_4px_14px_rgba(236,72,153,0.39)] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitLoading ? "Enviando..." : "Enviar código o enlace"}
            </button>

            <button
              type="button"
              onClick={() => {
                setTargetDisplay(inputVal.trim() ? getCanonicalRecipient() : "tu cuenta");
                setSentMode(isPhoneNumber ? "phone" : "email");
                setSent(true);
              }}
              className="w-full text-center text-xs text-pink-400/80 hover:text-pink-300 font-semibold transition-all pt-1 cursor-pointer"
            >
              ¿Ya tienes un código OTP? Ingresar código directamente →
            </button>

            <div className="pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={passkeyBusy}
                className="w-full flex h-11 items-center justify-center gap-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <ScanFace className="w-4 h-4" />
                {passkeyBusy ? "Verificando con Face ID…" : "Entrar con Face ID / Passkey"}
              </button>
              <Link
                href="/demo"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-bold text-xs transition-all"
              >
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>Explorar Recorrido Virtual Interactivo (/demo)</span>
              </Link>
            </div>
          </form>

          {isLocalDev && (
            <div className="pt-4 border-t border-white/5 space-y-2">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest text-center md:text-left">Desarrollo Local</p>
              <button
                type="button"
                onClick={handleQuickLogin}
                className="flex h-10 w-full items-center justify-center rounded-xl border border-pink-500/20 bg-pink-500/10 text-pink-400 font-bold hover:bg-pink-500/20 hover:text-white transition-all cursor-pointer text-xs shadow-[0_0_15px_rgba(236,72,153,0.05)]"
              >
                Acceso Rápido (Bypass)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
