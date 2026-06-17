import type { Event, ProviderResult, TreeDataProvider } from 'vscode'
import type { GroupBy } from './config'
import type { TagColors } from './palette'
import type { Todo } from './scanner'
import { EventEmitter, MarkdownString, Position, Range, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri, workspace } from 'vscode'
import { tagColor } from './palette'
import { sortTodos } from './scanner'

/** A tag header, a folder, a file, or a single TODO. */
type Node = TagNode | DirNode | FileNode | Todo

interface TagNode {
  kind: 'tag'
  /** Stable, unique identity used to drive expand/collapse (see getTreeItem). */
  id: string
  label: string
  children: Todo[]
}

interface DirNode {
  kind: 'dir'
  id: string
  /** Folder segment, possibly several joined when single-child chains collapse. */
  label: string
  /** Real folder Uri, so the active file icon theme can pick a folder icon. */
  uri?: Uri
  children: Array<DirNode | FileNode>
  count: number
}

interface FileNode {
  kind: 'file'
  id: string
  label: string
  uri: Uri
  children: Todo[]
}

export class TodoTree implements TreeDataProvider<Node> {
  private readonly emitter = new EventEmitter<void>()
  readonly onDidChangeTreeData: Event<void> = this.emitter.event

  private todos: Todo[] = []
  private groupBy: GroupBy = 'tag'
  private collapsed = false
  private tagColors: TagColors = new Map()

  // Scope filter: when scoped, only `scopeUri`'s todos are shown (or none if no
  // file is active). When not scoped, the whole workspace is shown.
  private scoped = false
  private scopeUri: string | undefined

  // The currently displayed tree, rebuilt whenever data, grouping, or scope
  // changes. Caching it (rather than rebuilding per getChildren call) keeps a
  // stable parent map so the editor's "Reveal in tree" command can walk up.
  private roots: Node[] = []
  private readonly parents = new Map<Node, Node>()
  // Fast "is there a todo here?" lookup, keyed by `uri\0line`.
  private readonly locations = new Set<string>()

  setData(todos: Todo[], tagColors: TagColors) {
    this.todos = todos
    this.tagColors = tagColors
    this.reindex()
    this.rebuild()
  }

  /** Every todo currently held, in canonical order — for search and export. */
  getTodos(): readonly Todo[] {
    return this.todos
  }

  /**
   * Replace one file's todos in place, used for live (pre-save) updates as the
   * user types. `todos` must already carry this file's Uri. A no-op data-wise
   * when nothing changed, but always cheap: the tree is rebuilt from cache.
   */
  updateFile(uri: Uri, todos: Todo[]) {
    const key = uri.toString()
    const rest = this.todos.filter(todo => todo.uri.toString() !== key)
    // Nothing to do when the file had no todos before and has none now — avoids
    // a tree redraw on every keystroke in files without any markers.
    if (rest.length === this.todos.length && todos.length === 0) {
      return
    }
    this.todos = sortTodos([...rest, ...todos])
    this.reindex()
    this.rebuild()
  }

  /** Rebuild the fast location lookup from the current todos. */
  private reindex() {
    this.locations.clear()
    for (const todo of this.todos) {
      this.locations.add(locKey(todo.uri, todo.line))
    }
  }

  setGroupBy(groupBy: GroupBy) {
    this.groupBy = groupBy
    this.rebuild()
  }

  /** Limit the view to one file (or none), or to the whole workspace. */
  setScope(scoped: boolean, uri?: Uri) {
    this.scoped = scoped
    this.scopeUri = uri?.toString()
    this.rebuild()
  }

  /** Force every parent node open or closed, then redraw. */
  setCollapsed(collapsed: boolean) {
    this.collapsed = collapsed
    this.emitter.fire()
  }

  /** True when a tag comment sits on the given line — drives a context key. */
  hasTodoAt(uri: Uri, line: number): boolean {
    return this.locations.has(locKey(uri, line))
  }

  /** The todo node at a location, for revealing it in the tree. */
  find(uri: Uri, line: number): Todo | undefined {
    const key = uri.toString()
    return this.todos.find(todo => todo.line === line && todo.uri.toString() === key)
  }

  getChildren(node?: Node): ProviderResult<Node[]> {
    if (!node) {
      return this.roots
    }
    return isParent(node) ? node.children : []
  }

  getParent(node: Node): ProviderResult<Node> {
    return this.parents.get(node)
  }

  getTreeItem(node: Node): TreeItem {
    if (!isParent(node)) {
      return todoItem(node, this.tagColors)
    }
    const state = this.collapsed
      ? TreeItemCollapsibleState.Collapsed
      : TreeItemCollapsibleState.Expanded
    let item: TreeItem
    switch (node.kind) {
      case 'tag':
        item = tagItem(node, state, this.tagColors)
        break
      case 'dir':
        item = dirItem(node, state)
        break
      case 'file':
        item = fileItem(node, state)
        break
    }
    // VS Code only honours collapsibleState the first time it sees an element
    // id. Encoding the collapsed flag makes every toggle yield fresh ids, so
    // the new state is applied across the whole tree.
    item.id = `${node.id}#${this.collapsed ? 'c' : 'e'}`
    return item
  }

  /** Recompute the displayed tree and its parent map, then redraw. */
  private rebuild() {
    const todos = !this.scoped
      ? this.todos
      : this.scopeUri
        ? this.todos.filter(todo => todo.uri.toString() === this.scopeUri)
        : []

    this.parents.clear()
    this.roots = this.groupBy === 'file'
      ? buildFileTree(todos)
      : buildTagGroups(todos)
    this.linkParents(this.roots, undefined)
    this.emitter.fire()
  }

  /** Record each node's parent so getParent can walk the tree upward. */
  private linkParents(nodes: Node[], parent: Node | undefined) {
    for (const node of nodes) {
      if (parent) {
        this.parents.set(node, parent)
      }
      if (isParent(node)) {
        this.linkParents(node.children, node)
      }
    }
  }
}

function locKey(uri: Uri, line: number): string {
  return `${uri.toString()}\0${line}`
}

function buildTagGroups(todos: Todo[]): TagNode[] {
  const groups = new Map<string, Todo[]>()
  for (const todo of todos) {
    const list = groups.get(todo.tag) ?? []
    list.push(todo)
    groups.set(todo.tag, list)
  }

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, children]) => ({ kind: 'tag' as const, id: `tag/${label}`, label, children }))
}

function buildFileTree(todos: Todo[]): Array<DirNode | FileNode> {
  // Collect todos per file, keeping the scanner's line order.
  const byFile = new Map<string, Todo[]>()
  for (const todo of todos) {
    const key = todo.uri.toString()
    const list = byFile.get(key) ?? []
    list.push(todo)
    byFile.set(key, list)
  }

  // Build a folder hierarchy from each file's relative path. In multi-root
  // workspaces the leading segment is the workspace folder name, which keeps
  // files from different roots in separate top-level branches.
  const root: DirNode = { kind: 'dir', id: '', label: '', children: [], count: 0 }
  for (const fileTodos of byFile.values()) {
    const uri = fileTodos[0].uri
    const segments = workspace.asRelativePath(uri).split('/')
    const fileName = segments.pop()!

    let dir = root
    let path = ''
    const trail: DirNode[] = []
    for (const segment of segments) {
      path += `/${segment}`
      let child = dir.children.find(
        (c): c is DirNode => c.kind === 'dir' && c.label === segment,
      )
      if (!child) {
        child = { kind: 'dir', id: path, label: segment, children: [], count: 0 }
        dir.children.push(child)
      }
      dir = child
      trail.push(child)
    }
    dir.children.push({ kind: 'file', id: uri.toString(), label: fileName, uri, children: fileTodos })

    // Walk up from the file to give each ancestor folder its real Uri.
    let folderUri = Uri.joinPath(uri, '..')
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].uri ??= folderUri
      folderUri = Uri.joinPath(folderUri, '..')
    }
  }

  finalize(root)
  compact(root)
  return root.children
}

function isParent(node: Node): node is TagNode | DirNode | FileNode {
  return 'kind' in node
}

/** Sum todo counts bottom-up and sort each level: folders first, then files. */
function finalize(dir: DirNode): number {
  let count = 0
  for (const child of dir.children) {
    count += child.kind === 'dir' ? finalize(child) : child.children.length
  }
  dir.count = count
  dir.children.sort((a, b) =>
    a.kind === b.kind ? a.label.localeCompare(b.label) : a.kind === 'dir' ? -1 : 1)
  return count
}

/** Collapse single-child folder chains into one node, e.g. `src/components`. */
function compact(dir: DirNode): void {
  for (const child of dir.children) {
    if (child.kind !== 'dir') {
      continue
    }
    while (child.children.length === 1 && child.children[0].kind === 'dir') {
      const only = child.children[0]
      child.label = `${child.label}/${only.label}`
      child.children = only.children
      // Adopt the deepest folder's Uri so its icon matches the joined label.
      child.uri = only.uri
    }
    compact(child)
  }
}

function tagItem(tag: TagNode, state: TreeItemCollapsibleState, colors: TagColors): TreeItem {
  const item = new TreeItem(tag.label, state)
  item.iconPath = new ThemeIcon('tag', tagColor(colors, tag.label))
  item.description = String(tag.children.length)
  return item
}

function dirItem(dir: DirNode, state: TreeItemCollapsibleState): TreeItem {
  const item = new TreeItem(dir.label, state)
  item.iconPath = ThemeIcon.Folder
  item.resourceUri = dir.uri
  item.description = String(dir.count)
  // Marks the item for the folder context-menu `when` clauses.
  item.contextValue = 'dir'
  return item
}

function fileItem(file: FileNode, state: TreeItemCollapsibleState): TreeItem {
  const item = new TreeItem(file.label, state)
  item.iconPath = ThemeIcon.File
  item.resourceUri = file.uri
  item.description = String(file.children.length)
  // Marks the item for the file context-menu `when` clauses.
  item.contextValue = 'file'
  return item
}

function todoItem(todo: Todo, colors: TagColors): TreeItem {
  const item = new TreeItem(todo.text || todo.tag)
  // Colour the dot by tag so the tag is recognisable even in file grouping,
  // where there is no tag header above it.
  item.iconPath = new ThemeIcon('circle-filled', tagColor(colors, todo.tag))
  item.description = `${workspace.asRelativePath(todo.uri)}:${todo.line + 1}`
  item.tooltip = new MarkdownString(`**${todo.tag}** · ${item.description}\n\n${todo.text}`)
  // Marks the item for the copy commands' context-menu `when` clause.
  item.contextValue = 'todo'
  item.command = {
    command: 'vscode.open',
    title: 'Open',
    arguments: [todo.uri, { selection: range(todo) }],
  }
  return item
}

function range(todo: Todo): Range {
  // A zero-width selection at the tag puts the cursor on the comment.
  const position = new Position(todo.line, todo.column)
  return new Range(position, position)
}
