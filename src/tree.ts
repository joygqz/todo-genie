import type { Event, ProviderResult, TreeDataProvider } from 'vscode'
import type { GroupBy } from './config'
import type { Todo } from './scanner'
import { EventEmitter, MarkdownString, Position, Range, ThemeColor, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri, workspace } from 'vscode'

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

  setData(todos: Todo[], groupBy: GroupBy) {
    this.todos = todos
    this.groupBy = groupBy
    this.emitter.fire()
  }

  /** Force every parent node open or closed, then redraw. */
  setCollapsed(collapsed: boolean) {
    this.collapsed = collapsed
    this.emitter.fire()
  }

  getChildren(node?: Node): ProviderResult<Node[]> {
    if (!node) {
      return this.groupBy === 'file' ? this.buildFileTree() : this.buildTagGroups()
    }
    return isParent(node) ? node.children : []
  }

  getTreeItem(node: Node): TreeItem {
    if (!isParent(node)) {
      return todoItem(node)
    }
    const state = this.collapsed
      ? TreeItemCollapsibleState.Collapsed
      : TreeItemCollapsibleState.Expanded
    let item: TreeItem
    switch (node.kind) {
      case 'tag':
        item = tagItem(node, state)
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

  private buildTagGroups(): TagNode[] {
    const groups = new Map<string, Todo[]>()
    for (const todo of this.todos) {
      const list = groups.get(todo.tag) ?? []
      list.push(todo)
      groups.set(todo.tag, list)
    }

    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, children]) => ({ kind: 'tag' as const, id: `tag/${label}`, label, children }))
  }

  private buildFileTree(): Array<DirNode | FileNode> {
    // Collect todos per file, keeping the scanner's line order.
    const byFile = new Map<string, Todo[]>()
    for (const todo of this.todos) {
      const key = todo.uri.toString()
      const list = byFile.get(key) ?? []
      list.push(todo)
      byFile.set(key, list)
    }

    // Build a folder hierarchy from each file's relative path. In multi-root
    // workspaces the leading segment is the workspace folder name, which keeps
    // files from different roots in separate top-level branches.
    const root: DirNode = { kind: 'dir', id: '', label: '', children: [], count: 0 }
    for (const todos of byFile.values()) {
      const uri = todos[0].uri
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
      dir.children.push({ kind: 'file', id: uri.toString(), label: fileName, uri, children: todos })

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

function tagItem(tag: TagNode, state: TreeItemCollapsibleState): TreeItem {
  const item = new TreeItem(tag.label, state)
  item.iconPath = new ThemeIcon('tag', new ThemeColor('charts.yellow'))
  item.description = String(tag.children.length)
  return item
}

function dirItem(dir: DirNode, state: TreeItemCollapsibleState): TreeItem {
  const item = new TreeItem(dir.label, state)
  item.iconPath = ThemeIcon.Folder
  item.resourceUri = dir.uri
  item.description = String(dir.count)
  return item
}

function fileItem(file: FileNode, state: TreeItemCollapsibleState): TreeItem {
  const item = new TreeItem(file.label, state)
  item.iconPath = ThemeIcon.File
  item.resourceUri = file.uri
  item.description = String(file.children.length)
  return item
}

function todoItem(todo: Todo): TreeItem {
  const item = new TreeItem(todo.text || todo.tag)
  item.iconPath = new ThemeIcon('circle-filled', new ThemeColor('charts.blue'))
  item.description = `${workspace.asRelativePath(todo.uri)}:${todo.line + 1}`
  item.tooltip = new MarkdownString(`**${todo.tag}** · ${item.description}\n\n${todo.text}`)
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
