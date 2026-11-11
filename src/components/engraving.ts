/** The type size that fits `name` on a line `w` × `h` px: the line's height, or less for a long name. */
export function engraving(name: string, w: number, h: number) {
  // (Bold italic serif capitals and lower case run about half an em wide.)
  return Math.max(4, Math.min(h * 0.95, w / Math.max(1, name.length * 0.5)))
}
