/**
 * The stone itself: a granite tablet on a plinth, drawn in SVG so it reads as
 * rock at any size. Texture comes from noise filters (fine speckle lit from
 * above for relief, a cloudier vein underneath), the edge is bevelled, and the
 * years have left lichen, a stain and a hairline crack. The engraving is HTML
 * laid over the tablet (see Headstone), so it stays selectable and scales with
 * text size.
 *
 * Filter ids are suffixed per stone: a page can hold a whole graveyard.
 */
export function StoneFace({ uid }: { uid: string }) {
  const id = (s: string) => `stone-${s}-${uid}`
  return (
    <svg
      aria-hidden="true"
      className="headstone-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMax meet"
    >
      <defs>
        <clipPath id={id('tablet')}>
          <path d={TABLET} />
        </clipPath>
        <linearGradient id={id('granite')} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0" stopColor="#7c8088" />
          <stop offset="0.55" stopColor="#5f636b" />
          <stop offset="1" stopColor="#474a52" />
        </linearGradient>
        <linearGradient id={id('plinth')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a5d64" />
          <stop offset="0.35" stopColor="#44474e" />
          <stop offset="1" stopColor="#2f3137" />
        </linearGradient>
        <radialGradient id={id('sheen')} cx="0.5" cy="0" r="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('lichen')}>
          <stop offset="0" stopColor="#8a9a62" stopOpacity="0.34" />
          <stop offset="1" stopColor="#8a9a62" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('stain')}>
          <stop offset="0" stopColor="#1c1a18" stopOpacity="0.4" />
          <stop offset="1" stopColor="#1c1a18" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('ground')}>
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        {/* Fine mineral speckle, lit from the upper left so each grain has a face. */}
        <filter id={id('speckle')} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.7" numOctaves="2" seed="11" />
          <feDiffuseLighting lightingColor="#fff" surfaceScale="0.55" diffuseConstant="0.85">
            <feDistantLight azimuth="235" elevation="55" />
          </feDiffuseLighting>
          <feComponentTransfer>
            <feFuncR type="linear" slope="0.9" intercept="-0.4" />
            <feFuncG type="linear" slope="0.9" intercept="-0.4" />
            <feFuncB type="linear" slope="0.9" intercept="-0.4" />
          </feComponentTransfer>
        </filter>
        {/* Slow veins through the rock. */}
        <filter id={id('vein')} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.35" />
          </feComponentTransfer>
        </filter>
        <filter id={id('soft')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
      </defs>

      {/* Shadow on the ground. */}
      <ellipse cx="50" cy="97" rx="44" ry="4.5" fill={`url(#${id('ground')})`} />

      {/* Plinth. */}
      <path
        d="M9 86.5 Q9 85 10.5 85 H89.5 Q91 85 91 86.5 V94 Q91 95.5 89.5 95.5 H10.5 Q9 95.5 9 94 Z"
        fill={`url(#${id('plinth')})`}
      />
      <rect x="9" y="85" width="82" height="1" fill="#fff" fillOpacity="0.14" />
      <rect x="9" y="94.3" width="82" height="1.2" fill="#000" fillOpacity="0.35" />
      <g clipPath={`url(#${id('tablet')})`} transform="translate(0 85) scale(1 0.12)">
        <rect width="100" height="100" filter={`url(#${id('speckle')})`} opacity="0.5" />
      </g>

      {/* Tablet. */}
      <path d={TABLET} fill={`url(#${id('granite')})`} />
      <g clipPath={`url(#${id('tablet')})`}>
        <rect
          width="100"
          height="100"
          filter={`url(#${id('vein')})`}
          style={{ mixBlendMode: 'multiply' }}
        />
        <rect
          width="100"
          height="100"
          filter={`url(#${id('speckle')})`}
          opacity="0.32"
          style={{ mixBlendMode: 'overlay' }}
        />
        <rect width="100" height="100" fill={`url(#${id('sheen')})`} />
        {/* The polished panel the inscription is cut into. */}
        <rect x="22" y="27" width="56" height="54" rx="2.5" fill="#000" fillOpacity="0.16" />
        <rect
          x="22.6"
          y="27.6"
          width="54.8"
          height="52.8"
          rx="2.2"
          fill="none"
          stroke="#000"
          strokeOpacity="0.35"
          strokeWidth="0.7"
        />
        <rect
          x="22.6"
          y="27.6"
          width="54.8"
          height="52.8"
          rx="2.2"
          fill="none"
          stroke="#fff"
          strokeOpacity="0.14"
          strokeWidth="0.5"
          transform="translate(0.5 0.5)"
        />
        {/* Weather: lichen creeping in from the shoulder, damp climbing from the base. */}
        <ellipse
          cx="22"
          cy="40"
          rx="11"
          ry="7"
          fill={`url(#${id('lichen')})`}
          transform="rotate(-25 22 40)"
        />
        <ellipse cx="74" cy="26" rx="6" ry="4" fill={`url(#${id('lichen')})`} />
        <ellipse cx="50" cy="88" rx="40" ry="12" fill={`url(#${id('stain')})`} />
        <ellipse cx="80" cy="74" rx="7" ry="12" fill={`url(#${id('stain')})`} opacity="0.6" />
        {/* A hairline crack, lit on one side. */}
        <path
          d="M84 52 L78.5 59 L80.5 64 L75 72"
          fill="none"
          stroke="#fff"
          strokeOpacity="0.28"
          strokeWidth="0.6"
          transform="translate(0.45 0.45)"
        />
        <path
          d="M84 52 L78.5 59 L80.5 64 L75 72"
          fill="none"
          stroke="#1a1b1f"
          strokeOpacity="0.85"
          strokeWidth="0.55"
        />
        {/* Chipped corner. */}
        <path d="M14.5 85 L14.5 81 L18 85 Z" fill="#2a2c32" />
      </g>
      {/* Bevel: light catches the top edge, the right side falls into shade. */}
      <path
        d={TABLET}
        fill="none"
        stroke="#fff"
        strokeOpacity="0.32"
        strokeWidth="0.9"
        filter={`url(#${id('soft')})`}
        transform="translate(0 0.6)"
      />
      <path
        d={TABLET}
        fill="none"
        stroke="#000"
        strokeOpacity="0.45"
        strokeWidth="1.1"
        transform="translate(0.5 -0.4)"
        clipPath={`url(#${id('tablet')})`}
      />
      <path d={TABLET} fill="none" stroke="#14161b" strokeOpacity="0.9" strokeWidth="0.5" />
    </svg>
  )
}

/** A rounded-shoulder tablet, a little wider at the foot, standing on the plinth. */
const TABLET = 'M15.5 85 L15.5 32 C15.5 14.5 29 6 50 6 C71 6 84.5 14.5 84.5 32 L84.5 85 Z'
