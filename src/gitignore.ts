import ignore from 'ignore'

export interface GitIgnoreSource {
  /** Directory containing the .gitignore, relative to the workspace root. */
  directory: string
  contents: string
}

interface RuleSet {
  directory: string
  matcher: ReturnType<typeof ignore>
}

/**
 * Match workspace-relative paths using Git's layered .gitignore semantics.
 *
 * A nested .gitignore only applies below its own directory and takes
 * precedence over rules inherited from parent directories. Ignore files
 * inside an already ignored directory are deliberately skipped: Git never
 * traverses that directory, so a rule inside it cannot re-include a child.
 */
export class GitIgnoreMatcher {
  private readonly rules: RuleSet[] = []

  constructor(sources: readonly GitIgnoreSource[]) {
    const ordered = [...sources].sort((a, b) =>
      pathDepth(a.directory) - pathDepth(b.directory))

    for (const source of ordered) {
      const directory = normalizePath(source.directory)
      if (directory && this.ignores(`${directory}/`)) {
        continue
      }
      this.rules.push({
        directory,
        matcher: ignore().add(source.contents),
      })
    }
  }

  ignores(path: string): boolean {
    const candidate = normalizePath(path)
    if (!candidate) {
      return false
    }

    let ignored = false
    for (const { directory, matcher } of this.rules) {
      const relative = relativeTo(directory, candidate)
      if (relative === undefined || !relative) {
        continue
      }

      const result = matcher.test(relative)
      if (result.ignored) {
        ignored = true
      }
      else if (result.unignored) {
        ignored = false
      }
    }
    return ignored
  }
}

function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
}

function pathDepth(path: string): number {
  const normalized = normalizePath(path).replace(/\/$/, '')
  return normalized ? normalized.split('/').length : 0
}

function relativeTo(directory: string, path: string): string | undefined {
  if (!directory) {
    return path
  }
  const prefix = `${directory.replace(/\/$/, '')}/`
  return path.startsWith(prefix) ? path.slice(prefix.length) : undefined
}
