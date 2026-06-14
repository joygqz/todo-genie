import { workspace } from 'vscode'

export type GroupBy = 'tag' | 'file'

export interface Config {
  tags: string[]
  exclude: string[]
}

const DEFAULT_TAGS = ['TODO', 'FIXME', 'HACK', 'BUG', 'XXX', 'NOTE']

export function getConfig(): Config {
  const config = workspace.getConfiguration('todo-genie')

  const tags = config.get<string[]>('tags', DEFAULT_TAGS)
    .map(tag => tag.trim())
    .filter(Boolean)

  const exclude = config.get<string[]>('exclude', [])
    .map(glob => glob.trim())
    .filter(Boolean)

  return {
    tags: tags.length ? tags : DEFAULT_TAGS,
    exclude,
  }
}
