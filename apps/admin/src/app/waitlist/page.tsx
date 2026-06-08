"use client";

import { trpc } from "../../lib/trpc-client";
import { useState } from "react";
import { Users, Bell, Check, X, Phone, Clock, MessageSquare } from "lucide-react";
import { toast } from "@rabbitty/ui";

interface WaitlistItem {
  id: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  timeAdded: string;
  status: "waiting" | "called" | "seated" | "cancelled";
  notes?: string;
}

export default function WaitlistPage() {
  const [waitlist, setWaitlist] = useState<WaitlistItem[]>([
    {
      id: "1",
      customerName: "Carlos Martínez",
      customerPhone: "555-1234",
      partySize: 4,
      timeAdded: new Date(Date.now() - 15 * 60000).toISOString(),
      status: "waiting",
      notes: "Reserva de cumpleaños",
    },
    {
      id: "2",
      customerName: "Ana López",
      customerPhone: "555-5678",
      partySize: 2,
      timeAdded: new Date(Date.now() - 8 * 60000).toISOString(),
      status: "waiting",
    },
    {
      id: "3",
      customerName: "Jorge Ruiz",
      customerPhone: "555-9012",
      partySize: 6,
      timeAdded: new Date(Date.now() - 30 * 60000).toISOString(),
      status: "called",
    },
  ]);

  const { data: tables } = trpc.pos.getTables.useQuery();

  const waitingCount = waitlist.filter((w) => w.status === "waiting").length;
  const calledCount = waitlist.filter((w) => w.status === "called").length;

  const handleStatusChange = (id: string, status: WaitlistItem["status"]) => {
    setWaitlist((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status } : w))
    );
  };

  const getTableForParty = (partySize: number) => {
    return tables
      ?.filter((t) => t.capacity >= partySize)
      .sort((a, b) => a.capacity - b.capacity)[0];
  };

  const notifyCustomer = (customerPhone: string, partySize: number) => {
    toast.success(`Notificación enviada a ${customerPhone} para mesa de ${partySize} personas`);
  };

  const assignTable = (id: string) => {
    const item = waitlist.find((w) => w.id === id);
    if (!item) return;

    const table = getTableForParty(item.partySize);
    if (table) {
      handleStatusChange(id, "seated");
      toast.success(`Mesa ${table.number} asignada a ${item.customerName}`);
    } else {
      toast.error("No hay mesas disponibles para esta cantidad de personas");
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Lista de Espera</h2>
            <p className="text-sm text-gray-500">
              Espera de clientes en proceso de asignación
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-800">
              {waitingCount} esperando
            </div>
            <div className="rounded-full bg-yellow-100 px-4 py-2 text-sm font-semibold text-yellow-800">
              {calledCount} llamados
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          {waitlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Users className="mb-4 h-16 w-16 text-gray-300" />
              <p className="text-lg font-medium text-gray-500">
                Sin clientes en espera
              </p>
              <p className="mt-1 text-sm text-gray-400">
                Los clientes aparecerán aquí
              </p>
            </div>
          ) : (
            waitlist.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border p-5 ${
                  item.status === "waiting"
                    ? "border-red-200 bg-white shadow-lg"
                    : item.status === "called"
                    ? "border-yellow-200 bg-yellow-50/50"
                    : item.status === "seated"
                    ? "border-green-200 bg-green-50/30"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full ${
                        item.status === "waiting"
                          ? "bg-red-100 text-red-600"
                          : item.status === "called"
                          ? "bg-yellow-100 text-yellow-600"
                          : item.status === "seated"
                          ? "bg-green-100 text-green-600"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {item.status === "waiting" && (
                        <Users className="h-6 w-6" />
                      )}
                      {item.status === "called" && <Bell className="h-6 w-6" />}
                      {item.status === "seated" && <Check className="h-6 w-6" />}
                      {item.status === "cancelled" && <X className="h-6 w-6" />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-lg">
                        {item.customerName}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Phone className="h-3 w-3" />
                        {item.customerPhone}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Users className="h-3 w-3" />
                        {item.partySize} persona{item.partySize !== 1 ? "s" : ""} en el grupo
                      </div>
                      {item.notes && (
                        <div className="flex items-center gap-2 text-sm text-yellow-600">
                          <MessageSquare className="h-3 w-3" />
                          {item.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        Se unió hace{" "}
                        {Math.round(
                          (Date.now() -
                            new Date(item.timeAdded).getTime()) /
                            60000
                        )}{" "}
                        min
                      </span>
                    </div>
                    {item.status === "waiting" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStatusChange(item.id, "called")}
                          className="flex items-center gap-1.5 rounded-lg bg-yellow-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-yellow-700"
                        >
                          <Bell className="h-4 w-4" />
                          Llamar
                        </button>
                        <button
                          onClick={() => assignTable(item.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                        >
                          <Check className="h-4 w-4" />
                          Asignar Mesa
                        </button>
                      </div>
                    )}
                    {item.status === "called" && (
                      <button
                        onClick={() => notifyCustomer(item.customerPhone, item.partySize)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        <Phone className="h-4 w-4" />
                        Confirmar llamada
                      </button>
                    )}
                    {item.status === "seated" && (
                      <div className="text-sm font-semibold text-green-600">
                        Assignada
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
