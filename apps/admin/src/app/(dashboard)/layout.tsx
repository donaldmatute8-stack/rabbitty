import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@rabbitty/auth";
import { DashboardClientWrapper } from "../../components/DashboardClientWrapper";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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
