import packageJson from "../../package.json";

/** Fallback version used in browsers and during SSR. */
export const WEB_APP_VERSION = packageJson.version ?? "1.1";
