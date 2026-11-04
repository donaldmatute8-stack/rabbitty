"use client";

/**
 * ── Gate de re-onboarding (tenants existentes) ──
 *
 * Si el dueño tiene un negocio activo sin `onboardingCompletedAt`, se le lleva
 * una sola vez a /onboarding. Ahí ve sus datos YA inyectados y solo confirma.
 *
 * El staff nunca se redirige; el God Admin sin negocio tampoco.
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { trpc } from "../lib/trpc-client";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isOnboarding = pathname === "/onboarding";

  const { data } = trpc.admin.onboardingStatus.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!isOnboarding && data?.pending) {
      router.replace("/onboarding");
    }
  }, [isOnboarding, data?.pending, router]);

  if (!isOnboarding && data?.pending) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-black text-sm text-gray-400">
        Preparando tu bienvenida…
      </div>
    );
  }

  return <>{children}</>;
}
