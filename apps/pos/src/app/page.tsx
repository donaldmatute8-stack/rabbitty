"use client";

import { trpc } from "../lib/trpc-client";
import { PosSidebar } from "../components/PosSidebar";
import { TableGrid } from "../components/TableGrid";
import { CartDrawer } from "../components/CartDrawer";
import { Button } from "@rabbitty/ui";
import { useState } from "react";
import { ShoppingBag } from "lucide-react";

export default function HomePage() {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [quickOrder, setQuickOrder] = useState(false);

  return (
    <div className="flex h-screen">
      <PosSidebar />
      <main className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Mesas</h2>
            <p className="text-sm text-gray-500">Selecciona una mesa para gestionar su orden</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setSelectedTableId(null);
              setQuickOrder(true);
            }}
          >
            <ShoppingBag className="h-4 w-4" />
            Para llevar
          </Button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <TableGrid selectedTableId={selectedTableId} onSelectTable={setSelectedTableId} />
          </div>
          {selectedTableId && (
            <div className="w-96 border-l border-gray-200 bg-white">
              <CartDrawer tableId={selectedTableId} onClose={() => setSelectedTableId(null)} />
            </div>
          )}
          {quickOrder && (
            <div className="w-96 border-l border-gray-200 bg-white">
              <CartDrawer onClose={() => setQuickOrder(false)} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
