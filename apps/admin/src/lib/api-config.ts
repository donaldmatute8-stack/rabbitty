/**
 * Resolves the base API URL dynamically depending on whether
 * the application is running in a browser, Capacitor native container, or SSR.
 */

export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).Capacitor?.isNativePlatform?.());
}

export function getApiBaseUrl(): string {
  // 1. Explicit environment variable configured at build/runtime
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }

  // 2. Client-side runtime overrides (e.g. for testing against local staging or custom IP)
  if (typeof window !== "undefined") {
    const customApi = localStorage.getItem("rabbitty_api_url");
    if (customApi) {
      return customApi.replace(/\/$/, "");
    }

    // 3. Native container (iOS/Android) fallback to official production API
    if (isCapacitorNative()) {
      return "https://admin.rabbitty.me";
    }
  }

  // 4. Standard web browser: same origin (empty prefix)
  return "";
}

export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  return `${base}${normalizedPath}`;
}
