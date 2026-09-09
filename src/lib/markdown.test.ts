import { describe, expect, it } from 'vitest'
import rulesDoc from '../../docs/survivor-rules.md?raw'
import { extractMarkedRegion, parseInline, parseMarkdown, type Block } from './markdown'

/** Exactly what the rules page shows a league member. */
const PLAYER_RULES = extractMarkedRegion(
  rulesDoc,
  '<!-- begin-player-rules -->',
  '<!-- end-player-rules -->',
)

const kinds = (blocks: Block[]) => blocks.map((b) => b.kind)
/** Narrows to the one block kind under test, failing loudly if it is absent. */
function only<K extends Block['kind']>(blocks: Block[], kind: K): Extract<Block, { kind: K }> {
  const found = blocks.find((b): b is Extract<Block, { kind: K }> => b.kind === kind)
  if (!found) throw new Error(`no ${kind} block was parsed`)
  return found
}
const text = (blocks: Block[]): string =>
  blocks
    .flatMap((b) => {
      if (b.kind === 'heading' || b.kind === 'paragraph') return b.spans
      if (b.kind === 'list') return b.items.flat()
      return [...b.header.flat(), ...b.rows.flat(2)]
    })
    .map((s) => s.text)
    .join(' ')

describe('parseInline', () => {
  it('splits bold, code and links out of surrounding text', () => {
    expect(parseInline('a **b** c `d` e [f](https://x.test) g')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'strong', text: 'b' },
      { kind: 'text', text: ' c ' },
      { kind: 'code', text: 'd' },
      { kind: 'text', text: ' e ' },
      { kind: 'link', text: 'f', href: 'https://x.test' },
      { kind: 'text', text: ' g' },
    ])
  })

  it('leaves plain text as a single span', () => {
    expect(parseInline('nothing special')).toEqual([{ kind: 'text', text: 'nothing special' }])
  })

  it('reads *emphasis* without swallowing **bold**', () => {
    expect(parseInline('**bold** and *soft*')).toEqual([
      { kind: 'strong', text: 'bold' },
      { kind: 'text', text: ' and ' },
      { kind: 'em', text: 'soft' },
    ])
  })

  it('does not read markup inside a code span', () => {
    expect(parseInline('`**not bold**`')).toEqual([{ kind: 'code', text: '**not bold**' }])
  })

  it('keeps HTML as literal text so it can never become markup', () => {
    expect(parseInline('<script>alert(1)</script>')).toEqual([
      { kind: 'text', text: '<script>alert(1)</script>' },
    ])
  })
})

describe('parseMarkdown', () => {
  it('reads headings, paragraphs, lists and tables', () => {
    const blocks = parseMarkdown(
      ['# Title', '', 'A paragraph', '', '- one', '- two', '', '| a | b |', '|---|---|', '| 1 | 2 |']
        .join('\n'),
    )
    expect(kinds(blocks)).toEqual(['heading', 'paragraph', 'list', 'table'])
    expect(only(blocks, 'heading')).toEqual({
      kind: 'heading',
      level: 1,
      spans: [{ kind: 'text', text: 'Title' }],
    })
    expect(only(blocks, 'list').items).toHaveLength(2)
    const table = only(blocks, 'table')
    expect(table.header).toHaveLength(2)
    // The |---| separator is structure, not a row.
    expect(table.rows).toEqual([[[{ kind: 'text', text: '1' }], [{ kind: 'text', text: '2' }]]])
  })

  it('joins a wrapped bullet into one item', () => {
    const blocks = parseMarkdown('- first line\n  continued here\n- second')
    expect(only(blocks, 'list').items[0]).toEqual([
      { kind: 'text', text: 'first line continued here' },
    ])
  })

  it('drops HTML comments rather than printing them', () => {
    expect(parseMarkdown('before\n\n<!-- a note -->\n\nafter')).toEqual([
      { kind: 'paragraph', spans: [{ kind: 'text', text: 'before' }] },
      { kind: 'paragraph', spans: [{ kind: 'text', text: 'after' }] },
    ])
  })

  it('ignores blank lines instead of emitting empty paragraphs', () => {
    expect(parseMarkdown('\n\n\nhi\n\n\n')).toEqual([
      { kind: 'paragraph', spans: [{ kind: 'text', text: 'hi' }] },
    ])
  })
})

/**
 * The rules page renders the real rulebook, so the parser is tested against
 * that exact document: if someone adds Markdown this subset cannot read, the
 * rules page would quietly lose content and this fails first.
 */
describe('extractMarkedRegion', () => {
  it('returns only what lies between the markers', () => {
    expect(extractMarkedRegion('a<!--s-->b<!--e-->c', '<!--s-->', '<!--e-->')).toBe('b')
  })

  it('falls back to the whole document when a marker is missing', () => {
    expect(extractMarkedRegion('abc', '<!--s-->', '<!--e-->')).toBe('abc')
    expect(extractMarkedRegion('a<!--s-->b', '<!--s-->', '<!--e-->')).toBe('a<!--s-->b')
  })
})

describe('the league rulebook renders', () => {
  const blocks = parseMarkdown(PLAYER_RULES)

  it('is a real slice of the document, not the whole file', () => {
    expect(PLAYER_RULES).not.toBe(rulesDoc)
    expect(PLAYER_RULES.length).toBeGreaterThan(1000)
  })

  /**
   * League members are not maintainers. Notes about the source tree and about
   * how the engine is built belong in the repo, not on the rules page.
   */
  it('leaves the engineering notes out', () => {
    const rendered = text(blocks)
    for (const jargon of [
      'Determinism',
      'evaluateSeason',
      'randomness',
      'src/domain/rules/',
      'covered by',
    ]) {
      expect(rendered, jargon).not.toContain(jargon)
    }
  })

  it('produces the document structure, not one undifferentiated blob', () => {
    expect(blocks.length).toBeGreaterThan(12)
    expect(kinds(blocks)).toContain('table')
    expect(kinds(blocks)).toContain('list')
    expect(blocks.filter((b) => b.kind === 'heading').length).toBeGreaterThanOrEqual(6)
  })

  it('keeps the rules that decide a season', () => {
    const rendered = text(blocks)
    for (const phrase of [
      'one team to win',
      'third miss eliminates',
      'cannot be reused',
      'FIRST non-cancelled kickoff',
      'champion',
    ]) {
      expect(rendered).toContain(phrase)
    }
  })

  it('loses no non-blank source line', () => {
    // Markup characters are consumed by design, so both sides are compared
    // with them stripped: this asserts the words survive, not the syntax.
    const normalize = (v: string) =>
      v
        .replace(/^[-*]\s+/, '')
        .replace(/[#*`[\]()|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    const rendered = normalize(text(blocks))
    const sourceLines = PLAYER_RULES
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !/^\|[\s:|-]+\|$/.test(l))
    for (const line of sourceLines) {
      const words = normalize(line)
      if (words === '') continue
      expect(rendered).toContain(words.split(' ').slice(0, 4).join(' '))
    }
  })
})
