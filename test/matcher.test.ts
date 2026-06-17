import { describe, expect, it } from 'vitest'
import { buildPattern, findInLines } from '../src/matcher'

const TAGS = ['TODO', 'FIXME', 'HACK', 'BUG', 'XXX', 'NOTE']

function find(line: string, leaders = ['//', '/*', '*']) {
  return findInLines([line], buildPattern(leaders, TAGS))
}

describe('findInLines', () => {
  it('captures tag, text, line, and column', () => {
    const [match] = find('  // TODO: wire up the API')
    expect(match).toMatchObject({ tag: 'TODO', text: 'wire up the API', line: 0, column: 5 })
  })

  it('upper-cases lower-case tags', () => {
    expect(find('// todo later')[0].tag).toBe('TODO')
  })

  it('matches at most one tag per line, the first real one', () => {
    const matches = find('// TODO first FIXME second')
    expect(matches).toHaveLength(1)
    expect(matches[0].tag).toBe('TODO')
  })

  it('requires a whole-word tag, not a prefix', () => {
    expect(find('// TODOLIST is not a tag')).toHaveLength(0)
  })

  it('needs a comment leader — bare prose does not match', () => {
    expect(find('const TODO = 1')).toHaveLength(0)
  })

  it('ignores a tag inside a string literal', () => {
    expect(find('const s = "// TODO not real"')).toHaveLength(0)
  })

  it('ignores a tag inside a single-quoted string literal', () => {
    expect(find('const [m] = find(\'// TODO not real\')')).toHaveLength(0)
  })

  it('treats a nested quote inside a single-quoted string as content', () => {
    expect(find('find(\'foo("bar") // TODO not real\')')).toHaveLength(0)
  })

  it('treats an escaped quote as a literal, not a delimiter', () => {
    // The \' does not close the surrounding single-quoted span, so the tag
    // stays inside the string and is not matched.
    expect(find('find(\'a\\\'b // TODO not real\')')).toHaveLength(0)
  })

  it('does not let a prose contraction hide a later real tag', () => {
    // The apostrophe in "don't" must not open a phantom string span that
    // swallows the tag following it later on the same line.
    const [match] = find('x++ /* don\'t */ // TODO fix it')
    expect(match?.tag).toBe('TODO')
    expect(match?.text).toBe('fix it')
  })

  it('still finds a real tag after a balanced string on the same line', () => {
    const [match] = find('foo("bar") // TODO real one')
    expect(match?.tag).toBe('TODO')
    expect(match?.text).toBe('real one')
  })

  it('accepts repeated leader characters like /// and /**', () => {
    expect(find('/// TODO triple slash')[0]?.tag).toBe('TODO')
    expect(find('/** TODO jsdoc */')[0]?.tag).toBe('TODO')
  })

  it('strips a trailing block closer from the text and end', () => {
    const [match] = find('<!-- TODO ship it -->', ['<!--'])
    expect(match.text).toBe('ship it')
    expect(match.end).toBe('<!-- TODO ship it'.length)
  })

  it('supports a full-width colon separator', () => {
    expect(find('// TODO：中文冒号')[0].text).toBe('中文冒号')
  })

  it('truncates very long text with an ellipsis', () => {
    const long = 'x'.repeat(500)
    const [match] = find(`// TODO ${long}`)
    expect(match.text.endsWith('…')).toBe(true)
    expect(match.text.length).toBe(201)
  })

  it('honours hash leaders without matching C-style ones', () => {
    expect(find('# TODO python', ['#'])[0]?.tag).toBe('TODO')
    expect(find('// TODO not hash here', ['#'])).toHaveLength(0)
  })
})
