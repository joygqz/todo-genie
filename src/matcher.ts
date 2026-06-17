/** A tag match within a single file's text, before a Uri is attached. */
export interface Match {
  tag: string
  text: string
  line: number
  column: number
  // End column of the meaningful comment content on this line, with the
  // trailing closer and whitespace already stripped. Drives line-mode
  // highlighting so it stops at the text, not at `-->` or `*/`.
  end: number
}

const MAX_TEXT_LENGTH = 200

// Trailing block/inline closer, stripped before matching so it can't bleed into
// the captured text (e.g. the `-->` in `<!-- TODO -->`).
const COMMENT_CLOSER = /\s*(?:\*\/|\*\)|-{2,}>|-\}|#>|=#|\+\/)\s*$/

/** Find every tag match across already-split lines, at most one per line. */
export function findInLines(lines: string[], pattern: RegExp): Match[] {
  const matches: Match[] = []
  lines.forEach((line, index) => {
    // Trim only the trailing closer so leading column offsets stay valid.
    const stripped = line.replace(COMMENT_CLOSER, '')
    const end = stripped.replace(/\s+$/, '').length

    // Take the first tag that isn't inside a string or inline-code span.
    for (const match of stripped.matchAll(pattern)) {
      const column = match.index! + match[0].indexOf(match[1])
      if (insideStringOrCode(stripped, column)) {
        continue
      }
      matches.push({
        tag: match[1].toUpperCase(),
        text: clean(stripped.slice(match.index! + match[0].length)),
        line: index,
        column,
        end,
      })
      break
    }
  })
  return matches
}

export function buildPattern(leaders: string[], tags: string[]): RegExp {
  const leaderAlt = leaders.map(leaderFragment).join('|')
  const tagAlt = tags.map(escapeRegExp).join('|')
  // Leader, tag as a whole word, then an optional separator. The comment text
  // is sliced from after the match rather than captured here: a greedy capture
  // would swallow the rest of the line and stop matchAll after one hit, so a
  // tag buried in a string could mask a real one later on the same line. Case-
  // insensitive and global so `// todo` matches and every marker is walked.
  return new RegExp(`(?:${leaderAlt})\\s*(${tagAlt})\\b[:：\\-\\s]*`, 'gi')
}

/**
 * A marker plus optional repeats of its final character, so `//`, `///`, `/*`,
 * `/**`, `#`, and `###` all open a comment.
 */
function leaderFragment(marker: string): string {
  return `${escapeRegExp(marker) + escapeRegExp(marker[marker.length - 1])}*`
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * True when `index` sits inside a string or inline-code span, like the tag in
 * `const s = "// TODO"`. Tracks the delimiter that opened the span so a `"`
 * nested in a backtick span (or vice versa) counts as content, not a new
 * string — a plain parity count would mis-pair the two. Apostrophes are
 * ignored; they run unbalanced in prose ("don't"). `"` and backticks are
 * assumed balanced: a stray one (rare in a real comment) leaves the span open
 * and can hide a later tag — a trade we accept to keep literals like the
 * example above out.
 */
function insideStringOrCode(line: string, index: number): boolean {
  let open: string | undefined
  for (let i = 0; i < index; i++) {
    const ch = line[i]
    if (ch === '`' || ch === '"') {
      if (open === undefined) {
        open = ch
      }
      else if (open === ch) {
        open = undefined
      }
    }
  }
  return open !== undefined
}

function clean(text: string): string {
  const trimmed = text.trim()
  return trimmed.length > MAX_TEXT_LENGTH
    ? `${trimmed.slice(0, MAX_TEXT_LENGTH)}…`
    : trimmed
}
