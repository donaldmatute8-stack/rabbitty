import React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@rabbitty/auth";
import { getEnv } from "@/env";
import {
  isGodAdminIdentity,
  verifyGod2faCookieValue,
  verifyImpersonationCookieValue,
  GOD_2FA_COOKIE,
  GOD_IMP_COOKIE,
} from "@rabbitty/api/services/god2fa";

export const dynamic = "force-dynamic";

/**
 * Layout del God Shell: identidad allowlist + 2FA verificada + NO impersonando.
 * Si estás en Vista Tenant te manda al dashboard del tenant (no puedes operar God desde ahí).
 */
export default async function GodLayout({ children }: { children: React.ReactNode }) {
  getEnv();
  const session = await auth();
  if (!session || !isGodAdminIdentity(session.user?.email, session.user?.name)) {
    redirect("/");
  }

  const cookieStore = await cookies();
  if (!verifyGod2faCookieValue(cookieStore.get(GOD_2FA_COOKIE)?.value)) {
    redirect("/verify-2fa");
  }
  if (verifyImpersonationCookieValue(cookieStore.get(GOD_IMP_COOKIE)?.value)) {
    redirect("/");
  }

  return <>{children}</>;
}
