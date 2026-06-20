"use client";

import { trpc } from "../../../lib/trpc-client";
import { Card } from "@rabbitty/ui";
import { Award, TrendingUp, Users, Star, Flame, Zap } from "lucide-react";

const LEVEL_ICONS: Record<string, string> = {
  "1": "🥚",
  "2": "🐣",
  "3": "🐰",
  "4": "🦊",
  "5": "🦅",
  "6": "🐉",
};

export default function LoyaltyPage() {
  const { data } = trpc.admin.getLoyaltyStats.useQuery();

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-white">Lealtad</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-white/5" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">Programa de Lealtad</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{data.totalUsers}</p>
              <p className="text-xs text-gray-400">Usuarios registrados</p>
            </div>
          </div>
        </Card>

        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{data.totalBunzEarned.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Bunz ganados totales</p>
            </div>
          </div>
        </Card>

        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{data.totalSpent.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Bunz gastados totales</p>
            </div>
          </div>
        </Card>

        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{data.totalHops.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Hops acumulados</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Niveles */}
      <Card className="border border-white/5 bg-white/5 backdrop-blur-md">
        <div className="p-5 border-b border-white/5">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-pink-400" />
            Niveles de Lealtad
          </h2>
        </div>
        <div className="divide-y divide-white/5">
          {data.levels.map((level) => (
            <div key={level.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-all">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{LEVEL_ICONS[level.requiredHops?.toString()?.[0]] || "⭐"}</span>
                <div>
                  <p className="text-sm font-bold text-white">{level.name}</p>
                  <p className="text-xs text-gray-400">{level.userCount} usuarios</p>
                </div>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>{level.requiredHops} Hops requeridos</p>
                {level.bunzMultiplier && <p className="text-pink-400">×{level.bunzMultiplier} Bunz</p>}
              </div>
            </div>
          ))}
          {data.levels.length === 0 && (
            <p className="p-5 text-sm text-gray-500">Sin niveles configurados</p>
          )}
        </div>
      </Card>

      {/* Top usuarios */}
      <Card className="border border-white/5 bg-white/5 backdrop-blur-md">
        <div className="p-5 border-b border-white/5">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            Top Usuarios por Hops
          </h2>
        </div>
        <div className="divide-y divide-white/5">
          {data.topUsers.map((user, i) => (
            <div key={user.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-all">
              <div className="flex items-center gap-3">
                <span className={`w-6 text-center font-black text-sm ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-500"}`}>
                  #{i + 1}
                </span>
                <div>
                  <p className="text-sm font-bold text-white">{user.firstName || user.username || user.telegramId?.slice(0, 8)}</p>
                  <p className="text-xs text-gray-400">{user.totalBunzEarned} Bunz ganados</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-amber-400">{user.hops} Hops</p>
                <p className="text-xs text-gray-400">{user.totalBunzSpent} gastados</p>
              </div>
            </div>
          ))}
          {data.topUsers.length === 0 && (
            <p className="p-5 text-sm text-gray-500">Sin usuarios registrados</p>
          )}
        </div>
      </Card>
    </div>
  );
}
