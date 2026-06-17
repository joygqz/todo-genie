import { describe, expect, it } from 'vitest'
import { syntaxFor } from '../src/syntax'

describe('syntaxFor', () => {
  it('resolves C-like markers by extension', () => {
    expect(syntaxFor('/repo/src/extension.ts')).toEqual(['//', '/*', '*'])
  })

  it('resolves hash markers for Python', () => {
    expect(syntaxFor('/repo/main.py')).toEqual(['#'])
  })

  it('matches known names regardless of case, ignoring the extension path', () => {
    expect(syntaxFor('/repo/Dockerfile')).toEqual(['#'])
    expect(syntaxFor('/repo/MAKEFILE')).toEqual(['#'])
  })

  it('gives single-file components both script and markup markers', () => {
    expect(syntaxFor('/repo/App.vue')).toEqual(['//', '/*', '*', '<!--'])
  })

  it('falls back to the default marker set for unknown extensions', () => {
    expect(syntaxFor('/repo/notes.unknownext')).toEqual(['//', '/*', '*', '#'])
  })

  it('treats a dotfile with no extension via the default set', () => {
    expect(syntaxFor('/repo/.gitignore')).toEqual(['//', '/*', '*', '#'])
  })
})
