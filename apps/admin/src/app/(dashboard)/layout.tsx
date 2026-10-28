import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@rabbitty/auth";
import { DashboardClientWrapper } from "../../components/DashboardClientWrapper";
import { getEnv } from "@/env";
import { isGodAdminIdentity, verifyGod2faCookieValue, GOD_2FA_COOKIE } from "@rabbitty/api/services/god2fa";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  getEnv();
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  // ── Gate 2FA God Admin: identidad allowlist exige verificación (TOTP/passkey) ──
  if (isGodAdminIdentity(session.user?.email, session.user?.name)) {
    const cookieStore = await cookies();
    const verified = verifyGod2faCookieValue(cookieStore.get(GOD_2FA_COOKIE)?.value);
    if (!verified) {
      redirect("/verify-2fa");
    }
  }

  return (
    <DashboardClientWrapper>
      {children}
    </DashboardClientWrapper>
  );
}
