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
- **Colour-coded tags** — each tag gets a theme colour, matched between the tree and the editor highlight
- **Activity-bar badge** — the sidebar icon shows the total TODO count
- **Current-file filter** — toggle the title bar to scope the tree to the file you're editing
- **Collapse or expand all** — one title-bar button toggles the whole tree
- **Click to navigate** — open the file at the exact line
- **Reveal in tree** — right-click a tag comment in the editor to jump to its tree node
- **Copy from the tree** — right-click an item to copy its text or location (`path:line`)
- **In-editor highlight** — matching tags are coloured right in the source, with a marker in the scrollbar overview ruler; optionally extend the highlight across the whole comment
- **Live updates** — edits trigger a debounced rescan
- **Configurable tags** — scan for your own markers

## Settings

| Setting | Description | Default |
| --- | --- | --- |
| `todo-genie.tags` | Comment tags to scan for | `TODO`, `FIXME`, `HACK`, `BUG`, `XXX`, `NOTE` |
| `todo-genie.highlight` | How to highlight matching comment tags in the editor: `off`, `tag` (the tag word only), or `line` (through to the end of the comment) | `tag` |
| `todo-genie.exclude` | Extra glob patterns to exclude, on top of `files.exclude` and `search.exclude` (e.g. `**/*.min.js`) | `[]` |

## Commands

- `Todo Genie: Refresh` — rescan the workspace
- `Todo Genie: Toggle Grouping` — switch grouping between tag and file
- `Todo Genie: Show Current File Only` / `Show All Files` — toggle the current-file filter
- `Todo Genie: Collapse All` — collapse every group in the tree
- `Todo Genie: Expand All` — expand every group in the tree
- `Todo Genie: Reveal in Todo Genie` — from a tag comment's editor context menu, select its tree node
- `Todo Genie: Copy Text` / `Copy Location` — from a tree item's context menu

## License

[MIT](LICENSE)
