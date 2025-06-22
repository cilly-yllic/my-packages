import { readdirSync, statSync } from 'fs'

export const getFiles = (dir: string, _files: string[] = []) => {
  const files = readdirSync(dir)
  for (const file of files) {
    const name = dir + '/' + file
    if (statSync(name).isDirectory()) {
      getFiles(name, _files)
    } else {
      _files.push(name)
    }
  }
  return _files
}
