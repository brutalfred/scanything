/**
 * Camera filters for the free "Take photo" tool.
 *
 * Every filter is a plain CSS `filter` string so it can be used in three
 * places with identical results: the live <video> preview, the captured
 * frame (canvas `ctx.filter`) and any thumbnail preview. A few stylised
 * looks (cartoon / disney / comic) need posterisation, which CSS alone
 * cannot do — those reference inline SVG filters rendered by
 * <PhotoFilterDefs /> in the page.
 */

export type PhotoFilter = {
  id: string;
  label: string;
  /** CSS filter value; empty string means "no filter". */
  css: string;
};

export const PHOTO_FILTERS: PhotoFilter[] = [
  { id: "none", label: "No filter", css: "" },
  { id: "vivid", label: "Vivid", css: "saturate(1.6) contrast(1.1)" },
  { id: "warm", label: "Warm", css: "sepia(0.25) saturate(1.35) hue-rotate(-10deg)" },
  { id: "cool", label: "Cool", css: "saturate(1.15) hue-rotate(15deg) brightness(1.05)" },
  { id: "mono", label: "Mono", css: "grayscale(1)" },
  { id: "noir", label: "Noir", css: "grayscale(1) contrast(1.5) brightness(0.9)" },
  { id: "sepia", label: "Sepia", css: "sepia(0.8)" },
  {
    id: "vintage",
    label: "Vintage",
    css: "sepia(0.4) contrast(1.1) saturate(0.8) brightness(1.05)",
  },
  { id: "fade", label: "Fade", css: "contrast(0.85) saturate(0.8) brightness(1.1)" },
  { id: "chrome", label: "Chrome", css: "saturate(1.25) contrast(1.15)" },
  { id: "dramatic", label: "Dramatic", css: "contrast(1.5) saturate(1.2) brightness(0.95)" },
  { id: "sunset", label: "Sunset", css: "sepia(0.3) saturate(1.6) hue-rotate(-20deg)" },
  { id: "cyber", label: "Cyber", css: "hue-rotate(200deg) saturate(1.8) contrast(1.2)" },
  { id: "neon", label: "Neon", css: "saturate(2.2) contrast(1.3) brightness(1.05)" },
  { id: "pastel", label: "Pastel", css: "saturate(0.7) brightness(1.15) contrast(0.9)" },
  { id: "frost", label: "Frost", css: "hue-rotate(190deg) brightness(1.1) saturate(1.15)" },
  { id: "invert", label: "Invert", css: "invert(1)" },
  { id: "silver", label: "Silver", css: "grayscale(1) contrast(1.8) brightness(1.05)" },
  {
    id: "cartoon",
    label: "Cartoon",
    css: "url(#pf-cartoon) saturate(1.5) contrast(1.1)",
  },
  {
    id: "disney",
    label: "Disney",
    css: "url(#pf-disney) saturate(1.7) brightness(1.08) contrast(1.05)",
  },
  { id: "comic", label: "Comic", css: "url(#pf-comic) contrast(1.4)" },
];

export function filterCss(id: string): string {
  return PHOTO_FILTERS.find((f) => f.id === id)?.css ?? "";
}
