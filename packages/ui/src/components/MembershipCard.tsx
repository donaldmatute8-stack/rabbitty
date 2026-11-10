"use client";

import { type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../cn";

export type MembershipCardData = {
  planName: string;
  businessName: string;
  branchLabel?: string | null;
  validityLabel?: string | null;
  membersLabel?: string | null;
  transferableLabel?: string | null;
  tagline?: string | null;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
  memberName?: string | null;
  memberSince?: string | null;
  accentColor?: string | null;
};

type Props = {
  data: MembershipCardData;
  /** Contenido del reverso (normalmente el QR). */
  qr?: ReactNode;
  /** Controlado: true muestra el reverso. */
  flipped?: boolean;
  /** Si se pasa, la tarjeta se voltea al tocarla. */
  onFlip?: () => void;
  /** Preview del admin: sin animación continua y sin voltear. */
  preview?: boolean;
  className?: string;
};

const DEFAULT_ACCENT = "#FF2D95";
const DEFAULT_HERO = "/memberships/626/bunnyFamily.png";

/** #RRGGBB → rgba(r,g,b,a). Si no es hex, devuelve el color tal cual. */
function rgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const hexPart = m[1];
  if (!hexPart) return hex;
  const n = parseInt(hexPart, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function splitName(value: string): { title: string; number: string } {
  const m = /^(.*?)[\s·-]*(\d{2,4})\s*$/.exec(value.trim());
  if (!m) return { title: value.trim(), number: "" };
  return { title: (m[1] ?? "").trim(), number: m[2] ?? "" };
}

function splitBusiness(value: string): { number: string; rest: string } {
  const m = /^(\d{2,4})\s*(.*)$/.exec(value.trim());
  if (!m) return { number: "", rest: value.trim() };
  return { number: m[1] ?? "", rest: m[2] ?? "" };
}

export function MembershipCard({
  data,
  qr,
  flipped = false,
  onFlip,
  preview = false,
  className,
}: Props) {
  const accent = data.accentColor?.trim() || DEFAULT_ACCENT;
  const hero = data.heroImageUrl?.trim() || DEFAULT_HERO;
  const reduce = useReducedMotion();
  const animate = !preview && !reduce;
  const { title, number } = splitName(data.planName || "Membresía");
  const business = splitBusiness(data.businessName || "");
  const interactive = !preview && typeof onFlip === "function";

  const front: CSSProperties = {
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };
  const back: CSSProperties = {
    ...front,
    transform: "rotateY(180deg)",
  };

  return (
    <div className={cn("w-full select-none", className)} style={{ containerType: "inline-size" }}>
      <div style={{ perspective: 1400 }}>
        <motion.div
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          onClick={interactive ? onFlip : undefined}
          onKeyDown={
            interactive
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onFlip?.();
                  }
                }
              : undefined
          }
          animate={preview ? undefined : { rotateY: flipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 130, damping: 18, mass: 0.9 }}
          style={{ position: "relative", width: "100%", aspectRatio: "2 / 3", transformStyle: "preserve-3d" }}
          className={cn(interactive && "cursor-pointer")}
        >
          {/* ── FRENTE ─────────────────────────────────────────────── */}
          <div className="relative h-full w-full overflow-hidden" style={{ ...front, borderRadius: "5.5cqw" }}>
            <CardShell accent={accent} animate={animate} />
            <div className="relative z-10 flex h-full w-full flex-col items-center">
              {/* Logo */}
              <div className="flex flex-col items-center" style={{ marginTop: "4.2cqw" }}>
                {data.logoUrl ? (
                  <img src={data.logoUrl} alt="" style={{ height: "9cqw", objectFit: "contain" }} />
                ) : (
                  <RabbittyMark accent={accent} />
                )}
                <span
                  style={{
                    fontSize: "5.2cqw",
                    fontWeight: 700,
                    letterSpacing: "0.01em",
                    color: "#F4EEF5",
                    lineHeight: 1,
                    marginTop: "0.8cqw",
                  }}
                >
                  Rabbitty
                </span>
              </div>

              {/* Héroe */}
              <div
                className="relative flex items-center justify-center"
                style={{ width: "86cqw", height: "44cqw", marginTop: "1.5cqw" }}
              >
                <motion.div
                  aria-hidden
                  style={{
                    position: "absolute",
                    width: "60cqw",
                    height: "60cqw",
                    borderRadius: "9999px",
                    border: `0.7cqw solid ${rgba(accent, 0.55)}`,
                    boxShadow: `0 0 7cqw ${rgba(accent, 0.35)}, inset 0 0 6cqw ${rgba(accent, 0.25)}`,
                  }}
                  animate={animate ? { opacity: [0.45, 0.8, 0.45], scale: [1, 1.03, 1] } : undefined}
                  transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.img
                  src={hero}
                  alt=""
                  draggable={false}
                  style={{
                    position: "relative",
                    width: "82cqw",
                    height: "100%",
                    objectFit: "contain",
                    filter: `drop-shadow(0 1.2cqw 2.4cqw rgba(0,0,0,.55)) drop-shadow(0 0 3cqw ${rgba(accent, 0.35)})`,
                  }}
                  animate={animate ? { y: [0, -0.9, 0] } : undefined}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>

              {/* Título */}
              <div className="flex flex-col items-center" style={{ marginTop: "1cqw", lineHeight: 0.92 }}>
                <span
                  style={{
                    fontSize: "10.2cqw",
                    fontWeight: 900,
                    fontStyle: "italic",
                    letterSpacing: "-0.035em",
                    color: "#F7F2F8",
                    textShadow: "0 0.5cqw 1.2cqw rgba(0,0,0,.55)",
                    textAlign: "center",
                  }}
                >
                  {title}
                </span>
                {number && (
                  <div className="flex items-center justify-center" style={{ gap: "2.6cqw", marginTop: "0.4cqw" }}>
                    <span style={{ width: "10cqw", height: "0.75cqw", background: accent, boxShadow: `0 0 2cqw ${rgba(accent, 0.8)}` }} />
                    <span
                      style={{
                        fontSize: "17cqw",
                        fontWeight: 900,
                        fontStyle: "italic",
                        letterSpacing: "-0.02em",
                        color: accent,
                        textShadow: `0 0 1cqw ${rgba(accent, 0.9)}, 0 0 4cqw ${rgba(accent, 0.55)}`,
                        lineHeight: 0.85,
                      }}
                    >
                      {number}
                    </span>
                    <span style={{ width: "10cqw", height: "0.75cqw", background: accent, boxShadow: `0 0 2cqw ${rgba(accent, 0.8)}` }} />
                  </div>
                )}
                <span
                  style={{
                    fontSize: "3.4cqw",
                    fontWeight: 700,
                    letterSpacing: "0.58em",
                    color: "#CFC6D2",
                    marginTop: "0.9cqw",
                    paddingLeft: "0.58em",
                  }}
                >
                  MEMBRESÍA
                </span>
              </div>

              {/* Barra de negocio */}
              <div
                className="flex items-center justify-center"
                style={{
                  marginTop: "2.6cqw",
                  width: "84cqw",
                  height: "11.6cqw",
                  borderRadius: "3cqw",
                  border: `0.35cqw solid ${rgba("#FFFFFF", 0.14)}`,
                  background: "linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.025))",
                  boxShadow: "inset 0 0.3cqw 1.4cqw rgba(255,255,255,.05), 0 0.6cqw 1.6cqw rgba(0,0,0,.35)",
                }}
              >
                <CupIcon accent={accent} />
                <span style={{ width: "0.3cqw", height: "6.6cqw", background: rgba("#FFFFFF", 0.22), margin: "0 3cqw" }} />
                <div className="flex flex-col items-center" style={{ lineHeight: 1 }}>
                  <span style={{ fontSize: "6.4cqw", fontWeight: 900, color: "#F6F1F7", letterSpacing: "-0.02em" }}>
                    {business.number || business.rest || data.businessName}
                  </span>
                  {business.rest && business.number && (
                    <span
                      style={{
                        fontSize: "4.4cqw",
                        fontWeight: 700,
                        fontStyle: "italic",
                        fontFamily: "Georgia, 'Times New Roman', serif",
                        color: "#D97A3F",
                        marginTop: "-0.4cqw",
                      }}
                    >
                      {business.rest}
                    </span>
                  )}
                </div>
                <span style={{ width: "0.3cqw", height: "6.6cqw", background: rgba("#FFFFFF", 0.22), margin: "0 3cqw" }} />
                <div className="flex flex-col" style={{ lineHeight: 1.15 }}>
                  <span style={{ fontSize: "2.9cqw", color: "#B9AFBD", fontWeight: 500 }}>Solo en</span>
                  <span style={{ fontSize: "3.4cqw", color: "#EDE4EF", fontWeight: 700 }}>{data.branchLabel || data.businessName}</span>
                </div>
              </div>

              {/* Footer de garantías */}
              <div
                className="flex items-start justify-between"
                style={{ width: "80cqw", marginTop: "2.4cqw", paddingTop: "2cqw", borderTop: `0.25cqw solid ${rgba("#FFFFFF", 0.16)}` }}
              >
                <TrustItem accent={accent} icon={<span style={{ fontSize: "5.6cqw", lineHeight: 1 }}>∞</span>} label={data.validityLabel || "Vigencia Indefinida"} />
                <span style={{ width: "0.25cqw", height: "7.5cqw", background: rgba("#FFFFFF", 0.18) }} />
                <TrustItem accent={accent} icon={<FamilyIcon accent={accent} />} label={data.membersLabel || "Hasta 30 miembros"} />
                <span style={{ width: "0.25cqw", height: "7.5cqw", background: rgba("#FFFFFF", 0.18) }} />
                <TrustItem accent={accent} icon={<ShieldIcon accent={accent} />} label={data.transferableLabel || "Intransferible"} />
              </div>

              {/* Tagline */}
              <div className="mt-auto flex flex-col items-center" style={{ marginBottom: "3cqw" }}>
                <span style={{ fontSize: "2.9cqw", letterSpacing: "0.36em", color: "#B8AEBE", fontWeight: 600, paddingLeft: "0.36em" }}>
                  {(data.tagline || "UNA FAMILIA, MÁS BENEFICIOS").toUpperCase()}
                </span>
                <span style={{ width: "9cqw", height: "0.7cqw", background: accent, marginTop: "1.2cqw", boxShadow: `0 0 2cqw ${rgba(accent, 0.8)}` }} />
              </div>
            </div>
          </div>

          {/* ── REVERSO ────────────────────────────────────────────── */}
          <div className="absolute inset-0 overflow-hidden" style={{ ...back, borderRadius: "5.5cqw" }}>
            <CardShell accent={accent} animate={false} />
            <div className="relative z-10 flex h-full w-full flex-col items-center" style={{ padding: "7cqw 6cqw" }}>
              <div className="flex items-center gap-2" style={{ alignSelf: "flex-start" }}>
                <RabbittyMark accent={accent} size="6.5cqw" />
                <span style={{ fontSize: "3.2cqw", letterSpacing: "0.28em", color: "#CFC6D2", fontWeight: 700 }}>PASE DE MIEMBRO</span>
              </div>

              <span style={{ fontSize: "7.4cqw", fontWeight: 900, fontStyle: "italic", color: "#F7F2F8", marginTop: "4cqw", textAlign: "center", lineHeight: 1 }}>
                {data.planName}
              </span>
              {data.memberName && (
                <span style={{ fontSize: "3.8cqw", color: "#B9AFBD", marginTop: "1.2cqw" }}>{data.memberName}</span>
              )}

              <motion.div
                onClick={(e) => e.stopPropagation()}
                animate={animate ? { scale: flipped ? 1 : 0.9, opacity: flipped ? 1 : 0.55 } : undefined}
                transition={{ type: "spring", stiffness: 160, damping: 16, delay: flipped ? 0.12 : 0 }}
                style={{
                  marginTop: "5cqw",
                  width: "70cqw",
                  borderRadius: "4cqw",
                  padding: "3.4cqw",
                  background: "#FFFFFF",
                  boxShadow: `0 0 5cqw ${rgba(accent, 0.45)}, 0 1.5cqw 3cqw rgba(0,0,0,.55)`,
                  position: "relative",
                }}
              >
                <div className="flex items-center justify-center" style={{ width: "100%", aspectRatio: "1 / 1" }}>
                  {qr ?? (
                    <span style={{ fontSize: "2.8cqw", color: "#6B5568", textAlign: "center" }}>
                      El QR se genera al abrir tu pase
                    </span>
                  )}
                </div>
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "8%",
                    right: "8%",
                    height: "0.5cqw",
                    borderRadius: "9999px",
                    background: `linear-gradient(90deg, transparent, ${rgba(accent, 0.9)}, transparent)`,
                    bottom: "1.6cqw",
                    opacity: 0.55,
                  }}
                />
              </motion.div>

              <span style={{ fontSize: "2.9cqw", color: "#B9AFBD", marginTop: "3cqw", textAlign: "center" }}>
                Muéstralo en caja · el código rota cada 30 s
              </span>

              <div className="mt-auto flex flex-col items-center">
                {data.memberSince && (
                  <span style={{ fontSize: "2.6cqw", color: "#8F8594", letterSpacing: "0.18em" }}>
                    MIEMBRO DESDE {data.memberSince}
                  </span>
                )}
                <span style={{ fontSize: "2.6cqw", color: "#8F8594", marginTop: "1cqw", letterSpacing: "0.12em" }}>
                  TOCA PARA VOLVER
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Piezas visuales ─────────────────────────────────────────────── */

function CardShell({ accent, animate }: { accent: string; animate: boolean }) {
  return (
    <>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 95% at 50% 30%, #3B0B25 0%, #1B0713 42%, #0B0309 72%, #060206 100%)",
        }}
      />
      {/* Facetas diagonales */}
      <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "5.5cqw" }}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${rgba(accent, 0.22)}, transparent 38%)`, clipPath: "polygon(0 0, 62% 0, 0 34%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(315deg, rgba(255,255,255,.07), transparent 42%)", clipPath: "polygon(100% 0, 100% 42%, 72% 0)" }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(315deg, ${rgba(accent, 0.18)}, transparent 46%)`, clipPath: "polygon(100% 62%, 100% 100%, 46% 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.025)", clipPath: "polygon(58% 0, 78% 0, 26% 100%, 12% 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)", clipPath: "polygon(0 62%, 18% 100%, 0 100%)" }} />
      </div>
      {/* Borde neón */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "5.5cqw",
          border: `0.65cqw solid ${accent}`,
          boxShadow: `0 0 2.4cqw ${rgba(accent, 0.85)}, inset 0 0 2.6cqw ${rgba(accent, 0.35)}, inset 0 0 0 0.55cqw rgba(255,255,255,.06)`,
        }}
      />
      {/* Brillo que recorre la tarjeta */}
      {animate && (
        <motion.div
          aria-hidden
          initial={{ x: "-140%" }}
          animate={{ x: "140%" }}
          transition={{ duration: 7.5, repeat: Infinity, repeatDelay: 3.5, ease: "easeInOut" }}
          style={{
            position: "absolute",
            top: "-20%",
            bottom: "-20%",
            width: "38%",
            transform: "rotate(18deg)",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,.09), transparent)",
            filter: "blur(2px)",
            pointerEvents: "none",
          }}
        />
      )}
    </>
  );
}

function TrustItem({ icon, label, accent }: { icon: ReactNode; label: string; accent: string }) {
  return (
    <div className="flex flex-col items-center" style={{ width: "30%" }}>
      <span style={{ color: "#EDE4EF", display: "flex", alignItems: "center", justifyContent: "center", height: "8cqw" }}>{icon}</span>
      <span style={{ fontSize: "2.7cqw", color: "#CFC6D2", textAlign: "center", lineHeight: 1.2, marginTop: "0.8cqw" }}>{label}</span>
      <span aria-hidden style={{ width: "2.2cqw", height: "0.35cqw", background: rgba(accent, 0.8), marginTop: "0.9cqw", borderRadius: "9999px" }} />
    </div>
  );
}

function RabbittyMark({ accent, size = "9cqw" }: { accent: string; size?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} fill="none" aria-hidden>
      <path d="M20 30 C16 20 18 8 24 6 C30 8 30 18 29 27" stroke="#F4EEF5" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M44 30 C48 20 46 8 40 6 C34 8 34 18 35 27" stroke="#F4EEF5" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M32 22 C20 22 16 32 18 42 C20 52 26 58 32 58 C38 58 44 52 46 42 C48 32 44 22 32 22 Z" stroke="#F4EEF5" strokeWidth="2.4" />
      <path d="M24 36 C27 33 30 33 32 36" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M40 36 C37 33 34 33 32 36" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M28 46 C30 48 34 48 36 46" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function CupIcon({ accent }: { accent: string }) {
  return (
    <svg width="9cqw" height="9cqw" viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M9 19 H34 V31 C34 37 29 42 22 42 C15 42 9 37 9 31 Z" stroke="#D97A3F" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M34 22 H38 C41 22 43 24 43 27 C43 30 41 32 38 32 H34" stroke="#D97A3F" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M17 14 C17 11 20 11 20 8" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M24 14 C24 11 27 11 27 8" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function FamilyIcon({ accent }: { accent: string }) {
  return (
    <svg width="7.6cqw" height="7.6cqw" viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="17" cy="18" r="5" stroke={accent} strokeWidth="2.2" />
      <circle cx="31" cy="18" r="4" stroke={accent} strokeWidth="2.2" />
      <circle cx="24" cy="24" r="5.6" stroke="#EDE4EF" strokeWidth="2.2" />
      <path d="M8 40 C8 33 12 29 17 29 C21 29 24 31 24 35" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M40 40 C40 34 36 31 31 31 C28 31 26 32 25 35" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 40 C16 34 19 31 24 31 C29 31 32 34 32 40" stroke="#EDE4EF" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon({ accent }: { accent: string }) {
  return (
    <svg width="7.2cqw" height="7.2cqw" viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M24 6 L39 12 V23 C39 33 33 39 24 43 C15 39 9 33 9 23 V12 Z" stroke="#EDE4EF" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M17 24 L22 29 L32 19" stroke={accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
