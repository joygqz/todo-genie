import type { Event, ProviderResult, TreeDataProvider, Uri } from 'vscode'
import type { GroupBy } from './config'
import type { Todo } from './scanner'
import { EventEmitter, MarkdownString, ThemeColor, ThemeIcon, TreeItem, TreeItemCollapsibleState, workspace } from 'vscode'

/** A group header (a tag or a file) or a single TODO. */
type Node = GroupNode | Todo

interface GroupNode {
  kind: 'group'
  label: string
  iconPath: ThemeIcon
  children: Todo[]
  /** A file path when grouping by file, used for the resource decoration. */
  resourceUri?: Uri
}

export class TodoTree implements TreeDataProvider<Node> {
  private readonly emitter = new EventEmitter<void>()
  readonly onDidChangeTreeData: Event<void> = this.emitter.event

  private todos: Todo[] = []
  private groupBy: GroupBy = 'tag'

  setData(todos: Todo[], groupBy: GroupBy) {
    this.todos = todos
    this.groupBy = groupBy
    this.emitter.fire()
  }

  getChildren(node?: Node): ProviderResult<Node[]> {
    if (node) {
      return isGroup(node) ? node.children : []
    }
    return this.groupBy === 'file' ? this.groupByFile() : this.groupByTag()
  }

  getTreeItem(node: Node): TreeItem {
    return isGroup(node) ? groupItem(node) : todoItem(node)
  }

  private groupByTag(): GroupNode[] {
    const groups = new Map<string, Todo[]>()
    for (const todo of this.todos) {
      const list = groups.get(todo.tag) ?? []
      list.push(todo)
      groups.set(todo.tag, list)
    }

    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([tag, children]) => ({
        kind: 'group' as const,
        label: tag,
        iconPath: new ThemeIcon('tag', new ThemeColor('charts.yellow')),
        children,
      }))
  }

  private groupByFile(): GroupNode[] {
    const groups = new Map<string, Todo[]>()
    for (const todo of this.todos) {
      const key = todo.uri.toString()
      const list = groups.get(key) ?? []
      list.push(todo)
      groups.set(key, list)
    }

    return [...groups.values()]
      .map(children => ({
        kind: 'group' as const,
        label: workspace.asRelativePath(children[0].uri),
        iconPath: ThemeIcon.File,
        resourceUri: children[0].uri,
        children,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }
}

function isGroup(node: Node): node is GroupNode {
  return (node as GroupNode).kind === 'group'
}

function groupItem(group: GroupNode): TreeItem {
  const item = new TreeItem(group.label, TreeItemCollapsibleState.Expanded)
  item.iconPath = group.iconPath
  item.resourceUri = group.resourceUri
  item.description = String(group.children.length)
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

function range(todo: Todo) {
  // A zero-width selection at the tag puts the cursor on the comment.
  const position = { line: todo.line, character: todo.column }
  return { start: position, end: position }
}
