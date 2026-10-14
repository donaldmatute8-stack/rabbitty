import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;

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
  },
};

export default config;
