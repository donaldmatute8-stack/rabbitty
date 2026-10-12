import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.rabbitty.pos",
  appName: "Rabbitty POS",
  webDir: "out",
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: true,
      }
    : {
        androidScheme: "https",
        iosScheme: "https",
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
