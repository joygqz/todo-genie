import type { ExtensionContext } from 'vscode'
import type { GroupBy } from './config'
import type { Todo } from './scanner'
import { CancellationTokenSource, commands, env, window, workspace } from 'vscode'
import { getConfig } from './config'
import { TodoDecorator } from './decorator'
import { buildTagColors } from './palette'
import { scan } from './scanner'
import { TodoTree } from './tree'

const VIEW_ID = 'todo-genie.todos'
const GROUP_KEY = 'groupBy'
const SCOPE_KEY = 'scope'

type Scope = 'all' | 'file'

let refreshTimer: ReturnType<typeof setTimeout> | undefined
let decorateTimer: ReturnType<typeof setTimeout> | undefined
let activeScan: CancellationTokenSource | undefined

export function activate(context: ExtensionContext) {
  const tree = new TodoTree()
  const view = window.createTreeView(VIEW_ID, { treeDataProvider: tree })
  const decorator = new TodoDecorator(getConfig())

  const setContext = (key: string, value: unknown) =>
    commands.executeCommand('setContext', key, value)

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

    const config = getConfig()
    setContext('todo-genie.scanning', true)
    try {
      const todos = await window.withProgress(
        { location: { viewId: VIEW_ID } },
        () => scan(config, source.token),
      )
      if (!source.token.isCancellationRequested) {
        tree.setData(todos, buildTagColors(config.tags))
        view.badge = todos.length
          ? { value: todos.length, tooltip: `${todos.length} TODO${todos.length === 1 ? '' : 's'}` }
          : undefined
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

  // Coalesce bursts of file-system events into a single rescan.
  const scheduleRefresh = () => {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(runScan, 500)
  }
  // Repaint highlights as the user types, debounced to stay off the keystroke
  // path. Watcher events only fire on save, so live edits need their own hook.
  const scheduleDecorate = () => {
    clearTimeout(decorateTimer)
    decorateTimer = setTimeout(() => decorator.refresh(), 150)
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
    commands.registerCommand('todo-genie.refresh', runScan),
    commands.registerCommand('todo-genie.toggleGrouping', toggleGrouping),
    commands.registerCommand('todo-genie.scopeCurrentFile', toggleScope),
    commands.registerCommand('todo-genie.scopeAllFiles', toggleScope),
    commands.registerCommand('todo-genie.collapseAll', () => setCollapsed(true)),
    commands.registerCommand('todo-genie.expandAll', () => setCollapsed(false)),
    commands.registerCommand('todo-genie.revealInTree', revealInTree),
    commands.registerCommand('todo-genie.copyText', copyText),
    commands.registerCommand('todo-genie.copyLocation', copyLocation),
    window.onDidChangeActiveTextEditor(onActiveEditor),
    window.onDidChangeVisibleTextEditors(() => decorator.refresh()),
    window.onDidChangeTextEditorSelection(updateLineContext),
    workspace.onDidChangeTextDocument(scheduleDecorate),
    workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('todo-genie')) {
        decorator.setConfig(getConfig())
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
