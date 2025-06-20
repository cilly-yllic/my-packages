import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'

import { ALIASES, Type, TYPES } from '~types/bundle-type.js'
import { ActionArg } from '~types/command.js'
import { BundleOptions } from '~types/options.js'
import { Setting } from '~types/settings.js'
import { importLineRegExp, indentRegExp } from '~utils/configs.js'
import { table, labeledBullet, labeledSuccess } from '~utils/log.js'
import { getFullPath } from '~utils/path.js'
import { ENVS, get } from '~utils/process.js'

const SEPARATOR = '=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'
const fileMap = new Map()
const getRule = (path: string) => readFileSync(path, 'utf-8')

const isDoc = (options: BundleOptions, doc: boolean) => (options.doc === undefined ? doc : JSON.parse(`${options.doc}`))
const importChildren = (rule: string, path: string, options: BundleOptions, doc: boolean) => {
  const directoryPath = dirname(path)
  const matches = rule.match(importLineRegExp)
  if (!matches) {
    return rule
  }
  for (const match of matches) {
    const filename = match.replace(importLineRegExp, '$1')
    const filepath = join(directoryPath, filename)
    labeledBullet('read rule', filepath)
    const childRule = importChildren(getRule(getFullPath(filepath)), filepath, options, doc)
    labeledSuccess('read rule', filepath)
    fileMap.set(filepath, childRule.trim())
  }
  return rule
    .split(/\n/)
    .reduce((acc, line) => {
      if (!importLineRegExp.test(line)) {
        acc.push(line)
        return acc
      }
      const filename = line.replace(importLineRegExp, '$1')
      const filepath = join(directoryPath, filename)
      if (!fileMap.has(filepath)) {
        acc.push(`${line} (400: 【${filename}】from (${path}) not found)`)
        return acc
      }
      const indent = line.replace(indentRegExp, '$1')
      if (isDoc(options, doc)) {
        acc.push(`${indent}/**`)
        acc.push(`${indent} * @file ${filename}`)
        acc.push(`${indent} * @from ${path}`)
        acc.push(`${indent} */`)
      }
      for (const childLine of fileMap.get(filepath).split(/\n/)) {
        acc.push(`${indent}${childLine}`)
      }
      if (isDoc(options, doc)) {
        acc.push(`${indent}//${SEPARATOR} bottom of 【${filename}】 ${SEPARATOR}`)
      }
      return acc
    }, [] as string[])
    .join('\n')
}

const bundle = (options: BundleOptions, setting: Setting) => {
  const { doc, directoryPath, main, output } = setting
  const filepath = join(directoryPath, main)
  const rule = getRule(getFullPath(filepath))
  const outputPath = join(directoryPath, output)
  labeledBullet('generate rule', outputPath)
  writeFileSync(getFullPath(outputPath), importChildren(rule, filepath, options, doc))
  labeledSuccess('generate rule', outputPath)
  return
}

export const action = async ({ options, settings }: ActionArg<BundleOptions>) => {
  const types: Type[] = []
  switch (options.only) {
    case ALIASES.f:
    case ALIASES.firestore:
      types.push(TYPES.firestore)
      break
    case ALIASES.s:
    case ALIASES.storage:
      types.push(TYPES.storage)
      break
    default:
      types.push(TYPES.firestore)
      types.push(TYPES.storage)
      break
  }
  if (get(ENVS.IS_DEBUG)) {
    table(types)
    return
  }
  for (const type of types) {
    if (type === TYPES.storage) {
      for (const setting of settings[type]) {
        bundle(options, setting)
      }
      continue
    }
    bundle(options, settings[type])
  }
}
