import { statSync, existsSync } from 'fs'

import { getAllFiles } from 'my-gadgetry/fs'

export { getAllFiles } from 'my-gadgetry/fs'

export const isDirectory = (path: string) => {
  if (!existsSync(path)) {
    throw new Error('not exists')
  }
  return statSync(path).isDirectory()
}

export const getAllMdFiles = (filenames: string[], ...args: Parameters<typeof getAllFiles>) =>
  getAllFiles(...args).filter(path => filenames.some(filename => path.endsWith(`/${filename}`)))
