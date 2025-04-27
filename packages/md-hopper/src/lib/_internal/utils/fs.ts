import { readFileSync, statSync, existsSync } from 'fs'

import { getAllFiles } from 'my-gadgetry/fs'
import { isJson } from 'my-gadgetry/type-check'

export { getAllFiles } from 'my-gadgetry/fs'

export const readJsonFileSync = (path: string, encode: BufferEncoding = 'utf-8') => {
  const json = isJson(readFileSync(path, encode))
  if (!json) {
    return {}
  }
  return json
}

export const isDirectory = (path: string) => {
  if (!existsSync(path)) {
    throw new Error('not exists')
  }
  return statSync(path).isDirectory()
}

export const getAllMdFiles = (filenames: string[], ...args: Parameters<typeof getAllFiles>) =>
  getAllFiles(...args).filter(path => filenames.some(filename => path.endsWith(`/${filename}`)))
