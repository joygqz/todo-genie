import type { CancellationToken, TextDocument, Uri } from 'vscode'
import type { Config } from './config'
import type { Match } from './matcher'
import { workspace } from 'vscode'
import { buildPattern, findInLines } from './matcher'
import { syntaxFor } from './syntax'

export type { Match } from './matcher'

export interface Todo extends Match {
  uri: Uri
}

// Only scan files up to this size — anything larger is generated or binary.
const MAX_FILE_SIZE = 512 * 1024

// How many files to read at once during a scan.
const MAX_CONCURRENCY = 16

const decoder = new TextDecoder('utf-8', { fatal: false })

/** Every matching comment in the workspace, sorted by file then line. */
export async function scan(config: Config, token?: CancellationToken): Promise<Todo[]> {
  const files = await workspace.findFiles('**/*', buildExclude(config), undefined, token)
  const todos: Todo[] = []

  // Compile each language's pattern once and share it across its files.
  const patterns = new Map<string, RegExp>()
  const patternFor = (uri: Uri) => {
    const leaders = syntaxFor(uri.path)
    const key = leaders.join(' ')
    let pattern = patterns.get(key)
    if (!pattern) {
      pattern = buildPattern(leaders, config.tags)
      patterns.set(key, pattern)
    }
    return pattern
  }

  // Read files through a bounded worker pool so large workspaces stay parallel.
  let next = 0
  const worker = async () => {
    while (next < files.length) {
      if (token?.isCancellationRequested) {
        break
      }
      const uri = files[next++]
      todos.push(...await scanFile(uri, patternFor(uri)))
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENCY, files.length) }, worker),
  )

  return sortTodos(todos)
}

/** Order todos by file path, then by line — the tree's canonical order. */
export function sortTodos(todos: Todo[]): Todo[] {
  return todos.sort((a, b) =>
    a.uri.fsPath.localeCompare(b.uri.fsPath) || a.line - b.line)
}

/**
 * Merge `todo-genie.exclude` with `files.exclude` / `search.exclude`, which
 * findFiles otherwise ignores once an explicit exclude is passed.
 */
function buildExclude(config: Config): string | null {
  const globals = ['files', 'search'].flatMap(section =>
    Object.entries(workspace.getConfiguration(section).get<Record<string, boolean>>('exclude') ?? {})
      .filter(([, enabled]) => enabled)
      .map(([glob]) => glob))

  const patterns = [...globals, ...config.exclude]
  if (patterns.length === 0) {
    return null
  }
  return patterns.length === 1 ? patterns[0] : `{${patterns.join(',')}}`
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

  const lines = decoder.decode(bytes).split(/\r?\n/)
  return findInLines(lines, pattern).map(match => ({ ...match, uri }))
}

/**
 * Scan a single file from disk, used to reconcile one file's todos with the
 * saved state — e.g. after an editor closes and its unsaved buffer, along with
 * any live tree updates it drove, is discarded. Mirrors one iteration of
 * {@link scan}; returns `[]` for a missing, oversized, or binary file.
 */
export async function scanFileTodos(uri: Uri, config: Config): Promise<Todo[]> {
  return scanFile(uri, buildPattern(syntaxFor(uri.path), config.tags))
}

/**
 * Scan an open document's live (possibly unsaved) text, used to drive editor
 * highlighting and live tree updates. Mirrors {@link scanFile} but works off
 * the in-memory buffer and reuses the same comment markers and tag pattern.
 */
export function scanDocument(document: TextDocument, tags: string[]): Match[] {
  const text = document.getText()
  // Cheap stand-in for scanFile's byte cap: char count avoids re-encoding the
  // whole buffer on every keystroke, and the bound only needs to fence off
  // pathologically large files, not be byte-exact.
  if (text.length > MAX_FILE_SIZE) {
    return []
  }
  const pattern = buildPattern(syntaxFor(document.uri.path), tags)
  return findInLines(text.split(/\r?\n/), pattern)
}
