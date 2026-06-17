// Comment markers per language, so a marker only opens a comment where it
// really does (`#` in Python, not in a Vue template). Matching is line-based;
// block bodies match per line via the `*` formatters prefix to each line.
const C_LIKE = ['//', '/*', '*']
const HTML = ['<!--']

const SYNTAX_BY_EXT: Record<string, string[]> = {
  // C family
  js: C_LIKE,
  ts: C_LIKE,
  jsx: C_LIKE,
  tsx: C_LIKE,
  mjs: C_LIKE,
  cjs: C_LIKE,
  mts: C_LIKE,
  cts: C_LIKE,
  c: C_LIKE,
  h: C_LIKE,
  cc: C_LIKE,
  cpp: C_LIKE,
  cxx: C_LIKE,
  hpp: C_LIKE,
  hh: C_LIKE,
  cs: C_LIKE,
  java: C_LIKE,
  go: C_LIKE,
  rs: C_LIKE,
  swift: C_LIKE,
  kt: C_LIKE,
  kts: C_LIKE,
  scala: C_LIKE,
  dart: C_LIKE,
  groovy: C_LIKE,
  gradle: C_LIKE,
  zig: C_LIKE,
  // Web single-file components: HTML comments plus embedded script/style ones
  vue: [...C_LIKE, ...HTML],
  svelte: [...C_LIKE, ...HTML],
  astro: [...C_LIKE, ...HTML],
  // Markup
  html: HTML,
  htm: HTML,
  xml: HTML,
  svg: HTML,
  xhtml: HTML,
  xaml: HTML,
  md: HTML,
  markdown: HTML,
  // Styles
  css: ['/*'],
  scss: ['//', '/*'],
  less: ['//', '/*'],
  sass: ['//', '/*'],
  styl: ['//', '/*'],
  // Hash-comment languages
  py: ['#'],
  pyi: ['#'],
  pyw: ['#'],
  rb: ['#'],
  sh: ['#'],
  bash: ['#'],
  zsh: ['#'],
  fish: ['#'],
  yaml: ['#'],
  yml: ['#'],
  toml: ['#'],
  r: ['#'],
  pl: ['#'],
  pm: ['#'],
  ps1: ['#'],
  ex: ['#'],
  exs: ['#'],
  nim: ['#'],
  cr: ['#'],
  tcl: ['#'],
  env: ['#'],
  ini: ['#', ';'],
  cfg: ['#', ';'],
  conf: ['#', ';'],
  // Dash-comment languages
  sql: ['--', '/*'],
  lua: ['--'],
  hs: ['--', '{-'],
  elm: ['--'],
  purs: ['--'],
  // Lisp family
  clj: [';'],
  cljs: [';'],
  cljc: [';'],
  edn: [';'],
  lisp: [';'],
  scm: [';'],
  el: [';'],
  rkt: [';'],
  // Misc
  php: ['//', '/*', '*', '#'],
  vim: ['"'],
  tex: ['%'],
  latex: ['%'],
  sty: ['%'],
  cls: ['%'],
  erl: ['%'],
  hrl: ['%'],
  vb: ['\''],
}

// Files identified by name rather than extension.
const SYNTAX_BY_NAME: Record<string, string[]> = {
  dockerfile: ['#'],
  makefile: ['#'],
  gnumakefile: ['#'],
}

// Fallback for unknown file types: the most common code comment markers.
const DEFAULT_SYNTAX = ['//', '/*', '*', '#']

/** Resolve a file's comment markers from its name, then extension. */
export function syntaxFor(path: string): string[] {
  const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase()
  const byName = SYNTAX_BY_NAME[name]
  if (byName) {
    return byName
  }
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1) : ''
  return SYNTAX_BY_EXT[ext] ?? DEFAULT_SYNTAX
}
