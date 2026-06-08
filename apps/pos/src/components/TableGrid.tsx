"use client";

import { trpc } from "../lib/trpc-client";
import { cn } from "@rabbitty/ui";
import { Users } from "lucide-react";

export function TableGrid({
  selectedTableId,
  onSelectTable,
}: {
  selectedTableId: string | null;
  onSelectTable: (id: string | null) => void;
}) {
  const { data: tables } = trpc.pos.getTables.useQuery();

  if (!tables) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {tables.map((table) => (
        <button
          key={table.id}
          onClick={() => onSelectTable(selectedTableId === table.id ? null : table.id)}
          className={cn(
            "relative flex flex-col items-center justify-center rounded-2xl border-2 border-gray-200 bg-white p-4 text-center transition-all active:scale-[0.98]",
            selectedTableId === table.id && "border-pink-500 ring-4 ring-pink-100"
          )}
        >
          <span className="text-3xl font-black text-gray-900">{table.number}</span>
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
            <Users className="h-3 w-3" />
            <span>{table.capacity} personas</span>
          </div>
        </button>
      ))}
    </div>
  );
}
