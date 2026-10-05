import { cn } from '@/lib/cn'

/**
 * The crow that comes to every fresh grave and never quite leaves. It flies in
 * as the lights come up (`landing`), settles on the stone's shoulder, and from
 * then on simply sits there, hunched, blinking, on every visit.
 *
 * Drawn as a silhouette with a little sheen on the back: a crow is mostly
 * posture — the heavy bill, the hunch, the long tail — and that is what reads
 * at this size.
 */
export function Crow({ landing, className }: { landing?: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn('funeral-crow', landing && 'is-landing', className)}
      viewBox="0 0 120 80"
    >
      <defs>
        <linearGradient id="crow-sheen" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#3a4150" />
          <stop offset="0.45" stopColor="#141720" />
          <stop offset="1" stopColor="#07080c" />
        </linearGradient>
      </defs>
      {/* tail: long, slightly fanned, trailing low */}
      <path d="M4 47 L30 38 L33 48 L8 58 Z" fill="#0a0b10" />
      <path d="M6 50 L30 41 L31 46 L9 55 Z" fill="#1b1f29" />
      {/* body, hunched: breast forward and low, back curving up to the nape */}
      <path
        d="M26 44 C28 30 44 20 62 20 C76 20 86 24 92 28 C96 30 97 33 96 36 L94 40 C92 46 84 54 70 57 C56 60 40 58 30 52 C27 50 26 47 26 44 Z"
        fill="url(#crow-sheen)"
      />
      {/* wing, folded along the back; it beats on the way in */}
      <path
        className="crow-wing"
        d="M34 40 C42 28 60 24 78 28 C84 30 88 34 88 38 C76 36 56 38 40 46 C36 47 34 44 34 40 Z"
        fill="#0d0f15"
      />
      {/* head and the heavy bill */}
      <path
        d="M86 24 C90 16 100 15 106 20 C109 23 110 27 109 30 L96 36 C90 36 86 32 86 28 Z"
        fill="#0b0d12"
      />
      <path d="M106 26 L121 31 L105 33 Z" fill="#2b2a28" />
      <path d="M106 27 L118 31 L107 30 Z" fill="#45413a" />
      {/* the eye, and the lid that blinks over it */}
      <circle cx="97" cy="23" r="2.1" fill="#d9d2b6" />
      <circle cx="97.7" cy="22.4" r="0.7" fill="#fff" />
      <rect
        className="crow-lid"
        x="94.4"
        y="20.4"
        width="5.4"
        height="5.4"
        rx="2.7"
        fill="#0b0d12"
      />
      {/* feet gripping the stone */}
      <path
        d="M52 57 L50 68 M50 68 L45 72 M50 68 L54 72 M50 68 L50 73 M66 57 L66 68 M66 68 L61 72 M66 68 L70 72 M66 68 L66 73"
        stroke="#2a2621"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
