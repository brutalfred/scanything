/**
 * Inline SVG filter definitions used by the stylised camera filters
 * (cartoon / disney / comic). Rendered once, hidden, so both the live
 * preview and the capture canvas can reference them by id.
 */
export function PhotoFilterDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {/* Hard posterisation + edge softening = flat cel-shaded look */}
        <filter id="pf-cartoon" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="1.1" result="soft" />
          <feComponentTransfer in="soft">
            <feFuncR type="discrete" tableValues="0 0.25 0.5 0.75 1" />
            <feFuncG type="discrete" tableValues="0 0.25 0.5 0.75 1" />
            <feFuncB type="discrete" tableValues="0 0.25 0.5 0.75 1" />
          </feComponentTransfer>
        </filter>

        {/* Softer, brighter posterisation with a gentle glow — animated-film feel */}
        <filter id="pf-disney" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="1.6" result="soft" />
          <feComponentTransfer in="soft" result="flat">
            <feFuncR type="discrete" tableValues="0.05 0.28 0.48 0.66 0.82 1" />
            <feFuncG type="discrete" tableValues="0.05 0.28 0.48 0.66 0.82 1" />
            <feFuncB type="discrete" tableValues="0.08 0.32 0.52 0.7 0.86 1" />
          </feComponentTransfer>
          <feGaussianBlur in="flat" stdDeviation="6" result="glow" />
          <feBlend in="flat" in2="glow" mode="screen" />
        </filter>

        {/* Heavy posterisation, print-like ink blocks */}
        <filter id="pf-comic" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="0.8" result="soft" />
          <feComponentTransfer in="soft">
            <feFuncR type="discrete" tableValues="0 0.5 1" />
            <feFuncG type="discrete" tableValues="0 0.5 1" />
            <feFuncB type="discrete" tableValues="0 0.5 1" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
