import { CommandOptions, MdSettings } from '~types/configs/links.js'
import { CommandClass, OPTIONS } from '~utils/command.js'
import { getSettings as _getSettings } from '~utils/link.js'
import { getCommands } from '~utils/path.js'

import { action } from './action.js'

export const COMMANDS = getCommands(import.meta.url)

export const init = (commandClass: CommandClass<CommandOptions, MdSettings>) => {
  commandClass
    .description('This command is used to exec target file.')
    .option(`${OPTIONS['skip-hidden']} <boolean>`, 'skip read hidden dir (default: true)')
    .option(`${OPTIONS.include} <strings>`, 'include dirs (default: [] (all files))')
    .option(`${OPTIONS.exclude} <strings>`, 'ignore dirs (default: node_modules only)')
    .option(`${OPTIONS.filenames} <strings>`, 'filenames (default: README.md only)')
    .option(`${OPTIONS.output} <filename>`, 'output filename (default: README.md (replace))')
    .option(`${OPTIONS.input} <filename>`, 'target root filename (default: README.md)')
    .option(`${OPTIONS.depth} <filename>`, 'depth level more than 0')
    .action(options => {
      return action(options)
    })
}

export const getSettings = (options: CommandOptions): MdSettings => {
  return _getSettings(options.input || '')
}
