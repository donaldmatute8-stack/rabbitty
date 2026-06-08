"use client";

import { trpc } from "../../lib/trpc-client";
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
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Reservas</h2>
            <p className="text-sm text-gray-500">Gestión de reservaciones de mesas</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView("list")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                view === "list" ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                view === "calendar" ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
              <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Reservas de hoy ({reservations.length})
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Users className="h-4 w-4" />
                    <span>2 personas x avg</span>
                  </div>
                </div>
              </div>

              {reservations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Calendar className="mb-4 h-16 w-16 text-gray-300" />
                  <p className="text-lg font-medium text-gray-500">No hay reservas para hoy</p>
                  <p className="mt-1 text-sm text-gray-400">Las reservas aparecerán aquí</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reservations.map((res) => (
                    <div
                      key={res.id}
                      className="overflow-hidden rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-50 text-lg">
                            🎫
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{res.customerName}</p>
                            <p className="text-sm text-gray-500">+{res.customerPhone}</p>
                            <p className="text-xs text-gray-400">Mesa {res.tableId || "Takeout"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`rounded-lg px-3 py-1 text-xs font-medium border ${getStatusColor(res.status)}`}>
                            {res.status === "pending" ? "Pendiente" : res.status === "confirmed" ? "Confirmado" : res.status === "cancelled" ? "Cancelado" : "Completado"}
                          </span>
                          <span className="text-sm text-gray-500">{res.reservationTime}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span>{res.guestCount} personas</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span>{res.reservationDate}</span>
                        </div>
                      </div>
                      {res.notes && (
                        <div className="mt-2 text-sm text-gray-500">
                          <span className="font-medium text-gray-400">Nota: </span>
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
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  {currentDate.toLocaleDateString("es-MX", {
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigation("prev")}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setCurrentDate(new Date())}
                    className="rounded-lg px-4 py-2 text-sm font-medium bg-pink-600 text-white hover:bg-pink-700"
                  >
                    Hoy
                  </button>
                  <button
                    onClick={() => navigation("next")}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-4 text-center">
                {["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"].map((day) => (
                  <div key={day} className="text-sm font-semibold text-gray-500">
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
                      className={`min-h-[120px] rounded-xl border p-2 ${
                        isToday
                          ? "border-pink-200 bg-pink-50/50"
                          : "border-gray-100 bg-white"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span
                          className={`text-sm font-semibold ${
                            isToday ? "text-pink-600" : "text-gray-700"
                          }`}
                        >
                          {day}
                        </span>
                        {dayReservations.length > 0 && (
                          <span className="rounded-full bg-pink-600 px-2 py-0.5 text-xs font-bold text-white">
                                {dayReservations.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayReservations.slice(0, 3).map((res) => (
                          <div
                            key={res.id}
                            className="rounded-lg bg-white/60 px-2 py-1 text-xs shadow-sm"
                          >
                            <span className="font-medium text-gray-700">
                              {res.guestCount}
                            </span>
                            <span className="text-gray-500">
                              {" "}people @ {res.reservationTime}
                            </span>
                          </div>
                        ))}
                        {dayReservations.length > 3 && (
                          <div className="text-center text-xs text-gray-400">
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

          <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Estadísticas de reservas
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-sm text-gray-500">Total hoy</div>
                <div className="text-2xl font-bold text-gray-900">
                      {reservations.length}
                </div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-sm text-gray-500">Confirmadas</div>
                <div className="text-2xl font-bold text-blue-600">
                      {reservations.filter((r) => r.status === "confirmed").length}
                </div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-sm text-gray-500">Pendientes</div>
                <div className="text-2xl font-bold text-yellow-600">
                      {reservations.filter((r) => r.status === "pending").length}
                </div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-sm text-gray-500">Canceladas</div>
                <div className="text-2xl font-bold text-red-600">
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
