import { readFileSync } from 'fs'

// import { Settings } from '~types/settings.js'
import { MdSettings } from '~types/configs/links.js'
import { getParam } from '~utils/md.js'

import { SETTING_FILENAME, DEFAULT_MD_FILENAME } from './configs.js'
import { getExecDir } from './path.js'

const BOOLEANS = ['skip-hidden']
const STRINGS = ['exclude', 'include', 'filenames']
const NUMBERS = ['depth']

export const DEFAULT_SETTINGS: MdSettings = Object.freeze({
  'skip-hidden': true,
  exclude: [],
  include: [],
  filenames: [DEFAULT_MD_FILENAME],
  output: DEFAULT_MD_FILENAME,
  input: '.',
  depth: 0,
})

export const parse = (txt: string): MdSettings => {
  const lines = txt.split('\n')
  const settings: MdSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
  for (const line of lines) {
    const keyValue = line.split(':')
    if (keyValue.length !== 2) {
      continue
    }
    const key = keyValue[0].trim() as keyof MdSettings
    const value: MdSettings[typeof key] | string = keyValue[1].trim()
    let val: MdSettings[typeof key]
    if (BOOLEANS.includes(key)) {
      val = JSON.parse(`${value}`) as MdSettings[typeof key]
    } else if (STRINGS.includes(key)) {
      val = value.split(',')
    } else if (NUMBERS.includes(key)) {
      val = Number(value)
    } else {
      continue
    }
    // @ts-ignore: TS7053: Element implicitly has an any type because expression of type any can't be used to index type Setting
    settings[key] = val as MdSettings[typeof key]
  }
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
  }
}

export const getSettings = (inputFilename: string): MdSettings => {
  const readme = readFileSync(`${getExecDir()}/${inputFilename || SETTING_FILENAME}`, 'utf-8')
  return parse(getParam(readme, 'CONFIG'))
}
