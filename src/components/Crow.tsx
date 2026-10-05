import { cn } from '@/lib/cn'

/**
 * The crow that comes to every fresh grave and never quite leaves. It flies in
 * as the lights come up (`landing`), settles on the stone's shoulder, and from
 * then on simply sits there, blinking, on every visit.
 *
 * Traced from a photograph of a carrion crow standing side-on: a long, sleek
 * body, the flat crown and the heavy bill that make a crow a crow, the folded
 * wing layered along the back with its tip over the tail, a long squared tail,
 * and sturdy scaled legs set well back.
 */
export function Crow({ landing, className }: { landing?: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn('funeral-crow', landing && 'is-landing', className)}
      viewBox="0 0 240 180"
    >
      <defs>
        <linearGradient id="crow-body" x1="0.2" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#3b4553" />
          <stop offset="0.55" stopColor="#171b22" />
          <stop offset="1" stopColor="#07090c" />
        </linearGradient>
        <linearGradient id="crow-wing" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#4a5466" />
          <stop offset="0.6" stopColor="#20252e" />
          <stop offset="1" stopColor="#0d1015" />
        </linearGradient>
      </defs>
      {/* the whole bird: crown, back, tail, belly, breast, throat */}
      <path
        fill="url(#crow-body)"
        d="M 233 44 C 222 34 210 29 200 28 C 194 19 184 15 176 16 C 166 18 158 23 152 30 C 134 38 112 48 92 60 C 76 70 60 84 46 98 C 32 110 18 120 4 126 L 10 134 L 22 130 L 16 138 C 30 130 44 124 58 122 C 76 124 96 128 118 132 C 136 134 154 132 168 120 C 178 110 186 96 190 80 C 193 70 195 62 196 56 C 206 54 220 50 233 44 Z"
      />
      {/* the wing, folded along the back, its tip over the tail; it beats on the way in */}
      <path
        className="crow-wing"
        fill="url(#crow-wing)"
        d="M 150 36 C 130 40 108 50 90 62 C 74 74 60 88 46 104 C 52 108 60 108 68 104 C 88 94 110 80 130 64 C 140 56 148 46 152 40 C 152 38 151 36 150 36 Z"
      />
      <path
        d="M 62 98 C 80 88 96 78 112 66 M 70 106 C 88 96 104 86 120 74 M 54 102 C 72 92 90 82 106 70"
        stroke="#0a0c10"
        strokeWidth="1.2"
        fill="none"
        opacity="0.7"
      />
      {/* shaggy throat */}
      <path fill="#0b0d12" d="M 186 74 C 190 80 191 88 188 94 C 182 90 178 84 180 78 Z" />
      {/* the bill: long, deep at the base, a slight hook */}
      <path
        fill="#1c1d21"
        d="M 198 30 C 212 31 224 36 234 44 C 226 50 214 54 200 56 C 198 48 198 38 198 30 Z"
      />
      <path fill="#33322f" d="M 204 38 C 214 39 224 42 232 45 C 224 49 214 51 204 52 Z" />
      <path d="M 204 44 L 230 45" stroke="#0e0f12" strokeWidth="0.9" />
      {/* the eye, and the lid that blinks over it */}
      <circle cx="184" cy="36" r="3.6" fill="#141518" />
      <circle cx="184" cy="36" r="2.1" fill="#5a5247" />
      <circle cx="185" cy="35" r="0.9" fill="#fff" />
      <rect className="crow-lid" x="180" y="32" width="8" height="8" rx="4" fill="#171b22" />
      {/* legs: sturdy and set back, scaled, toes gripping the stone */}
      <path
        d="M 120 132 L 114 160 M 146 129 L 154 160"
        stroke="#2a2a2e"
        strokeWidth="4.4"
        strokeLinecap="round"
      />
      <path
        d="M 114 160 L 100 167 M 114 160 L 122 169 M 114 160 L 108 170 M 114 160 L 128 164 M 154 160 L 140 167 M 154 160 L 162 169 M 154 160 L 148 170 M 154 160 L 168 164"
        stroke="#2a2a2e"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
