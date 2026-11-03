import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL || "https://app.rabbitty.me";

const config: CapacitorConfig = {
  appId: "com.rabbitty.app",
  appName: "Rabbitty",
  webDir: "out",
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: serverUrl.startsWith("http://"),
        androidScheme: "https",
        iosScheme: "https",
      }
    : {
        androidScheme: "https",
        iosScheme: "https",
      },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#0A0A0A",
      showSpinner: false,
    },
    PushNotifications: {
      // Sin esto, iOS NO muestra nada con la app abierta (el plugin devuelve []).
      // Se vio en device: los pushes llegaban (APNs 200) pero no aparecían.
      presentationOptions: ["banner", "list", "sound", "badge"],
    },
  },
};

export default config;