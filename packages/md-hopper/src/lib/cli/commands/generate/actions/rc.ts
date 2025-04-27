import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'

import { isArray } from 'my-gadgetry/type-check'

import { MdSettings } from '~types/configs/generate.js'
import { MdSettings as LinkMdSettings } from '~types/configs/links.js'
import { isDirectory as isDirectoryFile } from '~utils/fs.js'
import { removeParam, getParamsComment, getKeyValues } from '~utils/md.js'
import { getExecDir } from '~utils/path.js'

type KeyOfSetting = keyof Pick<MdSettings, 'skipHidden' | 'include' | 'exclude' | 'filenames' | 'output' | 'depth'>
const PARAMS: Record<KeyOfSetting, keyof LinkMdSettings> = {
  skipHidden: 'skip-hidden',
  include: 'include',
  exclude: 'exclude',
  filenames: 'filenames',
  output: 'output',
  depth: 'depth',
} as const

export const exec = (settings: MdSettings) => {
  const fullPath = join(getExecDir(), settings.input)
  let md = ''
  if (existsSync(fullPath)) {
    if (isDirectoryFile(fullPath)) {
      throw new Error(`this is dir. ${fullPath}`)
    }
    md = readFileSync(fullPath, 'utf-8')
  }
  md = removeParam(md, 'CONFIG')
  const keyValues = Object.entries(PARAMS).reduce((acc: Partial<Record<keyof LinkMdSettings, string>>, keyValue) => {
    const [optKey, mdKey] = keyValue as [KeyOfSetting, keyof LinkMdSettings]
    const value = settings[optKey] as LinkMdSettings[typeof mdKey]
    const isArr = isArray(value)
    if (!value || (isArr && !(value as string[]).length)) {
      return acc
    }
    acc[mdKey] = isArr ? (value as string[]).join(',') : `${value}`
    return acc
  }, {})
  const params = getKeyValues(keyValues)
  const content = `${getParamsComment({ CONFIG: params })}
${md}`
  writeFileSync(fullPath, content, 'utf-8')
}
