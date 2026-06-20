"use client";

import { trpc } from "../../../lib/trpc-client";
import { Card } from "@rabbitty/ui";
import { Gift, Users, TrendingUp, DollarSign } from "lucide-react";

export default function ReferralsPage() {
  const { data: analytics } = trpc.admin.getReferralAnalytics.useQuery();

  if (!analytics) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-white">Referidos</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  const totalRewardsPaid = analytics.referrals.reduce((s: number, r: { rewardAmount?: number }) => s + (r.rewardAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">Programa de Referidos</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{analytics.totalInviters}</p>
              <p className="text-xs text-gray-400">Invitadores únicos</p>
            </div>
          </div>
        </Card>

        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{analytics.totalInvited}</p>
              <p className="text-xs text-gray-400">Invitados registrados</p>
            </div>
          </div>
        </Card>

        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{analytics.referrals.length}</p>
              <p className="text-xs text-gray-400">Referidos totales</p>
            </div>
          </div>
        </Card>

        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{totalRewardsPaid}</p>
              <p className="text-xs text-gray-400">Bunz en recompensas</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="border border-white/5 bg-white/5 backdrop-blur-md">
        <div className="p-5 border-b border-white/5">
          <h2 className="font-bold text-white">Historial de Referidos</h2>
        </div>
        <div className="divide-y divide-white/5">
          {analytics.referrals.length === 0 && (
            <p className="p-5 text-sm text-gray-500">Sin referidos registrados</p>
          )}
          {analytics.referrals.map((ref: { id: string; invitedId?: string; inviterId?: string; status: string; rewardAmount?: number }) => (
            <div key={ref.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-bold text-white">
                  {ref.invitedId ? `Usuario ${ref.invitedId.slice(0, 8)}...` : "Invitado anónimo"}
                </p>
                <p className="text-xs text-gray-400">Invitado por: {ref.inviterId ? `Usuario ${ref.inviterId.slice(0, 8)}...` : "N/A"}</p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-bold ${ref.status === "COMPLETED" ? "text-emerald-400" : ref.status === "PENDING" ? "text-yellow-400" : "text-red-400"}`}>
                  {ref.status}
                </span>
                {ref.rewardAmount ? (
                  <p className="text-xs text-gray-400">{ref.rewardAmount} Bunz</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
