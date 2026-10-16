"use client";

import { useEffect } from "react";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

export function useWakeLock() {
  useEffect(() => {
    let wakeLock: WakeLockSentinelLike | null = null;

    const requestWakeLock = async () => {
      try {
        const nav = navigator as NavigatorWithWakeLock;
        if (nav.wakeLock) {
          wakeLock = await nav.wakeLock.request("screen");
        }
      } catch {
        wakeLock = null;
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);
}
