/**
 * Marketplace registry for Scanything.
 *
 * Each marketplace has a URL builder, supported country regions, and relevant
 * categories. The client filters by region and item category to show only the
 * most useful platforms for a given item.
 */

export type Marketplace = {
  id: string;
  label: string;
  /** ISO 3166-1 alpha-2 country codes where this marketplace is active. */
  regions: string[];
  /** Category keys that match this marketplace. Empty means all categories. */
  categories: string[];
  /** Priority order (lower = higher). */
  priority: number;
  /** Build a marketplace URL from an item. */
  buildUrl: (item: {
    name: string;
    price?: number;
    currency?: string;
  }) => string;
};

/** Global marketplaces. */
const GLOBAL: Marketplace[] = [
  {
    id: "ebay",
    label: "eBay",
    regions: ["US", "GB", "DE", "AU", "CA", "FR", "IT", "ES", "NL"],
    categories: [],
    priority: 1,
    buildUrl: ({ name }) =>
      `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(name)}`,
  },
  {
    id: "amazon",
    label: "Amazon",
    regions: ["US", "GB", "DE", "FR", "IT", "ES", "CA", "JP", "AU"],
    categories: ["electronics", "appliance", "book", "kitchenware", "toy", "instrument"],
    priority: 2,
    buildUrl: ({ name }) =>
      `https://www.amazon.com/s?k=${encodeURIComponent(name)}`,
  },
  {
    id: "walmart",
    label: "Walmart",
    regions: ["US", "CA"],
    categories: ["electronics", "appliance", "kitchenware", "toy", "furniture"],
    priority: 3,
    buildUrl: ({ name }) =>
      `https://www.walmart.com/search?q=${encodeURIComponent(name)}`,
  },
  {
    id: "target",
    label: "Target",
    regions: ["US"],
    categories: ["electronics", "kitchenware", "toy", "furniture", "decor"],
    priority: 4,
    buildUrl: ({ name }) =>
      `https://www.target.com/s?searchTerm=${encodeURIComponent(name)}`,
  },
  {
    id: "bestbuy",
    label: "Best Buy",
    regions: ["US", "CA"],
    categories: ["electronics", "appliance"],
    priority: 3,
    buildUrl: ({ name }) =>
      `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(name)}`,
  },
  {
    id: "newegg",
    label: "Newegg",
    regions: ["US", "CA"],
    categories: ["electronics", "appliance"],
    priority: 4,
    buildUrl: ({ name }) =>
      `https://www.newegg.com/p/pl?d=${encodeURIComponent(name)}`,
  },
  {
    id: "mercari",
    label: "Mercari",
    regions: ["US", "JP"],
    categories: [],
    priority: 3,
    buildUrl: ({ name }) =>
      `https://www.mercari.com/search/?keyword=${encodeURIComponent(name)}`,
  },
  {
    id: "offerup",
    label: "OfferUp",
    regions: ["US"],
    categories: ["furniture", "electronics", "appliance", "decor", "kitchenware"],
    priority: 4,
    buildUrl: ({ name }) =>
      `https://offerup.com/search?q=${encodeURIComponent(name)}`,
  },
  {
    id: "craigslist",
    label: "Craigslist",
    regions: ["US", "CA"],
    categories: ["furniture", "electronics", "appliance", "vehicle"],
    priority: 5,
    buildUrl: ({ name }) =>
      `https://www.craigslist.org/search/sss?query=${encodeURIComponent(name)}`,
  },
];

/** Fashion and clothing marketplaces. */
const FASHION: Marketplace[] = [
  {
    id: "depop",
    label: "Depop",
    regions: ["US", "GB", "IT", "FR", "AU"],
    categories: ["clothing"],
    priority: 2,
    buildUrl: ({ name }) =>
      `https://www.depop.com/search/?q=${encodeURIComponent(name)}`,
  },
  {
    id: "vinted",
    label: "Vinted",
    regions: ["US", "GB", "FR", "DE", "ES", "IT", "PL", "NL"],
    categories: ["clothing"],
    priority: 2,
    buildUrl: ({ name }) =>
      `https://www.vinted.com/catalog?search_text=${encodeURIComponent(name)}`,
  },
  {
    id: "poshmark",
    label: "Poshmark",
    regions: ["US", "CA"],
    categories: ["clothing"],
    priority: 3,
    buildUrl: ({ name }) =>
      `https://poshmark.com/search?query=${encodeURIComponent(name)}`,
  },
  {
    id: "stockx",
    label: "StockX",
    regions: ["US", "GB", "DE", "FR", "CA"],
    categories: ["clothing"],
    priority: 4,
    buildUrl: ({ name }) =>
      `https://stockx.com/search?s=${encodeURIComponent(name)}`,
  },
  {
    id: "goat",
    label: "GOAT",
    regions: ["US", "GB", "CA"],
    categories: ["clothing"],
    priority: 4,
    buildUrl: ({ name }) =>
      `https://www.goat.com/search?query=${encodeURIComponent(name)}`,
  },
  {
    id: "vestiaire",
    label: "Vestiaire Collective",
    regions: ["US", "GB", "FR", "DE", "IT", "ES"],
    categories: ["clothing"],
    priority: 3,
    buildUrl: ({ name }) =>
      `https://us.vestiairecollective.com/search/?q=${encodeURIComponent(name)}`,
  },
];

/** Electronics-specific marketplaces. */
const ELECTRONICS: Marketplace[] = [
  {
    id: "swappa",
    label: "Swappa",
    regions: ["US"],
    categories: ["electronics"],
    priority: 3,
    buildUrl: ({ name }) =>
      `https://swappa.com/market?search=${encodeURIComponent(name)}`,
  },
  {
    id: "backmarket",
    label: "Back Market",
    regions: ["US", "GB", "FR", "DE", "ES", "IT"],
    categories: ["electronics"],
    priority: 4,
    buildUrl: ({ name }) =>
      `https://www.backmarket.com/search?q=${encodeURIComponent(name)}`,
  },
];

/** Furniture and vintage marketplaces. */
const FURNITURE_VINTAGE: Marketplace[] = [
  {
    id: "chairish",
    label: "Chairish",
    regions: ["US"],
    categories: ["furniture", "decor"],
    priority: 3,
    buildUrl: ({ name }) =>
      `https://www.chairish.com/search/?q=${encodeURIComponent(name)}`,
  },
  {
    id: "1stdibs",
    label: "1stDibs",
    regions: ["US", "GB"],
    categories: ["furniture", "decor"],
    priority: 4,
    buildUrl: ({ name }) =>
      `https://www.1stdibs.com/search/?q=${encodeURIComponent(name)}`,
  },
];

/** Musical instruments. */
const INSTRUMENTS: Marketplace[] = [
  {
    id: "reverb",
    label: "Reverb",
    regions: ["US", "GB", "CA", "DE", "FR", "JP"],
    categories: ["instrument"],
    priority: 1,
    buildUrl: ({ name }) =>
      `https://reverb.com/marketplace?query=${encodeURIComponent(name)}`,
  },
];

/** Books and media. */
const MEDIA: Marketplace[] = [
  {
    id: "abebooks",
    label: "AbeBooks",
    regions: ["US", "GB", "CA", "AU", "DE"],
    categories: ["book"],
    priority: 2,
    buildUrl: ({ name }) =>
      `https://www.abebooks.com/servlet/SearchResults?an=${encodeURIComponent(name)}`,
  },
  {
    id: "thriftbooks",
    label: "ThriftBooks",
    regions: ["US", "GB", "CA"],
    categories: ["book"],
    priority: 3,
    buildUrl: ({ name }) =>
      `https://www.thriftbooks.com/browse/?b.search=${encodeURIComponent(name)}`,
  },
  {
    id: "discogs",
    label: "Discogs",
    regions: ["US", "GB", "DE", "JP"],
    categories: ["other"],
    priority: 3,
    buildUrl: ({ name }) =>
      `https://www.discogs.com/search/?q=${encodeURIComponent(name)}`,
  },
];

/** Vehicles. */
const VEHICLES: Marketplace[] = [
  {
    id: "autotrader",
    label: "AutoTrader",
    regions: ["US", "GB"],
    categories: ["vehicle"],
    priority: 2,
    buildUrl: ({ name }) =>
      `https://www.autotrader.com/cars-for-sale/all-cars?search=${encodeURIComponent(name)}`,
  },
  {
    id: "cars",
    label: "Cars.com",
    regions: ["US"],
    categories: ["vehicle"],
    priority: 3,
    buildUrl: ({ name }) =>
      `https://www.cars.com/shopping/results/?search=${encodeURIComponent(name)}`,
  },
  {
    id: "ebaymotors",
    label: "eBay Motors",
    regions: ["US", "GB", "DE", "AU", "CA"],
    categories: ["vehicle"],
    priority: 2,
    buildUrl: ({ name }) =>
      `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(name)}`,
  },
  {
    id: "cargurus",
    label: "CarGurus",
    regions: ["US", "GB", "CA", "DE"],
    categories: ["vehicle"],
    priority: 3,
    buildUrl: ({ name }) =>
      `https://www.cargurus.com/Cars/international/search.action?search=${encodeURIComponent(name)}`,
  },
  {
    id: "mobilede",
    label: "mobile.de",
    regions: ["DE", "AT", "CH"],
    categories: ["vehicle"],
    priority: 3,
    buildUrl: ({ name }) =>
      `https://suchen.mobile.de/fahrzeuge/search.html?search=${encodeURIComponent(name)}`,
  },
];

/** Nordic marketplaces. */
const NORDIC: Marketplace[] = [
  {
    id: "blocket",
    label: "Blocket",
    regions: ["SE"],
    categories: [],
    priority: 1,
    buildUrl: ({ name }) =>
      `https://www.blocket.se/annonser/hela_sverige?q=${encodeURIComponent(name)}`,
  },
  {
    id: "finn",
    label: "FINN.no",
    regions: ["NO"],
    categories: [],
    priority: 1,
    buildUrl: ({ name }) =>
      `https://www.finn.no/bap/forsale/search.html?q=${encodeURIComponent(name)}`,
  },
  {
    id: "tradera",
    label: "Tradera",
    regions: ["SE"],
    categories: [],
    priority: 2,
    buildUrl: ({ name }) =>
      `https://www.tradera.com/en/search?q=${encodeURIComponent(name)}`,
  },
  {
    id: "dba",
    label: "DBA",
    regions: ["DK"],
    categories: [],
    priority: 1,
    buildUrl: ({ name }) =>
      `https://www.dba.dk/soeg/?q=${encodeURIComponent(name)}`,
  },
  {
    id: "tori",
    label: "Tori.fi",
    regions: ["FI"],
    categories: [],
    priority: 1,
    buildUrl: ({ name }) =>
      `https://www.tori.fi/koko_suomi?q=${encodeURIComponent(name)}`,
  },
  {
    id: "willhaben",
    label: "Willhaben",
    regions: ["AT"],
    categories: [],
    priority: 1,
    buildUrl: ({ name }) =>
      `https://www.willhaben.at/iad/gebraucht kaufen/marktplatz?keyword=${encodeURIComponent(name)}`,
  },
];

/** EU / UK marketplaces. */
const EU_UK: Marketplace[] = [
  {
    id: "leboncoin",
    label: "Leboncoin",
    regions: ["FR"],
    categories: [],
    priority: 1,
    buildUrl: ({ name }) =>
      `https://www.leboncoin.fr/recherche?text=${encodeURIComponent(name)}`,
  },
  {
    id: "marktplaats",
    label: "Marktplaats",
    regions: ["NL"],
    categories: [],
    priority: 1,
    buildUrl: ({ name }) =>
      `https://www.marktplaats.nl/q/${encodeURIComponent(name)}/`,
  },
  {
    id: "gumtree",
    label: "Gumtree",
    regions: ["GB", "AU"],
    categories: [],
    priority: 2,
    buildUrl: ({ name }) =>
      `https://www.gumtree.com/search?search_category=all&q=${encodeURIComponent(name)}`,
  },
  {
    id: "shpock",
    label: "Shpock",
    regions: ["GB", "DE", "AT"],
    categories: [],
    priority: 3,
    buildUrl: ({ name }) =>
      `https://www.shpock.com/en/search?query=${encodeURIComponent(name)}`,
  },
  {
    id: "catawiki",
    label: "Catawiki",
    regions: ["NL", "DE", "FR", "IT", "ES", "GB"],
    categories: ["decor", "furniture", "instrument", "book", "other"],
    priority: 4,
    buildUrl: ({ name }) =>
      `https://www.catawiki.com/en/search?query=${encodeURIComponent(name)}`,
  },
];

export const MARKETPLACES: Marketplace[] = [
  ...GLOBAL,
  ...FASHION,
  ...ELECTRONICS,
  ...FURNITURE_VINTAGE,
  ...INSTRUMENTS,
  ...MEDIA,
  ...VEHICLES,
  ...NORDIC,
  ...EU_UK,
];

/** Country codes that can be auto-detected from a time zone. */
export const TIMEZONE_COUNTRY: Record<string, string> = {
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Vienna": "AT",
  "Europe/Zurich": "CH",
  "Europe/Rome": "IT",
  "Europe/Madrid": "ES",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Mexico_City": "MX",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
};

/** Return a best-guess country code from the browser environment. */
export function detectCountry(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const locale =
      navigator.language || (navigator as { languages?: readonly string[] }).languages?.[0] || "en-US";

    const parts = locale.split("-");
    if (parts.length > 1) {
      const code = parts[parts.length - 1].toUpperCase();
      if (code.length === 2) return code;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_COUNTRY[tz] || null;
  } catch {
    return null;
  }
}

/**
 * Score a marketplace for an item in a given country.
 * Higher score = better match.
 */
function scoreMarketplace(
  m: Marketplace,
  country: string | null,
  category: string,
  name: string,
): number {
  let score = 0;

  // Region match: big boost if marketplace serves the user's country.
  if (country && m.regions.includes(country)) {
    score += 100;
  } else if (m.regions.includes("US")) {
    // Fallback to US marketplaces when no country is detected.
    score += 20;
  }

  // Category match.
  if (m.categories.length === 0 || m.categories.includes(category)) {
    score += 50;
  }

  // Priority tie-breaker.
  score -= m.priority;

  return score;
}

/**
 * Return the best marketplaces for an item, sorted by relevance.
 */
export function getMarketplacesForItem(
  item: {
    name: string;
    category: string;
    price?: number;
    currency?: string;
  },
  country: string | null,
): { id: string; label: string; url: string }[] {
  const scored = MARKETPLACES.map((m) => ({
    m,
    score: scoreMarketplace(m, country, item.category, item.name),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter((s) => s.score > 0)
    .slice(0, 8)
    .map((s) => ({
      id: s.m.id,
      label: s.m.label,
      url: s.m.buildUrl(item),
    }));
}

/** Minimal listing draft used by formatting helpers. */


/** Minimal listing draft used by formatting helpers. */
export type ListingDraft = {
  title: string;
  description: string;
  price: number;
  currency: string;
  condition: string;
  category: string;
  keywords: string[];
};

/** Platform-specific listing formats the user can copy and paste. */
export function formatListingForMarketplace(
  draft: ListingDraft,
  marketplaceId: string,
): string {
  const templates: Record<string, (d: ListingDraft) => string> = {
    ebay: (d) =>
      `${d.title}\n\n${d.description}\n\nCondition: ${d.condition}\nPrice: ${d.price} ${d.currency}\n\nKeywords: ${d.keywords.join(", ")}`,
    vinted: (d) =>
      `${d.title}\n\n${d.description}\n\n${d.keywords
        .slice(0, 8)
        .map((k) => `#${k.replace(/\s+/g, "")}`)
        .join(" ")}\n\n${d.price} ${d.currency}`,
    poshmark: (d) =>
      `${d.title}\n\n${d.description}\n\nCondition: ${d.condition}\nPrice: ${d.price} ${d.currency}\n\n${d.keywords
        .slice(0, 5)
        .join(" ")}`,
    mercari: (d) =>
      `${d.title}\n\n${d.description}\n\n${d.condition} · ${d.price} ${d.currency}\n\n${d.keywords.join(", ")}`,
    depop: (d) =>
      `${d.title}\n\n${d.description}\n\n${d.price} ${d.currency}\n\n${d.keywords.slice(0, 6).join(" ")}`,
    facebook: (d) => `${d.title}\n\n${d.description}\n\n${d.price} ${d.currency}`,
    offerup: (d) => `${d.title}\n\n${d.description}\n\n${d.price} ${d.currency}`,
    craigslist: (d) => `${d.title}\n\n${d.description}\n\n${d.price} ${d.currency}`,
    gumtree: (d) => `${d.title}\n\n${d.description}\n\n${d.price} ${d.currency}`,
    shpock: (d) => `${d.title}\n\n${d.description}\n\n${d.price} ${d.currency}`,
    marktplaats: (d) => `${d.title}\n\n${d.description}\n\n${d.price} ${d.currency}`,
    catawiki: (d) => `${d.title}\n\n${d.description}\n\n${d.price} ${d.currency}`,
    default: (d) =>
      `${d.title}\n\n${d.description}\n\nPrice: ${d.price} ${d.currency}\nCondition: ${d.condition}\n\nKeywords: ${d.keywords.join(", ")}`,
  };
  return (templates[marketplaceId] ?? templates["default"])(draft);
}

const SELL_URLS: Record<string, string> = {
  facebook: "https://www.facebook.com/marketplace/create/item",
  poshmark: "https://poshmark.com/create/listing",
  vinted: "https://www.vinted.com/sell/new",
  mercari: "https://www.mercari.com/sell/",
  depop: "https://www.depop.com/sell/",
  offerup: "https://offerup.com/post",
  gumtree: "https://www.gumtree.com/post-ad",
  shpock: "https://www.shpock.com/sell",
  marktplaats: "https://www.marktplaats.nl/pl/a/verkopen.html",
  catawiki: "https://www.catawiki.com/en/sell",
  craigslist: "https://www.craigslist.org/about/sites",
};

/** URL for the platform's listing creation page (or search/home as fallback). */
export function getMarketplaceListingUrl(
  marketplaceId: string,
  item: { name: string },
): string {
  const sell = SELL_URLS[marketplaceId];
  if (sell) return sell;
  const m = MARKETPLACES.find((x) => x.id === marketplaceId);
  return m?.buildUrl(item) ?? "#";
}

/** Quick retailer price comparisons for a product name. */
export function getPriceCompareLinks(
  name: string,
): { label: string; url: string }[] {
  const q = encodeURIComponent(name);
  return [
    { label: "Google Shopping", url: `https://www.google.com/search?tbm=shop&q=${q}` },
    { label: "Amazon", url: `https://www.amazon.com/s?k=${q}` },
    { label: "eBay", url: `https://www.ebay.com/sch/i.html?_nkw=${q}` },
    { label: "Walmart", url: `https://www.walmart.com/search?q=${q}` },
  ];
}

/** Search for the official manual or support page. */
export function getManualSearchUrl(name: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(
    `${name} manual support pdf official`,
  )}`;
}

