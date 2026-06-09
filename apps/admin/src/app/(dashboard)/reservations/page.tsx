"use client";

import { trpc } from "../../../lib/trpc-client";
import { useState, useMemo } from "react";
import { Calendar, Clock, Users, MapPin, ChevronLeft, ChevronRight } from "lucide-react";

type ReservationStatus = "pending" | "confirmed" | "cancelled" | "completed";

interface Reservation {
  id: string;
  customerName: string;
  customerPhone: string;
  guestCount: number;
  reservationDate: string;
  reservationTime: string;
  status: ReservationStatus;
  tableId?: string | null;
  notes?: string;
}

export default function ReservationsPage() {
  const [view, setView] = useState<"list" | "calendar">("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());
  const { data: tableData } = trpc.pos.getTables.useQuery();
  const { data: ordersData } = trpc.pos.getOrders.useQuery({});

  const reservations = useMemo<Reservation[]>(() => {
    if (!tableData || !ordersData) return [];

    const tableMap = new Map(tableData.map((t) => [t.id, t.number]));
    const orderMap = new Map(
      ordersData.map((o) => [o.tableId, o.customerName && o.customerPhone ? `${o.customerName} (${o.customerPhone})` : ""])
    );

    const todayStr = new Date().toISOString().split("T")[0];
    const dayReservations: Reservation[] = [];

    ordersData.forEach((order) => {
      if (order.customerName || order.customerPhone) {
        dayReservations.push({
          id: order.id,
          customerName: order.customerName || "",
          customerPhone: order.customerPhone || "",
          guestCount: 2,
          reservationDate: todayStr,
           reservationTime: order.createdAt ? order.createdAt.split("T")[1]?.substring(0, 5) : "00:00",
          status: order.status === "PAID" ? "completed" : order.status === "CANCELLED" ? "cancelled" : "pending",
          tableId: order.tableId,
          notes: `Table ${tableMap.get(order.tableId || "") || " Takeout"}`,
        });
      }
    });

    return dayReservations;
  }, [tableData, ordersData]);

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay, year, month };
  }, [currentDate]);

  const navigation = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    setCurrentDate(newDate);
  };

  const getStatusColor = (status: ReservationStatus) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "confirmed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)]">Reservas</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Gestión de reservaciones de mesas</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView("list")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                view === "list"
                  ? "bg-[var(--rabbitty-pink)] text-white"
                  : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-pressed)] border border-[var(--border-subtle)]"
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                view === "calendar"
                  ? "bg-[var(--rabbitty-pink)] text-white"
                  : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-pressed)] border border-[var(--border-subtle)]"
              }`}
            >
              Calendario
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl">
          {view === "list" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">
                    Reservas de hoy ({reservations.length})
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <Users className="h-4 w-4" />
                    <span>2 personas x avg</span>
                  </div>
                </div>
              </div>

              {reservations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Calendar className="mb-4 h-16 w-16 text-[var(--text-muted)]" />
                  <p className="text-lg font-semibold text-[var(--text-secondary)]">No hay reservas para hoy</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">Las reservas aparecerán aquí</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reservations.map((res) => (
                    <div
                      key={res.id}
                      className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(233,30,99,0.08)] text-lg">
                            🎫
                          </div>
                          <div>
                            <p className="font-bold text-[var(--text-primary)]">{res.customerName}</p>
                            <p className="text-sm text-[var(--text-secondary)]">+{res.customerPhone}</p>
                            <p className="text-xs text-[var(--text-muted)]">Mesa {res.tableId || "Takeout"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${getStatusColor(res.status)}`}>
                            {res.status === "pending" ? "Pendiente" : res.status === "confirmed" ? "Confirmado" : res.status === "cancelled" ? "Cancelado" : "Completado"}
                          </span>
                          <span className="text-sm text-[var(--text-muted)]">{res.reservationTime}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-4 border-t border-[var(--border-subtle)] pt-3">
                        <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                          <Users className="h-4 w-4 text-[var(--text-muted)]" />
                          <span>{res.guestCount} personas</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                          <Clock className="h-4 w-4 text-[var(--text-muted)]" />
                          <span>{res.reservationDate}</span>
                        </div>
                      </div>
                      {res.notes && (
                        <div className="mt-2 text-sm text-[var(--text-secondary)]">
                          <span className="font-medium text-[var(--text-muted)]">Nota: </span>
                          {res.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === "calendar" && (
            <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-[var(--text-primary)]">
                  {currentDate.toLocaleDateString("es-MX", {
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigation("prev")}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors duration-200"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setCurrentDate(new Date())}
                    className="rounded-xl px-4 py-2 text-sm font-semibold bg-[var(--rabbitty-pink)] text-white hover:opacity-90 transition-opacity duration-200"
                  >
                    Hoy
                  </button>
                  <button
                    onClick={() => navigation("next")}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors duration-200"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-4 text-center">
                {["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"].map((day) => (
                  <div key={day} className="text-sm font-bold text-[var(--text-muted)]">
                        {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: daysInMonth.firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {Array.from({ length: daysInMonth.days }).map((_, i) => {
                  const day = i + 1;
                  const dayDate = new Date(daysInMonth.year, daysInMonth.month, day);
                  const dayStr = dayDate.toISOString().split("T")[0];
                  const dayReservations = reservations.filter(
                    (r) => r.reservationDate === dayStr
                  );

                  const isToday =
                    dayStr === new Date().toISOString().split("T")[0];

                  return (
                    <div
                      key={day}
                      className={`min-h-[120px] rounded-xl border p-2 transition-colors duration-200 ${
                        isToday
                          ? "border-[var(--rabbitty-pink)] bg-[rgba(233,30,99,0.04)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-subtle)]"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span
                          className={`text-sm font-bold ${
                            isToday ? "text-[var(--rabbitty-pink)]" : "text-[var(--text-primary)]"
                          }`}
                        >
                          {day}
                        </span>
                        {dayReservations.length > 0 && (
                          <span className="rounded-full bg-[var(--rabbitty-pink)] px-2 py-0.5 text-xs font-bold text-white">
                                {dayReservations.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayReservations.slice(0, 3).map((res) => (
                          <div
                            key={res.id}
                            className="rounded-lg bg-[var(--bg-subtle)] px-2 py-1 text-xs border border-[var(--border-subtle)]"
                          >
                            <span className="font-semibold text-[var(--text-primary)]">
                              {res.guestCount}
                            </span>
                            <span className="text-[var(--text-muted)]">
                              {" "}people @ {res.reservationTime}
                            </span>
                          </div>
                        ))}
                        {dayReservations.length > 3 && (
                          <div className="text-center text-xs text-[var(--text-muted)]">
                            +{dayReservations.length - 3} más
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-8 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-bold text-[var(--text-primary)]">
              Estadísticas de reservas
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-[var(--bg-subtle)] p-4 border border-[var(--border-subtle)]">
                <div className="text-sm text-[var(--text-secondary)]">Total hoy</div>
                <div className="text-2xl font-black text-[var(--text-primary)]">
                      {reservations.length}
                </div>
              </div>
              <div className="rounded-2xl bg-[var(--bg-subtle)] p-4 border border-[var(--border-subtle)]">
                <div className="text-sm text-[var(--text-secondary)]">Confirmadas</div>
                <div className="text-2xl font-black text-blue-500">
                      {reservations.filter((r) => r.status === "confirmed").length}
                </div>
              </div>
              <div className="rounded-2xl bg-[var(--bg-subtle)] p-4 border border-[var(--border-subtle)]">
                <div className="text-sm text-[var(--text-secondary)]">Pendientes</div>
                <div className="text-2xl font-black text-amber-500">
                      {reservations.filter((r) => r.status === "pending").length}
                </div>
              </div>
              <div className="rounded-2xl bg-[var(--bg-subtle)] p-4 border border-[var(--border-subtle)]">
                <div className="text-sm text-[var(--text-secondary)]">Canceladas</div>
                <div className="text-2xl font-black text-red-500">
                      {reservations.filter((r) => r.status === "cancelled").length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
