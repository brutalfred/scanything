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
  // App-only marker used by the remotely loaded site to select Play Billing.
  // Capacitor defines this at the root level, not inside `android`.
  appendUserAgent: "ScanythingAndroid",
  android: {
    allowMixedContent: false,
  },
  server: {
    url: "https://scanything.app",
    androidScheme: "https",
    cleartext: false,
    allowNavigation: [
      "scanything.app",
      "www.scanything.app",
      "*.google.com",
      "*.google.se",
      "accounts.google.com",
      "oauth.lovable.app",
      "*.lovable.app",
    ],
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
