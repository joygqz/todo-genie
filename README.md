# Todo Genie

Find and browse every `TODO`, `FIXME`, `HACK` and other comment marker across your codebase in a single tree view — then jump straight to the line with one click.

## Quick Start

1. Install from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=joygqz.todo-genie)
2. Open the **Todo Genie** view from the Activity Bar
3. Click any item to jump to that comment

The view scans the whole workspace on startup and refreshes automatically as you edit, create or delete files.

## Features

- **Whole-codebase scan** — finds tags in every text file, honouring `files.exclude` / `search.exclude` and skipping binaries
- **Group by tag or file** — toggle from the title bar; file mode nests into a folder tree
- **Collapse or expand all** — one title-bar button toggles the whole tree
- **Click to navigate** — open the file at the exact line
- **Live updates** — edits trigger a debounced rescan
- **Configurable tags** — scan for your own markers

## Settings

| Setting | Description | Default |
| --- | --- | --- |
| `todo-genie.tags` | Comment tags to scan for | `TODO`, `FIXME`, `HACK`, `BUG`, `XXX`, `NOTE` |
| `todo-genie.exclude` | Extra glob patterns to exclude; inherits from `files.exclude` / `search.exclude` | `[]` |

## Commands

- `Todo Genie: Refresh` — rescan the workspace
- `Todo Genie: Toggle Grouping (Tag / File)` — switch how todos are grouped

## License

[MIT](LICENSE)
