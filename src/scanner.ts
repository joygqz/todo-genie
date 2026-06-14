import type { CancellationToken, Uri } from 'vscode'
import type { Config } from './config'
import { workspace } from 'vscode'

export interface Todo {
  tag: string
  text: string
  uri: Uri
  line: number
  column: number
}

// Skip dependency, build and VCS directories that never hold source TODOs.
const DEFAULT_EXCLUDE = '**/{node_modules,.git,dist,out,build,.next,.nuxt,coverage,vendor}/**'

// Only scan files up to this size — anything larger is generated or binary.
const MAX_FILE_SIZE = 512 * 1024
const MAX_TEXT_LENGTH = 200

// How many files to read at once during a scan.
const MAX_CONCURRENCY = 16

// Comment openers across common languages, required before a tag so plain prose
// like "todo list" in a string isn't picked up. Covers `//` C-family, `/*`
// block, `/+` D, `*` block continuation, `<!--` HTML, `<#` PowerShell, `(*`
// OCaml/F#/Pascal, `{-` Haskell, `#=` Julia, `#` shell, `;` Lisp/ini, `--`
// SQL/Lua/Haskell, `%` LaTeX/Erlang, `"""`/`'''` Python. `#=` precedes `#+` so
// the Julia opener wins over the bare `#`.
const COMMENT_LEADER = String.raw`(?://+|/\*+|/\+|\*+|<!--|<#|\(\*+|\{-|#=|#+|;+|--+|%+|"""|''')`

// Closing delimiters for block / inline comments. Stripped from the end of the
// line *before* matching so they can never bleed into the captured text — e.g.
// the `-->` in `<!-- TODO -->` must not be eaten by the tag separator. Covers
// `*/` C-family, `*)` OCaml/Pascal, `-->` HTML, `-}` Haskell, `#>` PowerShell,
// `=#` Julia, `+/` D, `"""`/`'''` Python.
const COMMENT_CLOSER = /\s*(?:\*\/|\*\)|-{2,}>|-\}|#>|=#|\+\/|"""|''')\s*$/

const decoder = new TextDecoder('utf-8', { fatal: false })

/**
 * Walks the workspace and returns every TODO-style comment found, sorted by
 * file then line. Honours the configured tags and exclude glob.
 */
export async function scan(config: Config, token?: CancellationToken): Promise<Todo[]> {
  const pattern = buildPattern(config.tags)
  const exclude = config.exclude
    ? `{${DEFAULT_EXCLUDE},${config.exclude}}`
    : DEFAULT_EXCLUDE

  const files = await workspace.findFiles('**/*', exclude, undefined, token)
  const todos: Todo[] = []

  // Read files in parallel with a bounded number of workers so large
  // workspaces don't block on one slow read at a time.
  let next = 0
  const worker = async () => {
    while (next < files.length) {
      if (token?.isCancellationRequested) {
        break
      }
      todos.push(...await scanFile(files[next++], pattern))
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENCY, files.length) }, worker),
  )

  return todos.sort((a, b) =>
    a.uri.fsPath.localeCompare(b.uri.fsPath) || a.line - b.line)
}

async function scanFile(uri: Uri, pattern: RegExp): Promise<Todo[]> {
  let bytes: Uint8Array
  try {
    const stat = await workspace.fs.stat(uri)
    if (stat.size > MAX_FILE_SIZE) {
      return []
    }
    bytes = await workspace.fs.readFile(uri)
  }
  catch {
    return []
  }

  // Binary files contain NUL bytes — skip them rather than emit garbage.
  if (bytes.includes(0)) {
    return []
  }

  const todos: Todo[] = []
  const lines = decoder.decode(bytes).split(/\r?\n/)

  lines.forEach((line, index) => {
    // Drop a trailing comment closer first; we only trim the end, so column
    // offsets at the start of the line stay valid.
    const stripped = line.replace(COMMENT_CLOSER, '')
    const match = pattern.exec(stripped)
    if (match) {
      todos.push({
        tag: match[1].toUpperCase(),
        text: clean(match[2]),
        uri,
        line: index,
        column: match.index + match[0].indexOf(match[1]),
      })
    }
  })

  return todos
}

function buildPattern(tags: string[]): RegExp {
  const alternation = tags
    .map(tag => tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  // leader, then the tag as a whole word, an optional separator, then the text.
  // Case-insensitive so `// todo` is found too; the tag is normalised on match.
  return new RegExp(`${COMMENT_LEADER}\\s*(${alternation})\\b[:：\\-\\s]*(.*)`, 'i')
}

function clean(text: string): string {
  const trimmed = text.trim()
  return trimmed.length > MAX_TEXT_LENGTH
    ? `${trimmed.slice(0, MAX_TEXT_LENGTH)}…`
    : trimmed
}
