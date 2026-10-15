import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL || "http://localhost:3000";

const config: CapacitorConfig = {
  appId: "com.rabbitty.pos",
  appName: "Rabbitty POS",
  webDir: "out",
  server: {
    url: serverUrl,
    cleartext: true,
    androidScheme: "http",
    iosScheme: "http",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#000000",
      showSpinner: false,
    },
  },
};

export default config;
