import type { Metadata } from "next";
import Link from "next/link";
import { verifyRabbitChairInvite } from "@/lib/rabbit-chair-token";

/**
 * ── Rabbit Chair · landing privada ──────────────────────────────────────────
 *
 * Página sin login, pensada para abrirse desde un enlace personalizado:
 *   /rabbit-chair?t=<token firmado>
 *
 * Reglas:
 *   · `noindex` siempre (es una invitación, no una página pública).
 *   · `force-dynamic` para que nunca se cachee una versión personalizada y se
 *     sirva a otro tenant.
 *   · Sin token válido NO se muestra ningún dato del negocio: solo la puerta.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rabbit Chair · invitación privada",
  description: "Una silla. Una luz. Diez minutos.",
  robots: { index: false, follow: false, nocache: true },
};

const CONTACT_EMAIL = "hola@rabbitty.me";

export default async function RabbitChairPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const invite = verifyRabbitChairInvite(t);

  // ── Sin token válido: solo la puerta ──
  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-center">
        <div className="max-w-md">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-500">Rabbit Chair</p>
          <h1 className="mt-3 text-3xl font-black text-white">Invitación privada</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            Este enlace es personal y no está activo. Si crees que deberías tener acceso, escríbenos y lo revisamos.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Rabbit%20Chair%20%C2%B7%20acceso`}
            className="mt-6 inline-block rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold text-white/80 hover:bg-white/5"
          >
            Pedir acceso
          </a>
        </div>
      </main>
    );
  }

  const isGift = invite.t === "gift";
  const firstName = invite.n;

  return (
    <main className="min-h-screen bg-black text-white">
      {/* HERO */}
      <section className="relative isolate min-h-[92vh] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/rabbit-chair/hero.jpeg"
          alt="Una silla bajo un spot en un bar oscuro"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/55 to-black" />
        <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-5xl flex-col justify-between px-6 py-8">
          <header className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.3em] text-white/60">
            <span>Rabbit Chair</span>
            <span className="text-right text-white/40">Invitación para {firstName}</span>
          </header>

          <div className="max-w-2xl pb-10">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-red-500">626 · experiencia privada</p>
            <h1 className="mt-4 text-5xl font-black leading-[0.95] sm:text-7xl">La Silla</h1>
            <p className="mt-5 max-w-xl text-lg leading-snug text-white/75">
              No sabes cuándo. No sabes quién.
              <br />
              Solo sabes que hay una silla y diez minutos.
            </p>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
              Aportación desde $50 · solo tarjeta · sin hablar
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                  `Rabbit Chair · quiero activarlo para ${firstName}`,
                )}&body=${encodeURIComponent(
                  isGift
                    ? `Hola, soy ${firstName}. Recibí la invitación de Rabbit Chair y quiero agendar mis activaciones.`
                    : `Hola, soy ${firstName}. Quiero activar Rabbit Chair en mi negocio.`,
                )}`}
                className="rounded-full bg-red-600 px-6 py-3 text-sm font-black text-white transition-colors hover:bg-red-500"
              >
                {isGift ? "Agendar mis activaciones" : "Quiero activarlo"}
              </a>
              <Link
                href="/settings"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white/80 transition-colors hover:bg-white/5"
              >
                Ya soy cliente · entrar al panel
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 01 · QUÉ ES */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">01 · Qué es</p>
        <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
          Una activación secreta en tu local. Una silla bajo la luz. Un bartender que no conoces.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/60">
          El cliente no habla: elige desde el teléfono y paga con tarjeta. A los diez minutos se va.
          No vendes una bebida: vendes haber estado ahí.
        </p>
      </section>

      {/* 02 · CÓMO FUNCIONA */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-5">
          {[
            ["Eliges", "Carta, formato, fecha y bartender."],
            ["Abres", "Se manda el aviso y se libera el cupo."],
            ["Se llena", "Diez lugares. Ni uno más."],
            ["Se sirve", "El cronómetro arranca solo."],
            ["Se cierra", "Entra a tu caja como cualquier venta."],
          ].map(([title, desc], index) => (
            <div key={title}>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30">
                0{index + 1}
              </p>
              <p className="mt-2 text-sm font-black text-white">{title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-white/50">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 03 · TÚ DECIDES */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">02 · Tú decides</p>
        <h2 className="mt-4 text-3xl font-black sm:text-4xl">Cinco decisiones. Tu experiencia.</h2>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Carta", "Café, coctelería o ambas según el evento."],
            ["Formato", "Una silla de uno en uno, diez a la vez, o mixto en la misma noche."],
            ["Fecha", "La eliges tú o un clic y el sistema la sortea respetando tu horario."],
            ["Música", "Tres ambientes curados: Terror, Ritual y After."],
            ["Bartender", "Fijo o rotativo sorpresa."],
            ["Pago", "Aporte libre desde $50, solo tarjeta."],
          ].map(([title, desc]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">{title}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-white/60">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 04 · LO QUE GANAS */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">03 · Lo que ganas</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm font-black text-white">Para el negocio</p>
              <ul className="mt-3 space-y-2 text-[13px] text-white/60">
                <li>· Noche vendida sin promociones ni descuentos.</li>
                <li>· Ticket promedio más alto: el aporte es libre.</li>
                <li>· Contenido orgánico: la gente lo cuenta.</li>
                <li>· Datos: quién viene y qué configura.</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-black text-white">Para el cliente</p>
              <ul className="mt-3 space-y-2 text-[13px] text-white/60">
                <li>· Una experiencia que no existe en otro lado.</li>
                <li>· Estatus: “yo estuve en La Silla”.</li>
                <li>· Sello en su pase de Rabbitty.</li>
                <li>· Cero fricción: paga desde el teléfono.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 05 · TU INVITACIÓN */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">04 · Tu invitación</p>

        {isGift ? (
          <>
            <h2 className="mt-4 text-3xl font-black sm:text-4xl">Va por nuestra cuenta.</h2>
            <div className="mt-6 max-w-xl rounded-2xl border border-red-500/30 bg-red-500/[0.07] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-400">Regalo por hito</p>
              <p className="mt-2 text-lg font-black text-white">{invite.m ?? "3 activaciones de prueba"}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-white/60">
                Para {firstName}. Sin costo y sin permanencia: lo montamos contigo y, si te gusta, lo dejamos
                como parte de tu operación.
              </p>
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-4 text-3xl font-black sm:text-4xl">Actívalo cuando quieras.</h2>
            <div className="mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40">Upgrade de experiencia</p>
              <p className="mt-2 text-lg font-black text-white">Módulo Rabbit Chair</p>
              <p className="mt-2 text-[13px] leading-relaxed text-white/60">
                Incluye el módulo en tu panel, el configurador, el drop con cupo secreto, el cronómetro y las
                playlists. Precio a definir contigo.
              </p>
            </div>
          </>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
              `Rabbit Chair · ${isGift ? "mis activaciones" : "activación"} · ${firstName}`,
            )}`}
            className="rounded-full bg-red-600 px-6 py-3 text-sm font-black text-white hover:bg-red-500"
          >
            {isGift ? "Agendar mis activaciones" : "Quiero activarlo"}
          </a>
          <Link
            href="/settings"
            className="rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white/80 hover:bg-white/5"
          >
            Entrar al panel
          </Link>
        </div>
      </section>

      {/* 06 · FAQ */}
      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">05 · Preguntas</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {[
              ["¿Necesito equipo?", "No. Un teléfono para el configurador y una luz."],
              ["¿Puedo cobrar en efectivo?", "La experiencia está pensada para tarjeta: el aporte se cobra en la app."],
              ["¿Y si no llegan?", "Puedes liberar los lugares no reclamados a los 10 minutos."],
              ["¿Se puede sin alcohol?", "Sí. La versión café funciona igual y abre la puerta a más públicos."],
            ].map(([q, a]) => (
              <div key={q}>
                <p className="text-[13px] font-black text-white">{q}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-white/55">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CIERRE */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h2 className="text-4xl font-black leading-tight sm:text-6xl">Hay una silla esperando.</h2>
        <p className="mt-4 text-sm text-white/50">La pregunta es si vas a ser tú.</p>
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Rabbit Chair · ${firstName}`)}`}
          className="mt-8 inline-block rounded-full bg-white px-7 py-3 text-sm font-black text-black hover:bg-white/90"
        >
          Hablar con nosotros
        </a>
        <p className="mt-16 text-[10px] uppercase tracking-[0.3em] text-white/20">
          Invitación privada · {firstName} · no compartir
        </p>
      </section>
    </main>
  );
}
