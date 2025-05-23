import { resolve, join } from 'path'

import { getAliases } from './get-aliases'
import { writePackageJson } from './write-package-json'

const AUTHOR_NAME = `@cilly`
const ROOT_PATH = resolve()
const SRC_DIR = 'src/lib'
const OUTPUT_DIR = 'dist/lib'

const ALIASES = ['^_core', '^_internal', '\\.json$']

// const aliases = getAliases(join(ROOT_PATH, SRC_DIR), ['^_core', '^_internal', '\\.json$'])

export const write = (projectPath: string, projectName: string) => {
  console.log('Writing package.json files for aliases', projectPath, ROOT_PATH)

  const packageRootPath = join(ROOT_PATH, projectPath)
  const aliases = getAliases(join(packageRootPath, SRC_DIR), ALIASES)
  writePackageJson(packageRootPath, AUTHOR_NAME, projectName, OUTPUT_DIR, aliases, 'modules')
}
