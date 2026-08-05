/**
 * App-wide language support.
 *
 * Interface text uses a built-in dictionary (free, instant, offline).
 * Scan content (item names, descriptions) is translated by AI at runtime —
 * see `translateName` in analyze-room.functions.ts.
 */

export const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Swedish",
  "Italian",
  "Portuguese",
  "Polish",
  "Arabic",
  "Chinese",
  "Japanese",
  "Korean",
  "Hindi",
  "Russian",
  "Thai (ไทย)",
] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "English";
export const LANGUAGE_STORAGE_KEY = "scanything:language";
export const LANGUAGE_EVENT = "scanything:language";

/** Native names shown in the picker so users recognise their language. */
export const LANGUAGE_NATIVE: Record<Language, string> = {
  English: "English",
  Spanish: "Español",
  French: "Français",
  German: "Deutsch",
  Swedish: "Svenska",
  Italian: "Italiano",
  Portuguese: "Português",
  Polish: "Polski",
  Arabic: "العربية",
  Chinese: "中文",
  Japanese: "日本語",
  Korean: "한국어",
  Hindi: "हिन्दी",
  Russian: "Русский",
  "Thai (ไทย)": "ไทย",
};

/** BCP-47 tags for <html lang>. */
export const LANGUAGE_TAG: Record<Language, string> = {
  English: "en",
  Spanish: "es",
  French: "fr",
  German: "de",
  Swedish: "sv",
  Italian: "it",
  Portuguese: "pt",
  Polish: "pl",
  Arabic: "ar",
  Chinese: "zh",
  Japanese: "ja",
  Korean: "ko",
  Hindi: "hi",
  Russian: "ru",
  "Thai (ไทย)": "th",
};

export const RTL_LANGUAGES: Language[] = ["Arabic"];

export function isLanguage(v: unknown): v is Language {
  return typeof v === "string" && (LANGUAGES as readonly string[]).includes(v);
}

/** English dictionary — the source of truth for keys and fallbacks. */
export const EN = {
  // scan surface
  photoScan: "Photo Scan",
  videoScan: "Video Scan",
  resaleScan: "Resale Scan",
  documentScan: "Document Scan",
  photoScanDescription: "Identify objects, people, and text in one still photo.",
  resaleScanDescription: "Values everything for second-hand sale and tells you what's worth listing.",
  documentScanDescription: "Reads text, forms, and documents clearly for easy copying.",
  scanHistory: "Scan History",
  scan: "Scan",
  newScan: "New scan",
  loadMore: "Load more",
  analyzing: "Analyzing…",
  filters: "Filters",
  items: "Items",
  categories: "Categories",
  detectedInView: "Detected in view",
  noItemsYet: "No items yet",
  share: "Share",
  save: "Save",
  pause: "Pause",
  resume: "Resume",
  flashlight: "Flashlight",
  hiddenByFilters: "hidden by filters",

  // item panel
  translate: "Translate",
  free: "free",
  translating: "Translating…",
  estimatedPriceRange: "Estimated price range",
  shopThisItem: "Shop this item",
  learnMore: "Learn more",
  officialVehicleLookup: "Official vehicle lookup",
  analyzeFurther: "Analyze further",
  addPhotoOfItem: "Add photo of this item",
  removePhoto: "Remove photo",
  replacePhoto: "Replace photo",
  tapPhotoToReplace: "Tap a photo to replace it · drag to reorder",
  removeAllPhotos: "Remove all",
  movePhotoLeft: "Move earlier",
  movePhotoRight: "Move later",
  extraPhotosHint: "Extra photos of the same object are analyzed together for a more accurate result.",
  reanalyzeWithPhotos: "Re-analyze with all photos",
  photosLabel: "photos",
  deepAnalysis: "Deep analysis",
  confidence: "confidence",
  bestGuess: "Best guess",
  buyExactProduct: "Buy this exact product",
  reviewsSpecs: "Reviews & specs",
  close: "Close",

  // account
  account: "Account",
  signIn: "Sign in",
  logOut: "Log out",
  credits: "Credits",
  photoScans: "Photo scans",
  creditsSpent: "Credits spent",
  soundEffects: "Sound effects",
  cameraAccess: "Camera access",
  cameraGranted: "Granted — you won't be asked again",
  cameraGrantButton: "Grant camera access",
  cameraRequesting: "Requesting…",
  cameraDeniedHelp:
    "Blocked by your browser. Open the site settings (padlock icon in the address bar) and allow the camera.",
  cameraPromptHelp:
    "Allow once here and choose \"Allow while visiting this site\" so you aren't asked again.",
  muted: "Muted",
  on: "On",
  theme: "Theme",
  language: "Language",
  upgradeToPro: "Upgrade to Pro",
  manageSubscription: "Manage subscription",
  openingPortal: "Opening portal…",
  installApp: "Install app",
  appInstalled: "App installed",
  addToHomeScreen: "Add to desktop / home screen",
  admin: "Admin",
  deleteMyAccount: "Delete my account",
  playHurdles: "Play: 400m Hurdles",

  // credits / top up
  getCredits: "Get credits",
  topUp: "Top up",
  buyCredits: "Buy credits",
  watchCommercial: "Watch a commercial",
  outOfCredits: "Out of credits",

  // check-in
  dailyCheckIn: "Daily check-in",
  checkInToday: "Check in today",
  checkedIn: "Checked in",
  dayStreak: "day streak",

  // dialogs
  warning: "Warning",
  videoDrainsCredits: "Video scanning drains credits fast!",
  continueAction: "Continue",
  goBack: "Go back",
  cancel: "Cancel",

  // misc
  loading: "Loading…",
  tryAgain: "Try again",
  pricing: "Pricing",
  terms: "Terms",
  privacy: "Privacy",
  refunds: "Refunds",
  contact: "Contact",
  signInToScan: "Sign in to scan",

  // item info box + scan history
  resaleValue: "Second-hand resale value",
  worthSelling: "Worth selling",
  notWorthIt: "Not worth it",
  typical: "typical",
  analyzingDetails: "Analyzing details…",
  loadingDetails: "Loading details…",
  translationLabel: "Translation",
  romanized: "Romanized",
  openInGoogleTranslate: "Open in Google Translate",
  couldNotTranslate: "Couldn’t translate confidently.",
  plateOwnerNotice:
    "Owner details are not public. Use an official registry below — you must be authorised and sign in with your own credentials.",
  noScansYet: "No scans yet. Your scans will be saved here automatically.",
  noItemsSaved: "No items were saved for this scan.",
  rename: "Rename",
  deleteAction: "Delete",
  back: "Back",
  item: "item",
  couldNotLoadHistory: "Could not load history.",
} as const;

export type TranslationKey = keyof typeof EN;
export type Dictionary = Partial<Record<TranslationKey, string>>;

import { DICTIONARIES } from "./locales";
import { EXTRA_DICTIONARIES } from "./extra-locales";

export function translateKey(language: Language, key: TranslationKey): string {
  if (language === "English") return EN[key];
  return DICTIONARIES[language]?.[key] ?? EXTRA_DICTIONARIES[language]?.[key] ?? EN[key];
}

