import { getAllFiles } from './fs'

export const getAliases = (path: string, excludes: string[]) => {
  const regExp = new RegExp(`^${path}/`)
  const excludesExp = new RegExp(excludes.join('|'))
  const aliases = getAllFiles(path).map(path => path.replace(regExp, '').replace(/\.ts$/, ''))
  if (excludes.length) {
    return aliases.filter(path => !excludesExp.test(path))
  }
  return aliases
}
