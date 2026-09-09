/**
 * A deliberately small Markdown subset — exactly what `docs/survivor-rules.md`
 * uses: headings, paragraphs, bullet lists, one table, and inline bold, code
 * and links. It is not a general Markdown engine and does not try to be.
 *
 * Why parse at all instead of hand-writing the rules as JSX: the rulebook is
 * the document the domain tests are written against, and a second copy in a
 * component would drift from it the first time a rule changed. Parsing keeps
 * one source of truth.
 *
 * Nothing here produces HTML. Blocks become React elements, so a stray
 * "<script>" in the source document renders as visible text, never as markup.
 */

/**
 * The slice of a document between two HTML-comment markers, or the whole
 * document when either marker is missing.
 *
 * This is how one rulebook serves two audiences: the rules page renders the
 * marked region, while the file keeps the implementation notes that only mean
 * something to someone reading the repo.
 */
export function extractMarkedRegion(source: string, begin: string, end: string): string {
  const from = source.indexOf(begin)
  const to = source.indexOf(end)
  if (from === -1 || to === -1 || to < from) return source
  return source.slice(from + begin.length, to)
}

export type Span =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; spans: Span[] }
  | { kind: 'paragraph'; spans: Span[] }
  | { kind: 'list'; items: Span[][] }
  | { kind: 'table'; header: Span[][]; rows: Span[][][] }

const BULLET = /^\s*[-*]\s+/
const HEADING = /^(#{1,3})\s+(.*)$/
const BLOCK_START = /^(?:#{1,3}\s|\s*[-*]\s|\s*\|)/

/**
 * Bold, emphasis, code and links, matched left to right so the earliest one
 * wins. Bold precedes emphasis in the alternation so "**x**" is never read as
 * an empty emphasis followed by stray asterisks.
 */
function inlineMatcher(): RegExp {
  return /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g
}

export function parseInline(input: string): Span[] {
  const spans: Span[] = []
  const re = inlineMatcher()
  let last = 0
  let m = re.exec(input)
  while (m !== null) {
    if (m.index > last) spans.push({ kind: 'text', text: input.slice(last, m.index) })
    if (m[1] !== undefined) spans.push({ kind: 'strong', text: m[1] })
    else if (m[2] !== undefined) spans.push({ kind: 'em', text: m[2] })
    else if (m[3] !== undefined) spans.push({ kind: 'code', text: m[3] })
    else spans.push({ kind: 'link', text: m[4] ?? '', href: m[5] ?? '' })
    last = m.index + m[0].length
    m = re.exec(input)
  }
  if (last < input.length) spans.push({ kind: 'text', text: input.slice(last) })
  return spans
}

/** Splits "| a | b |" into its cells, tolerating a missing edge pipe. */
function splitRow(line: string): string[] {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|')) t = t.slice(0, -1)
  return t.split('|').map((cell) => cell.trim())
}

const isSeparatorRow = (cells: string[]): boolean =>
  cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c))

export function parseMarkdown(source: string): Block[] {
  // HTML comments are invisible in Markdown; they must not render as text.
  const lines = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (line.trim() === '') {
      i++
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      const level = Math.min(heading[1]?.length ?? 1, 3) as 1 | 2 | 3
      blocks.push({ kind: 'heading', level, spans: parseInline((heading[2] ?? '').trim()) })
      i++
      continue
    }

    if (BULLET.test(line)) {
      const items: Span[][] = []
      while (i < lines.length && BULLET.test(lines[i] ?? '')) {
        let text = (lines[i] ?? '').replace(BULLET, '')
        i++
        // A wrapped bullet continues on an indented line that is not itself a bullet.
        while (i < lines.length) {
          const next = lines[i] ?? ''
          if (next.trim() === '' || BULLET.test(next) || !/^\s+\S/.test(next)) break
          text += ` ${next.trim()}`
          i++
        }
        items.push(parseInline(text))
      }
      blocks.push({ kind: 'list', items })
      continue
    }

    if (line.trimStart().startsWith('|')) {
      const raw: string[][] = []
      while (i < lines.length && (lines[i] ?? '').trimStart().startsWith('|')) {
        raw.push(splitRow(lines[i] ?? ''))
        i++
      }
      const header = raw[0] ?? []
      const body = raw.slice(isSeparatorRow(raw[1] ?? []) ? 2 : 1)
      blocks.push({
        kind: 'table',
        header: header.map((cell) => parseInline(cell)),
        rows: body.map((row) => row.map((cell) => parseInline(cell))),
      })
      continue
    }

    const parts: string[] = []
    while (i < lines.length) {
      const next = lines[i] ?? ''
      if (next.trim() === '' || BLOCK_START.test(next)) break
      parts.push(next.trim())
      i++
    }
    blocks.push({ kind: 'paragraph', spans: parseInline(parts.join(' ')) })
  }

  return blocks
}
