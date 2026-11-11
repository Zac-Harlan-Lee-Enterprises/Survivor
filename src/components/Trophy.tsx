import { useState } from 'react'
import { getConfig } from '@/config/env'
import { engraving } from './engraving'
import TROPHY from './trophy.json'

/**
 * The trophy, rendered by scripts/art/trophy_scene.py and packed by
 * trophy_film.py: the still, its size, and the plaque's blank line (as
 * fractions of the image) where the champion's name goes.
 */
interface Still {
  src: string
  width: number
  height: number
  nameBox?: { x: number; y: number; w: number; h: number }
}
const STILL: Still = TROPHY
/** How tall it stands on the page (px). */
const HEIGHT = 360

/**
 * The league trophy, standing still with its plaque to the front and the
 * champion's name engraved on it (or the plaque's last line left blank
 * until there is one).
 */
export function Trophy({ name }: { name?: string }) {
  const [missing, setMissing] = useState(false)
  if (missing) return null
  const width = (HEIGHT * STILL.width) / STILL.height
  const line = STILL.nameBox
  return (
    <figure className="relative mx-auto" style={{ width, height: HEIGHT }}>
      <img
        src={`${getConfig().basePath}${STILL.src}`}
        alt={`The league trophy${name ? `, engraved for ${name}` : ''}`}
        width={STILL.width}
        height={STILL.height}
        className="h-full w-full drop-shadow-[0_0_40px_rgba(251,191,36,0.25)]"
        onError={() => setMissing(true)}
      />
      {name && line && (
        <span
          className="trophy-name"
          aria-hidden="true"
          style={{
            left: `${line.x * 100}%`,
            top: `${line.y * 100}%`,
            width: `${line.w * 100}%`,
            height: `${line.h * 100}%`,
            fontSize: engraving(name, width * line.w, HEIGHT * line.h),
          }}
        >
          {name}
        </span>
      )}
    </figure>
  )
}
