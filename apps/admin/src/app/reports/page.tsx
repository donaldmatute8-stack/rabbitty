"use client";

import { trpc } from "../../lib/trpc-client";
import { Card } from "@rabbitty/ui";
import { useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag } from "lucide-react";

export default function ReportsPage() {
  const { data: stats } = trpc.admin.getDashboardStats.useQuery();
  const { data: sales } = trpc.admin.getSalesReport.useQuery({ startDate: "", endDate: "" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500">Análisis de ventas y rendimiento</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ventas Hoy</p>
              <p className="text-xl font-bold text-gray-900">${stats?.totalRevenue ?? "0.00"}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <ShoppingBag className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Órdenes</p>
              <p className="text-xl font-bold text-gray-900">{sales?.totalOrders ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Promedio</p>
              <p className="text-xl font-bold text-gray-900">${sales?.totalSales?.toFixed(2) ?? "0.00"}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-100">
              <DollarSign className="h-5 w-5 text-pink-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Ventas</p>
              <p className="text-xl font-bold text-gray-900">${sales?.totalSales?.toFixed(2) ?? "0.00"}</p>
            </div>
          </div>
        </Card>
       </div>
     </div>
   );
 }
