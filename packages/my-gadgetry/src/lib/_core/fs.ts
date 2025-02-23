import { statSync, readdirSync } from 'fs'
import { relative } from 'path'

import { minimatch } from 'minimatch'

export interface Options {
  include?: string[]
  exclude?: string[]
  depth?: number
  startDir?: string
}

export const OPTIONS = {
  include: [],
  exclude: [],
  depth: 0,
}

export interface Stacks {
  files: string[]
  depth: number
}

const isMatch = (path: string, patterns: string[]) => {
  return patterns.some(pattern => minimatch(path, pattern))
}

export const getDepth = (path: string) => {
  if (!path) {
    return 0
  }
  let depth = 0
  for (const p of path.replace(/^\.?\/(.*$)/, '$1').split('/')) {
    switch (p) {
      case '..':
        --depth
        break
      default:
        ++depth
        break
    }
  }
  return depth
}

export const isShallow = (from: string, to: string, depth: number) => {
  return getDepth(relative(from, to)) <= depth
}

const _getAllFiles = (dir: string, options: Required<Options>, _files: string[] = []) => {
  const files = readdirSync(dir)
  for (const file of files) {
    const name = `${dir}/${file}`
    if (isMatch(name, options.exclude)) {
      continue
    }
    if (options.depth >= 1 && !isShallow(options.startDir, name, options.depth)) {
      continue
    }
    if (statSync(name).isDirectory()) {
      _getAllFiles(name, options, _files)
    } else {
      if (options.include.length > 0 && !isMatch(name, options.include)) {
        continue
      }
      _files.push(name)
    }
  }
  return _files
}

export const getAllFiles = (startDir: string, _options?: Options) => {
  if (!!_options && 'depth' in _options && typeof _options.depth !== 'undefined' && _options.depth < 1) {
    throw new Error('Invalid depth, must be greater than 0')
  }
  return _getAllFiles(startDir, { ...OPTIONS, ...(_options || {}), startDir })
}
