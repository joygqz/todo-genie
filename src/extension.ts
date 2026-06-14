import type { ExtensionContext } from 'vscode'
import type { GroupBy } from './config'
import { CancellationTokenSource, commands, window, workspace } from 'vscode'
import { getConfig } from './config'
import { TodoDecorator } from './decorator'
import { scan } from './scanner'
import { TodoTree } from './tree'

const VIEW_ID = 'todo-genie.todos'
const GROUP_KEY = 'groupBy'

let refreshTimer: ReturnType<typeof setTimeout> | undefined
let decorateTimer: ReturnType<typeof setTimeout> | undefined
let activeScan: CancellationTokenSource | undefined

export function activate(context: ExtensionContext) {
  const tree = new TodoTree()
  const view = window.createTreeView(VIEW_ID, { treeDataProvider: tree })
  const decorator = new TodoDecorator(getConfig())

  const setCollapsed = (collapsed: boolean) => {
    tree.setCollapsed(collapsed)
    commands.executeCommand('setContext', 'todo-genie.collapsed', collapsed)
  }
  setCollapsed(false)

  // Grouping is a view toggle, not a setting, so it lives in globalState.
  let groupBy = context.globalState.get<GroupBy>(GROUP_KEY, 'tag')
  const refresh = () => runScan(tree, groupBy)
  const toggleGrouping = () => {
    groupBy = groupBy === 'tag' ? 'file' : 'tag'
    context.globalState.update(GROUP_KEY, groupBy)
    refresh()
  }
  // Coalesce bursts of file-system events into a single rescan.
  const scheduleRefresh = () => {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(refresh, 500)
  }
  // Repaint highlights as the user types, debounced to stay off the keystroke
  // path. Watcher events only fire on save, so live edits need their own hook.
  const scheduleDecorate = () => {
    clearTimeout(decorateTimer)
    decorateTimer = setTimeout(() => decorator.refresh(), 150)
  }

  const watcher = workspace.createFileSystemWatcher('**/*')
  watcher.onDidCreate(scheduleRefresh)
  watcher.onDidChange(scheduleRefresh)
  watcher.onDidDelete(scheduleRefresh)

  context.subscriptions.push(
    view,
    watcher,
    decorator,
    commands.registerCommand('todo-genie.refresh', refresh),
    commands.registerCommand('todo-genie.toggleGrouping', toggleGrouping),
    commands.registerCommand('todo-genie.collapseAll', () => setCollapsed(true)),
    commands.registerCommand('todo-genie.expandAll', () => setCollapsed(false)),
    window.onDidChangeActiveTextEditor(() => decorator.refresh()),
    window.onDidChangeVisibleTextEditors(() => decorator.refresh()),
    workspace.onDidChangeTextDocument(scheduleDecorate),
    workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('todo-genie')) {
        decorator.setConfig(getConfig())
        refresh()
      }
    }),
    workspace.onDidChangeWorkspaceFolders(refresh),
    { dispose: () => {
      clearTimeout(refreshTimer)
      clearTimeout(decorateTimer)
    } },
  )

  refresh()
  decorator.refresh()
}

export function deactivate() {
  clearTimeout(refreshTimer)
  clearTimeout(decorateTimer)
  activeScan?.cancel()
}

async function runScan(tree: TodoTree, groupBy: GroupBy) {
  activeScan?.cancel()
  const source = new CancellationTokenSource()
  activeScan = source

  const config = getConfig()
  try {
    const todos = await window.withProgress(
      { location: { viewId: VIEW_ID } },
      () => scan(config, source.token),
    )
    if (!source.token.isCancellationRequested) {
      tree.setData(todos, groupBy)
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
    }
    source.dispose()
  }
}
