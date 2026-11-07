import { useState } from 'react'
import { getConfig } from '@/config/env'
import type { TrophyFilm } from './crowning'
import { engraving } from './crowning'
import TROPHY from './trophyFrames.json'

const FILM = TROPHY as TrophyFilm
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
  const width = (HEIGHT * FILM.frameWidth) / FILM.frameHeight
  const line = FILM.nameBox
  return (
    <figure className="relative mx-auto" style={{ width, height: HEIGHT }}>
      <img
        src={`${getConfig().basePath}trophy/still.webp`}
        alt={`The league trophy${name ? `, engraved for ${name}` : ''}`}
        width={FILM.frameWidth}
        height={FILM.frameHeight}
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
