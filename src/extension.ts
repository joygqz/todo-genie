import type { ExtensionContext, TextDocument, Uri } from 'vscode'
import type { GroupBy } from './config'
import type { Todo } from './scanner'
import { CancellationTokenSource, commands, env, Position, Range, StatusBarAlignment, window, workspace } from 'vscode'
import { getConfig } from './config'
import { TodoDecorator } from './decorator'
import { buildTagColors } from './palette'
import { scan, scanDocument, scanFileTodos } from './scanner'
import { TodoTree } from './tree'

const VIEW_ID = 'todo-genie.todos'
const GROUP_KEY = 'groupBy'
const SCOPE_KEY = 'scope'

type Scope = 'all' | 'file'

let refreshTimer: ReturnType<typeof setTimeout> | undefined
let decorateTimer: ReturnType<typeof setTimeout> | undefined
let activeScan: CancellationTokenSource | undefined

export function activate(context: ExtensionContext) {
  let config = getConfig()
  const tree = new TodoTree()
  const view = window.createTreeView(VIEW_ID, { treeDataProvider: tree })
  const decorator = new TodoDecorator(config)
  const status = window.createStatusBarItem('todo-genie.count', StatusBarAlignment.Left, 0)
  status.command = `${VIEW_ID}.focus`

  const setContext = (key: string, value: unknown) =>
    commands.executeCommand('setContext', key, value)

  // Reflect the current todo count in the view badge and the status bar.
  const updateCounts = () => {
    const count = tree.getTodos().length
    view.badge = count
      ? { value: count, tooltip: `${count} TODO${count === 1 ? '' : 's'}` }
      : undefined
    status.text = `$(checklist) ${count}`
    status.tooltip = `${count} TODO${count === 1 ? '' : 's'}`
    status.show()
  }

  const setCollapsed = (collapsed: boolean) => {
    tree.setCollapsed(collapsed)
    setContext('todo-genie.collapsed', collapsed)
  }
  setCollapsed(false)

  // Grouping and scope are view toggles, not settings, so they live in
  // globalState rather than the configuration.
  let groupBy = context.globalState.get<GroupBy>(GROUP_KEY, 'tag')
  let scope = context.globalState.get<Scope>(SCOPE_KEY, 'all')
  tree.setGroupBy(groupBy)

  // Re-apply the scope filter against whatever file is active. Cheap: it
  // re-filters cached scan results, no rescan.
  const applyScope = () => tree.setScope(scope === 'file', window.activeTextEditor?.document.uri)
  setContext('todo-genie.scope', scope)
  applyScope()

  // Track whether the cursor sits on a tag line, gating the editor's "Reveal in
  // tree" context-menu entry.
  const updateLineContext = () => {
    const editor = window.activeTextEditor
    setContext(
      'todo-genie.onTodoLine',
      !!editor && tree.hasTodoAt(editor.document.uri, editor.selection.active.line),
    )
  }

  const runScan = async () => {
    activeScan?.cancel()
    const source = new CancellationTokenSource()
    activeScan = source

    setContext('todo-genie.scanning', true)
    try {
      const todos = await window.withProgress(
        { location: { viewId: VIEW_ID } },
        () => scan(config, source.token),
      )
      if (!source.token.isCancellationRequested) {
        tree.setData(todos, buildTagColors(config.tags, config.tagColors))
        updateCounts()
        updateLineContext()
      }
    }
    catch (error) {
      if (!source.token.isCancellationRequested) {
        window.showErrorMessage(error instanceof Error ? error.message : String(error))
      }
    }
    finally {
      if (activeScan === source) {
        activeScan = undefined
        setContext('todo-genie.scanning', false)
      }
      source.dispose()
    }
  }

  const toggleGrouping = () => {
    groupBy = groupBy === 'tag' ? 'file' : 'tag'
    context.globalState.update(GROUP_KEY, groupBy)
    tree.setGroupBy(groupBy)
  }

  const toggleScope = () => {
    scope = scope === 'all' ? 'file' : 'all'
    context.globalState.update(SCOPE_KEY, scope)
    setContext('todo-genie.scope', scope)
    applyScope()
  }

  const revealInTree = async () => {
    const editor = window.activeTextEditor
    const todo = editor && tree.find(editor.document.uri, editor.selection.active.line)
    if (todo) {
      await view.reveal(todo, { select: true, focus: true, expand: true })
    }
  }

  const copyText = (todo?: Todo) => copy(todo?.text)
  const copyLocation = (todo?: Todo) =>
    copy(todo && `${workspace.asRelativePath(todo.uri)}:${todo.line + 1}`)

  const openTodo = (todo: Todo) => {
    const position = new Position(todo.line, todo.column)
    return commands.executeCommand('vscode.open', todo.uri, {
      selection: new Range(position, position),
    })
  }

  // Fuzzy-searchable flat list of every todo, jumping to the picked one.
  const search = async () => {
    const todos = tree.getTodos()
    if (todos.length === 0) {
      window.showInformationMessage('No TODO comments found.')
      return
    }
    const picked = await window.showQuickPick(
      todos.map(todo => ({
        label: todo.text || todo.tag,
        description: todo.tag,
        detail: `${workspace.asRelativePath(todo.uri)}:${todo.line + 1}`,
        todo,
      })),
      { placeHolder: 'Search TODO comments', matchOnDescription: true, matchOnDetail: true },
    )
    if (picked) {
      openTodo(picked.todo)
    }
  }

  // Dump every todo to the clipboard as a Markdown checklist grouped by file.
  const copyAll = () => {
    const todos = tree.getTodos()
    if (todos.length === 0) {
      window.showInformationMessage('No TODO comments to copy.')
      return
    }
    const byFile = new Map<string, Todo[]>()
    for (const todo of todos) {
      const file = workspace.asRelativePath(todo.uri)
      const list = byFile.get(file) ?? []
      list.push(todo)
      byFile.set(file, list)
    }
    const lines: string[] = []
    for (const [file, list] of byFile) {
      lines.push(`## ${file}`, '')
      for (const todo of list) {
        lines.push(`- [ ] **${todo.tag}** (L${todo.line + 1}) ${todo.text}`.trimEnd())
      }
      lines.push('')
    }
    env.clipboard.writeText(`${lines.join('\n').trim()}\n`)
    window.showInformationMessage(`Copied ${todos.length} TODO${todos.length === 1 ? '' : 's'}.`)
  }

  // File/folder context-menu actions delegate to VS Code's built-in commands,
  // which expect the resource Uri carried by the clicked tree node.
  const onResource = (command: string) => (node?: { uri?: Uri }) => {
    if (node?.uri) {
      commands.executeCommand(command, node.uri)
    }
  }

  // Coalesce bursts of file-system events into a single rescan.
  const scheduleRefresh = () => {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(runScan, 500)
  }
  // Repaint highlights and refresh the edited file's tree nodes as the user
  // types, debounced to stay off the keystroke path. Watcher events only fire
  // on save, so live edits need their own hook to keep the tree current.
  let liveDoc: TextDocument | undefined
  // Files we've pushed live (pre-save) tree updates to. Only these can hold
  // unsaved todos that diverge from disk, so only these need reconciling when
  // their editor closes — reading any other closed file would be wasted work
  // and could pull in todos the scan's exclude rules deliberately skip.
  const liveEdited = new Set<string>()
  const scheduleDecorate = (document: TextDocument) => {
    liveDoc = document
    clearTimeout(decorateTimer)
    decorateTimer = setTimeout(() => {
      decorator.refresh()
      if (liveDoc) {
        const todos = scanDocument(liveDoc, config.tags)
          .map(match => ({ ...match, uri: liveDoc!.uri }))
        liveEdited.add(liveDoc.uri.toString())
        tree.updateFile(liveDoc.uri, todos)
        updateCounts()
        updateLineContext()
        liveDoc = undefined
      }
    }, 150)
  }

  const onActiveEditor = () => {
    decorator.refresh()
    updateLineContext()
    if (scope === 'file') {
      applyScope()
    }
  }

  const watcher = workspace.createFileSystemWatcher('**/*')
  watcher.onDidCreate(scheduleRefresh)
  watcher.onDidChange(scheduleRefresh)
  watcher.onDidDelete(scheduleRefresh)

  context.subscriptions.push(
    view,
    watcher,
    decorator,
    status,
    commands.registerCommand('todo-genie.refresh', runScan),
    commands.registerCommand('todo-genie.search', search),
    commands.registerCommand('todo-genie.copyAll', copyAll),
    commands.registerCommand('todo-genie.toggleGrouping', toggleGrouping),
    commands.registerCommand('todo-genie.scopeCurrentFile', toggleScope),
    commands.registerCommand('todo-genie.scopeAllFiles', toggleScope),
    commands.registerCommand('todo-genie.collapseAll', () => setCollapsed(true)),
    commands.registerCommand('todo-genie.expandAll', () => setCollapsed(false)),
    commands.registerCommand('todo-genie.revealInTree', revealInTree),
    commands.registerCommand('todo-genie.copyText', copyText),
    commands.registerCommand('todo-genie.copyLocation', copyLocation),
    commands.registerCommand('todo-genie.openFile', onResource('vscode.open')),
    commands.registerCommand('todo-genie.revealInExplorer', onResource('revealInExplorer')),
    commands.registerCommand('todo-genie.revealFileInOS', onResource('revealFileInOS')),
    commands.registerCommand('todo-genie.copyPath', onResource('copyFilePath')),
    commands.registerCommand('todo-genie.copyRelativePath', onResource('copyRelativeFilePath')),
    window.onDidChangeActiveTextEditor(onActiveEditor),
    window.onDidChangeVisibleTextEditors(() => decorator.refresh()),
    window.onDidChangeTextEditorSelection(updateLineContext),
    workspace.onDidChangeTextDocument((event) => {
      // Only visible editors get repainted, so ignore edits to off-screen
      // documents (background buffers, output channels, …).
      if (window.visibleTextEditors.some(editor => editor.document === event.document)) {
        scheduleDecorate(event.document)
      }
    }),
    // A closing document discards its in-memory buffer, taking any unsaved live
    // edits with it. Reconcile such a file against disk so todos typed but never
    // saved don't linger until the next rescan (and untitled buffers, whose disk
    // read yields nothing, get their live todos dropped).
    workspace.onDidCloseTextDocument(async (document) => {
      if (!liveEdited.delete(document.uri.toString())) {
        return
      }
      // Cancel a pending live update for this doc so its stale buffer can't
      // re-add the discarded todos after we reconcile below.
      if (liveDoc === document) {
        clearTimeout(decorateTimer)
        liveDoc = undefined
      }
      tree.updateFile(document.uri, await scanFileTodos(document.uri, config))
      updateCounts()
      updateLineContext()
    }),
    workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('todo-genie')) {
        config = getConfig()
        decorator.setConfig(config)
        runScan()
      }
    }),
    workspace.onDidChangeWorkspaceFolders(runScan),
    { dispose: () => {
      clearTimeout(refreshTimer)
      clearTimeout(decorateTimer)
    } },
  )

  runScan()
  decorator.refresh()
  updateLineContext()
  updateCounts()
}

export function deactivate() {
  clearTimeout(refreshTimer)
  clearTimeout(decorateTimer)
  activeScan?.cancel()
}

function copy(text: string | undefined | false) {
  if (text) {
    env.clipboard.writeText(text)
  }
}
