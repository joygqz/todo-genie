import { describe, expect, it } from 'vitest'
import { GitIgnoreMatcher } from '../src/gitignore'

describe('gitIgnoreMatcher', () => {
  it('applies root ignore rules to files and directories', () => {
    const matcher = new GitIgnoreMatcher([
      { directory: '', contents: 'dist/\n*.min.js' },
    ])

    expect(matcher.ignores('dist/index.js')).toBe(true)
    expect(matcher.ignores('src/vendor.min.js')).toBe(true)
    expect(matcher.ignores('src/index.js')).toBe(false)
  })

  it('preserves negated rules', () => {
    const matcher = new GitIgnoreMatcher([
      { directory: '', contents: '*.log\n!important.log' },
    ])

    expect(matcher.ignores('debug.log')).toBe(true)
    expect(matcher.ignores('important.log')).toBe(false)
  })

  it('lets a nested ignore file override matching parent file rules', () => {
    const matcher = new GitIgnoreMatcher([
      { directory: 'packages/app', contents: '!debug.log' },
      { directory: '', contents: '*.log' },
    ])

    expect(matcher.ignores('packages/app/debug.log')).toBe(false)
    expect(matcher.ignores('packages/api/debug.log')).toBe(true)
  })

  it('does not apply nested rules outside their directory', () => {
    const matcher = new GitIgnoreMatcher([
      { directory: 'packages/app', contents: 'generated/' },
    ])

    expect(matcher.ignores('packages/app/generated/types.ts')).toBe(true)
    expect(matcher.ignores('packages/api/generated/types.ts')).toBe(false)
  })

  it('skips ignore files located inside an ignored directory', () => {
    const matcher = new GitIgnoreMatcher([
      { directory: '', contents: 'vendor/' },
      { directory: 'vendor', contents: '!keep.ts' },
    ])

    expect(matcher.ignores('vendor/keep.ts')).toBe(true)
  })

  it('normalizes Windows-style relative paths', () => {
    const matcher = new GitIgnoreMatcher([
      { directory: 'packages\\app', contents: 'generated/' },
    ])

    expect(matcher.ignores('packages\\app\\generated\\types.ts')).toBe(true)
  })
})
