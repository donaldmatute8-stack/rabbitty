"use client";

import { trpc } from "../lib/trpc-client";
import { useBranch } from "./DashboardClientWrapper";
import { Store } from "lucide-react";

export function BranchSelector() {
  const { data: branches } = trpc.admin.getBranches.useQuery();
  const { branchId, setBranchId } = useBranch();

  if (!branches?.length) return null;

  return (
    <div className="flex items-center gap-2">
      <Store className="h-4 w-4 text-gray-500" />
      <select
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white focus:border-pink-500 focus:outline-none appearance-none cursor-pointer"
      >
        <option value="" className="bg-gray-900">Todas las sucursales</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id} className="bg-gray-900">{b.name}</option>
        ))}
      </select>
    </div>
  );
}
