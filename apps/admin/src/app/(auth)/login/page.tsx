"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { Mail, QrCode, Sparkles, UserCheck, Clock } from "lucide-react";
import RabbittyCode from "@/components/ui/RabbittyCode";
import { resolveApiUrl } from "@/lib/api-config";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recentEmails, setRecentEmails] = useState<string[]>([]);
  const [isLocalDev, setIsLocalDev] = useState(false);

  useEffect(() => {
    // Solo activar bypass en desarrollo local (nunca en producción ni en Vercel)
    if (process.env.NODE_ENV === "development" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
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
          setEmail(parsed[0]); // Autocompletar con el último correo usado
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    saveRecentEmail(email);
    await signIn("resend", { email, redirect: false });
    setSent(true);
  };

  const handleQuickLogin = async () => {
    await signIn("test-e2e", { password: "test", callbackUrl: "/" });
  };

  if (sent) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-black text-white overflow-hidden p-4">
        {/* Blurry decorative background blobs */}
        <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-bounce-slow">
            <Mail className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white">Revisa tu correo</h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Te hemos enviado un enlace de acceso a <strong className="text-white font-semibold">{email}</strong>.
            </p>
          </div>

          {/* Opción de ingreso de código de 6 dígitos OTP */}
          <div className="pt-2 pb-1 space-y-3 border-y border-white/5 py-4">
            <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider block">
              O ingresa tu código de 6 dígitos:
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
                className="w-44 h-12 text-center text-xl font-mono font-bold tracking-[0.25em] bg-black/40 border border-white/20 rounded-xl focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 text-white outline-none"
              />
              <button
                type="button"
                disabled={otpCode.length !== 6 || otpLoading}
                onClick={async () => {
                  if (otpCode.length !== 6) return;
                  setOtpLoading(true);
                  setOtpError("");
                  try {
                    const res = await signIn("email-token", {
                      email,
                      token: otpCode,
                      redirect: false,
                    });
                    if (res?.ok) {
                      window.location.href = "/";
                    } else {
                      setOtpError("Código no válido o expirado.");
                    }
                  } catch (e) {
                    setOtpError("Error al verificar código.");
                  } finally {
                    setOtpLoading(false);
                  }
                }}
                className="px-5 h-12 rounded-xl bg-pink-500 font-bold text-xs text-white hover:bg-pink-600 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-[0_0_15px_rgba(236,72,153,0.3)] cursor-pointer"
              >
                {otpLoading ? "..." : "Entrar"}
              </button>
            </div>
            {otpError && (
              <p className="text-[11px] text-rose-400 font-medium">{otpError}</p>
            )}
          </div>

          {/* Acciones: Volver o Reenviar */}
          <div className="pt-1 space-y-2.5">
            <button
              type="button"
              onClick={async () => {
                await signIn("resend", { email, redirect: false });
              }}
              className="w-full py-2.5 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-bold hover:bg-pink-500/20 transition-all cursor-pointer"
            >
              Reenviar correo con código
            </button>

            <button
              type="button"
              onClick={() => {
                setSent(false);
                setOtpCode("");
                setOtpError("");
              }}
              className="w-full py-2 rounded-2xl border border-white/10 bg-white/5 text-gray-400 text-xs font-bold hover:bg-white/10 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              ← Usar otro correo o Escanear QR
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

          <div className="p-4 bg-white/5 border border-pink-500/30 rounded-2xl shadow-[0_0_30px_rgba(236,72,153,0.15)] relative min-w-[212px] min-h-[212px] flex items-center justify-center">
            {qrToken ? (
              <RabbittyCode
                data={`https://app.rabbitty.me/scan?qrlogin_${qrToken}`}
                size={180}
                showCardFrame={false}
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

        {/* LADO DERECHO: FORMULARIO CORREO Y OTP */}
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
            <p className="text-gray-400 text-xs font-medium">Ingresa con tu correo registrado o código OTP</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="sr-only">Correo electrónico o número celular</label>
              <input
                id="email"
                name="email"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="tu@correo.com / número celular"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder-gray-500 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all duration-300"
              />

              {/* Detección de Correos Recientes */}
              {recentEmails.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-400">
                    <Clock className="w-3 h-3 text-pink-400" /> Usados recientemente:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {recentEmails.map((savedEmail) => (
                      <button
                        key={savedEmail}
                        type="button"
                        onClick={() => setEmail(savedEmail)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                          email === savedEmail
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
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-pink-500 to-pink-600 font-bold text-white transition-all hover:scale-[1.02] active:scale-95 shadow-[0_4px_14px_rgba(236,72,153,0.39)] cursor-pointer"
            >
              Enviar código o enlace
            </button>

            <button
              type="button"
              onClick={() => setSent(true)}
              className="w-full text-center text-xs text-pink-400/80 hover:text-pink-300 font-semibold transition-all pt-1 cursor-pointer"
            >
              ¿Ya tienes un código OTP? Ingresar código directamente →
            </button>
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
