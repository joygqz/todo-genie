# Todo Genie

Find and browse every `TODO`, `FIXME`, `HACK` and other comment marker across your codebase in a single tree view — then jump straight to the line with one click.

## Quick Start

1. Install from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=joygqz.todo-genie)
2. Open the **Todo Genie** view from the Activity Bar
3. Click any item to jump to that comment

The view scans the whole workspace on startup and refreshes automatically as you edit, create or delete files.

## Features

- **Whole-codebase scan** — discovers tags across every text file, skipping `node_modules`, build output and binaries automatically
- **Group by tag or file** — toggle from the view title bar to see todos by marker (`TODO`, `FIXME`, …) or by file
- **Click to navigate** — each item opens the file at the exact line
- **Live updates** — file changes trigger a debounced rescan; no manual refresh needed
- **Configurable tags** — scan for your own markers

## Settings

| Setting | Description |
| --- | --- |
| `todo-genie.tags` | Comment tags to scan for (default `TODO`, `FIXME`, `HACK`, `BUG`, `XXX`, `NOTE`) |
| `todo-genie.groupBy` | Group todos by `tag` or `file` |
| `todo-genie.exclude` | Extra glob to exclude, e.g. `**/*.min.js` |

## Commands

- `Todo Genie: Refresh` — rescan the workspace
- `Todo Genie: Toggle Grouping (Tag / File)` — switch how todos are grouped

## License

[MIT](LICENSE)
