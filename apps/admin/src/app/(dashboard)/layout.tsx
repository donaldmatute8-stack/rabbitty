import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@rabbitty/auth";
import { DashboardClientWrapper } from "../../components/DashboardClientWrapper";
import { getEnv } from "@/env";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  getEnv();
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardClientWrapper>
      {children}
    </DashboardClientWrapper>
  );
}
