import { App } from "@capacitor/app";
import { toast } from "sonner";
import { printEngine } from "./index";

let isInitialized = false;

export function initAppLifecycleHandlers(): () => void {
  if (typeof window === "undefined" || isInitialized) {
    return () => {};
  }

  isInitialized = true;
  let stateListenerHandle: { remove: () => Promise<void> } | null = null;
  let backListenerHandle: { remove: () => Promise<void> } | null = null;

  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  const isNative = Boolean(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());

  if (isNative) {
    // Native mobile app lifecycle
    App.addListener("appStateChange", async ({ isActive }) => {
      if (isActive) {
        console.log("[Lifecycle] App en primer plano. Verificando reconexión de impresora...");
        await printEngine.handleAppResume();
      } else {
        console.log("[Lifecycle] App pausada / en segundo plano.");
      }
    })
      .then((handle) => {
        stateListenerHandle = handle;
      })
      .catch((err) => {
        console.warn("[Lifecycle] No se pudo registrar appStateChange:", err);
      });

    let lastBackPress = 0;
    App.addListener("backButton", ({ canGoBack }) => {
      // Prevent accidental exit from POS terminal on Android back gesture/button
      if (!canGoBack) {
        const now = Date.now();
        if (now - lastBackPress < 2500) {
          App.exitApp();
        } else {
          lastBackPress = now;
          toast.info("Presiona Atrás nuevamente para salir de Rabbitty POS.");
        }
      } else {
        window.history.back();
      }
    })
      .then((handle) => {
        backListenerHandle = handle;
      })
      .catch(() => {});
  }

  // Web fallback: only listen to focus if native, avoiding browser SecurityError prompts
  const handleFocus = () => {
    if (isNative) {
      printEngine.handleAppResume().catch(() => {});
    }
  };

  window.addEventListener("focus", handleFocus);

  return () => {
    isInitialized = false;
    window.removeEventListener("focus", handleFocus);
    if (stateListenerHandle) {
      stateListenerHandle.remove().catch(() => {});
    }
    if (backListenerHandle) {
      backListenerHandle.remove().catch(() => {});
    }
  };
}
