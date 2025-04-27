import { join } from 'path'

import { Env, ENVS } from '~types/process.js'
import { readJsonFileSync } from '~utils/fs.js'
import { getDirnameFromFileURL } from '~utils/path.js'

export * from '~types/process.js'

// const __dirname = import.meta.dirname
const __dirname = getDirnameFromFileURL(import.meta.url)
export const args = process.argv.slice(2)

export const init = () => {
  const pkg = readJsonFileSync(join(__dirname, '../../..', 'package.json')) as { version: string }
  set(ENVS.PACKAGE_VERSION, pkg.version)
  set(ENVS.IS_DEBUG, bool(process.env.DEBUG) || args.includes('--debug'))
}

const bool = (val: string | undefined | boolean) => {
  if (val === true || val === 'true') {
    return true
  }
  return false
}

// export const IS_DEBUG = bool(process.env.DEBUG) || args.includes('--debug')
// export const IS_LOCAL = bool(process.env.IS_LOCAL)

export const set = (env: Env, value: string | boolean | number) => {
  process.env[env] = `${value}`
}

export const get = (env: Env) => {
  const val = process.env[env]
  if (val === 'true') {
    return true
  }
  if (val === 'false') {
    return false
  }
  return val || ''
}
