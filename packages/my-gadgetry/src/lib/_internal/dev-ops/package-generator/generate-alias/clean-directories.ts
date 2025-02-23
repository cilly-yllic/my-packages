import { resolve } from 'path'

import { ensureDirSync, pathExistsSync, removeSync } from 'fs-extra/esm'

export const cleanDirectory = (prefix: string, dir: string) => {
  const path = resolve(prefix, dir)
  if (pathExistsSync(path)) {
    removeSync(path)
  }
  ensureDirSync(path)
}

export const cleanDirectories = (prefix: string, aliases: string[]) => {
  for (const alias of aliases) {
    cleanDirectory(prefix, alias)
  }
}
