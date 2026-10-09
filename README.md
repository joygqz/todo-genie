# Todo Genie

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/joygqz.todo-genie?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=joygqz.todo-genie)
[![Open VSX](https://img.shields.io/open-vsx/v/joygqz/todo-genie?label=Open%20VSX)](https://open-vsx.org/extension/joygqz/todo-genie)
[![GitHub Release](https://img.shields.io/github/v/release/joygqz/todo-genie?label=GitHub%20Release)](https://github.com/joygqz/todo-genie/releases)

Find and browse every `TODO`, `FIXME`, `HACK` and other comment marker across your codebase in a single tree view — then jump straight to the line with one click.

## Features

- **Whole-codebase scan** — finds tags in every text file, honouring `.gitignore`, `files.exclude`, and `search.exclude`, and skipping binaries.
- **Group by tag or file** — toggle from the title bar; file mode nests into a folder tree.
- **Colour-coded tags** — each tag gets a theme colour, shared between the tree and the editor highlight, and overridable per tag.
- **Search** — title-bar button opens a fuzzy-searchable list of every TODO; pick one to jump to it.
- **Activity-bar badge & status bar** — the sidebar icon and the status bar both show the total TODO count.
- **Current-file filter** — toggle from the title bar to scope the tree to the active file.
- **Collapse or expand all** — one title-bar button toggles the whole tree.
- **Click to navigate** — open the file at the exact line.
- **Reveal in tree** — right-click a tag comment in the editor to select its tree node.
- **Right-click actions** — copy a TODO's text or location (`path:line`); open, reveal, or copy the path of any file or folder.
- **Copy all as Markdown** — export the whole list as a Markdown checklist grouped by file.
- **In-editor highlight** — colours matching tags in the source and marks them in the overview ruler; optionally extend the highlight to the end of the line.
- **Live updates** — the tree and highlights refresh as you type, before you even save.
- **Configurable tags** — scan for your own markers.

## Prerequisites

- VS Code 1.90 or newer.
- A workspace containing text files to scan.

## Installation

Search for **Todo Genie** in the Extensions view (`Ctrl/Cmd+Shift+X`), or visit [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=joygqz.todo-genie) or [Open VSX](https://open-vsx.org/extension/joygqz/todo-genie). You can also install a `.vsix` from [GitHub Releases](https://github.com/joygqz/todo-genie/releases) using **Extensions: Install from VSIX…**.

## Quick Start

1. Open the **Todo Genie** view from the Activity Bar.
2. Click any item to jump to that comment.

The view scans the whole workspace on startup and refreshes automatically as you edit, create or delete files.

## Commands

| Command | Description |
| --- | --- |
| `Todo Genie: Refresh` | Rescan the workspace |
| `Todo Genie: Search TODOs` | Fuzzy-search every TODO and jump to one |
| `Todo Genie: Copy All as Markdown` | Copy the whole list as a Markdown checklist |
| `Todo Genie: Toggle Grouping` | Switch grouping between tag and file |
| `Todo Genie: Show Current File Only` / `Todo Genie: Show All Files` | Toggle the current-file filter |
| `Todo Genie: Collapse All` | Collapse every group in the tree |
| `Todo Genie: Expand All` | Expand every group in the tree |
| `Todo Genie: Reveal in Todo Genie` | From a tag comment's editor context menu, select its tree node |
| `Todo Genie: Copy Text` / `Todo Genie: Copy Location` | Copy a TODO's text or location from its tree context menu |
| `Todo Genie: Open` / `Todo Genie: Reveal in Explorer View` / `Todo Genie: Reveal in File Explorer` / `Todo Genie: Copy Path` / `Todo Genie: Copy Relative Path` | File and folder actions from their tree context menu |

## Settings

| Setting | Description | Default |
| --- | --- | --- |
| `todo-genie.tags` | Comment tags to scan for | `TODO`, `FIXME`, `HACK`, `BUG`, `XXX`, `NOTE` |
| `todo-genie.tagColors` | Override the accent colour per tag with a [theme colour id](https://code.visualstudio.com/api/references/theme-color), e.g. `{ "TODO": "charts.green" }` | `{}` |
| `todo-genie.highlight` | How to highlight matching comment tags in the editor: `off`, `tag` (the tag word only), or `line` (through to the end of the line) | `tag` |
| `todo-genie.exclude` | Extra glob patterns to exclude, on top of `files.exclude` and `search.exclude` (e.g. `**/*.min.js`) | `[]` |
| `todo-genie.respectGitIgnore` | Exclude paths matched by root or nested `.gitignore` files, including negated (`!`) rules | `true` |

## Usage

Open **Todo Genie** from the Activity Bar. Use the view title bar to change grouping, filter to the active file, search, or refresh. Right-click a TODO or file node for copy and navigation actions.

Grouping and scope are saved between sessions. The tree and editor highlights update while you type; workspace scans respect the configured exclusion and `.gitignore` rules.

## Security and Privacy

- Comment scanning runs locally; no API key or external service is required.
- Use `todo-genie.exclude`, `files.exclude`, `search.exclude`, and `todo-genie.respectGitIgnore` to control which files are scanned.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| A comment does not appear | Check `todo-genie.tags`, the file's comment syntax, and exclusion rules. Run **Todo Genie: Refresh**. |
| Only one file appears | Run **Todo Genie: Show All Files** to clear the current-file filter. |
| Highlights are missing | Check `todo-genie.highlight` and use a VS Code theme color ID in `todo-genie.tagColors`. |

## Development

Use Node.js 24 and the pnpm version declared in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm compile
pnpm verify
pnpm ext:package
```

`compile` creates a development bundle; `verify` runs the available static checks and unit tests; `build` verifies and creates the production bundle. `ext:package` builds a VSIX through the same verification gate used in CI. Use `watch` during development.

See [Architecture](docs/ARCHITECTURE.md) for module boundaries and lifecycle rules, and [Contributing](CONTRIBUTING.md) for validation and release conventions.

## Feedback

- Report bugs or request features: [GitHub Issues](https://github.com/joygqz/todo-genie/issues)

## License

[MIT](LICENSE)

Maintained by **Quincy Zhang**.
