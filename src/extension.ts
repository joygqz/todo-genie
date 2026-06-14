import type { ExtensionContext } from 'vscode'
import { CancellationTokenSource, commands, ConfigurationTarget, window, workspace } from 'vscode'
import { getConfig } from './config'
import { scan } from './scanner'
import { TodoTree } from './tree'

const VIEW_ID = 'todo-genie.todos'

let refreshTimer: ReturnType<typeof setTimeout> | undefined
let activeScan: CancellationTokenSource | undefined

export function activate(context: ExtensionContext) {
  const tree = new TodoTree()
  const view = window.createTreeView(VIEW_ID, { treeDataProvider: tree, showCollapseAll: true })

  const refresh = () => runScan(tree)
  // Coalesce bursts of file-system events into a single rescan.
  const scheduleRefresh = () => {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(refresh, 500)
  }

  const watcher = workspace.createFileSystemWatcher('**/*')
  watcher.onDidCreate(scheduleRefresh)
  watcher.onDidChange(scheduleRefresh)
  watcher.onDidDelete(scheduleRefresh)

  context.subscriptions.push(
    view,
    watcher,
    commands.registerCommand('todo-genie.refresh', refresh),
    commands.registerCommand('todo-genie.toggleGrouping', toggleGrouping),
    workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('todo-genie')) {
        refresh()
      }
    }),
    workspace.onDidChangeWorkspaceFolders(refresh),
    { dispose: () => clearTimeout(refreshTimer) },
  )

  refresh()
}

export function deactivate() {
  clearTimeout(refreshTimer)
  activeScan?.cancel()
}

async function runScan(tree: TodoTree) {
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
      tree.setData(todos, config.groupBy)
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

async function toggleGrouping() {
  const config = workspace.getConfiguration('todo-genie')
  const next = config.get('groupBy', 'tag') === 'tag' ? 'file' : 'tag'
  await config.update('groupBy', next, ConfigurationTarget.Global)
}
