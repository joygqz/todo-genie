# Todo Genie

Find and browse every `TODO`, `FIXME`, `HACK` and other comment marker across your codebase in a single tree view — then jump straight to the line with one click.

## Quick Start

1. Install from the [VS Marketplace](https://marketplace.visualstudio.com/items?itemName=joygqz.todo-genie) or [Open VSX](https://open-vsx.org/extension/joygqz/todo-genie)
2. Open the **Todo Genie** view from the Activity Bar
3. Click any item to jump to that comment

The view scans the whole workspace on startup and refreshes automatically as you edit, create or delete files.

## Features

- **Whole-codebase scan** — finds tags in every text file, honouring `.gitignore`, `files.exclude`, and `search.exclude`, and skipping binaries
- **Group by tag or file** — toggle from the title bar; file mode nests into a folder tree
- **Colour-coded tags** — each tag gets a theme colour, shared between the tree and the editor highlight, and overridable per tag
- **Search** — title-bar button opens a fuzzy-searchable list of every TODO; pick one to jump to it
- **Activity-bar badge & status bar** — the sidebar icon and the status bar both show the total TODO count
- **Current-file filter** — toggle from the title bar to scope the tree to the active file
- **Collapse or expand all** — one title-bar button toggles the whole tree
- **Click to navigate** — open the file at the exact line
- **Reveal in tree** — right-click a tag comment in the editor to select its tree node
- **Right-click actions** — copy a TODO's text or location (`path:line`); open, reveal, or copy the path of any file or folder
- **Copy all as Markdown** — export the whole list as a Markdown checklist grouped by file
- **In-editor highlight** — colours matching tags in the source and marks them in the overview ruler; optionally extend the highlight to the end of the line
- **Live updates** — the tree and highlights refresh as you type, before you even save
- **Configurable tags** — scan for your own markers

## Settings

| Setting | Description | Default |
| --- | --- | --- |
| `todo-genie.tags` | Comment tags to scan for | `TODO`, `FIXME`, `HACK`, `BUG`, `XXX`, `NOTE` |
| `todo-genie.tagColors` | Override the accent colour per tag with a [theme colour id](https://code.visualstudio.com/api/references/theme-color), e.g. `{ "TODO": "charts.green" }` | `{}` |
| `todo-genie.highlight` | How to highlight matching comment tags in the editor: `off`, `tag` (the tag word only), or `line` (through to the end of the line) | `tag` |
| `todo-genie.exclude` | Extra glob patterns to exclude, on top of `files.exclude` and `search.exclude` (e.g. `**/*.min.js`) | `[]` |
| `todo-genie.respectGitIgnore` | Exclude paths matched by root or nested `.gitignore` files, including negated (`!`) rules | `true` |

## Commands

- `Todo Genie: Refresh` — rescan the workspace
- `Todo Genie: Search TODOs` — fuzzy-search every TODO and jump to one
- `Todo Genie: Copy All as Markdown` — copy the whole list as a Markdown checklist
- `Todo Genie: Toggle Grouping` — switch grouping between tag and file
- `Todo Genie: Show Current File Only` / `Show All Files` — toggle the current-file filter
- `Todo Genie: Collapse All` — collapse every group in the tree
- `Todo Genie: Expand All` — expand every group in the tree
- `Todo Genie: Reveal in Todo Genie` — from a tag comment's editor context menu, select its tree node
- `Copy Text` / `Copy Location` — copy a TODO's text or location from its tree context menu
- `Open` / `Reveal in Explorer View` / `Reveal in File Explorer` / `Copy Path` / `Copy Relative Path` — file and folder actions from their tree context menu

## License

[MIT](LICENSE)
