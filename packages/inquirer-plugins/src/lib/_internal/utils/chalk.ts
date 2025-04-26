import chalk from 'chalk'
import { ExtractedAnsiText } from '~types/chalk.js'

// eslint-disable-next-line no-control-regex
export const trim = (txt: string) => txt.replace(/\u001b\[[0-9;]*m/g, '')

export const extractAnsiWrapper = (val: number | string | boolean): ExtractedAnsiText => {
  const txt = `${val}`
  const raw = trim(txt)

  // eslint-disable-next-line no-control-regex
  const match = txt.match(/^(\u001b\[[0-9;]*m)(.*?)(\u001b\[39m)?$/s)
  if (!match) {
    return {
      text: raw,
      attach: (v: string) => v,
    }
  }
  const prefix = match[1]
  const suffix = match[3] || '\u001b[39m'
  return {
    text: raw,
    attach: (v: string) => `${prefix}${v}${suffix}`,
  }
}

export const success = chalk.green
export const warn = chalk.hex('#FFA500')
export const info = chalk.hex('#77CFF5')
export const error = chalk.red
export const hop = chalk.hex('#F577F5')
export const cyan = chalk.cyan
export const bold = chalk.bold
export const dim = chalk.dim
