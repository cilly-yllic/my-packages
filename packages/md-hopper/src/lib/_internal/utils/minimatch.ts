import { join } from 'path'

const replacePath = (str: string) => str.replace(/\/{2,}/, '/')
export const getExclude = (basePath: string, excludes: string[], skipHidden: boolean) => {
  return [
    '**/node_modules/.*/*',
    '**/node_modules/**/*',
    ...(skipHidden ? ['**/.*/**/*', '**/.*'] : []),
    ...excludes.map(path => replacePath(join(basePath, path))),
  ]
}

export const getInclude = (basePath: string, includes: string[]) => {
  return includes.map(path => replacePath(join(basePath, path)))
}
