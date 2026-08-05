import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android shell for Scanything.
 *
 * The shell loads the live site, so web/UI/AI updates ship without a new
 * Play Store upload. Only wrapper, permission, icon or billing changes
 * require a new AAB.
 */
const config: CapacitorConfig = {
  appId: "app.scanything.scanything",
  appName: "Scanything",
  webDir: "dist/client",
  android: {
    allowMixedContent: false,
    // Lets the remote-loaded web app detect that it runs inside the Play shell.
    appendUserAgent: "ScanythingAndroid",
  },
  server: {
    url: "https://scanything.app",
    androidScheme: "https",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#000000",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000000",
    },
  },
};

export default config;
