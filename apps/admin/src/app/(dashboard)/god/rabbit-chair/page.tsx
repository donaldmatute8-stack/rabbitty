import { redirect } from "next/navigation";
import { asc, desc } from "drizzle-orm";
import { auth } from "@rabbitty/auth";
import { getCoreDb, getRestaurantDb } from "@rabbitty/api/db";
import { rabbitChairRequests } from "@rabbitty/database-core/schema";
import { restaurants } from "@rabbitty/database-restaurant/schema";
import { isGodAdminIdentity } from "@rabbitty/api/services/god2fa";
import { ApproveRequest } from "./ApproveRequest";
import { BroadcastPolicyPanel } from "./BroadcastPolicyPanel";

export const dynamic = "force-dynamic";

/**
 * ── God · Rabbit Chair ──────────────────────────────────────────────────────
 * Solicitudes de acceso que llegan desde la landing privada.
 * Aprobar genera el token y avisa al tenant (push + correo + Telegram).
 */
export default async function GodRabbitChairPage() {
  const session = await auth();
  const email = session?.user?.email || "";
  if (!isGodAdminIdentity(email, session?.user?.name || "")) redirect("/");

  const db = getCoreDb();
  const requests = await db
    .select()
    .from(rabbitChairRequests)
    .orderBy(desc(rabbitChairRequests.createdAt))
    .limit(100)
    .catch(() => []);

  const restaurantDb = getRestaurantDb();
  const policyRows = await restaurantDb
    .select({
      businessId: restaurants.businessId,
      name: restaurants.name,
      dailyLimit: restaurants.rabbitChairMassDailyLimit,
      recipientCap: restaurants.rabbitChairMassRecipientCap,
    })
    .from(restaurants)
    .orderBy(asc(restaurants.name))
    .catch(() => []);

  const pending = requests.filter((r) => r.status === "PENDING");
  const done = requests.filter((r) => r.status !== "PENDING");

  const fmt = (value: unknown) =>
    value ? new Date(value as string).toLocaleString("es-MX", { timeZone: "America/Mexico_City" }) : "—";

  return (
    <div className="space-y-6 p-1">
      <div>
        <p className="m-0 text-[10px] font-black uppercase tracking-[0.3em] text-pink-500">God</p>
        <h1 className="mt-1 text-2xl font-black text-white">Rabbit Chair</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Solicitudes de acceso desde la landing privada. Al aprobar se genera el enlace y se avisa al negocio por
          push, correo y Telegram.
        </p>
      </div>

      <BroadcastPolicyPanel businesses={policyRows} />

      <section>
        <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">
          Pendientes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-white/5 bg-white/5 p-4 text-xs text-gray-500">
            No hay solicitudes pendientes.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-black text-white">
                      {r.businessName || r.name || "Sin nombre"}
                    </p>
                    <p className="m-0 text-[11px] text-gray-400">{r.email}</p>
                    {r.businessId ? (
                      <p className="m-0 font-mono text-[10px] text-gray-500">tenant {r.businessId}</p>
                    ) : (
                      <p className="m-0 text-[10px] font-bold text-amber-400">sin negocio vinculado</p>
                    )}
                    {r.note && <p className="m-0 mt-1 text-[11px] text-gray-400">“{r.note}”</p>}
                  </div>
                  <p className="m-0 text-[10px] text-gray-500">{fmt(r.createdAt)}</p>
                </div>
                <div className="mt-3">
                  <ApproveRequest requestId={r.id} businessName={r.businessName || r.email} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">
          Historial ({done.length})
        </h2>
        {done.length === 0 ? (
          <p className="rounded-xl border border-white/5 bg-white/5 p-4 text-xs text-gray-500">Sin historial todavía.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-3 py-2">Negocio</th>
                  <th className="px-3 py-2">Correo</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Aprobó</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Enlace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {done.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-bold text-white">{r.businessName || r.name || "—"}</td>
                    <td className="px-3 py-2">{r.email}</td>
                    <td className="px-3 py-2">
                      <span className={r.status === "APPROVED" ? "text-emerald-400" : "text-gray-400"}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2">{r.resolvedBy || "—"}</td>
                    <td className="px-3 py-2">{fmt(r.resolvedAt)}</td>
                    <td className="px-3 py-2">
                      {r.token ? (
                        <a
                          href={`/rabbit-chair?t=${encodeURIComponent(r.token)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-300 underline"
                        >
                          Abrir
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
