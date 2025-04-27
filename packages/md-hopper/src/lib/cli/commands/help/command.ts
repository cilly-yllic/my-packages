import { CommandOptions, MdSettings } from '~types/configs/help.js'
import { CommandClass } from '~utils/command.js'
import { getCommands } from '~utils/path.js'

import { action } from './action.js'

export const COMMANDS = getCommands(import.meta.url)

export const init = (commandClass: CommandClass<CommandOptions, MdSettings>) => {
  commandClass.description('This command is used to show help').action(options => {
    return action(options)
  })
}

export const getSettings = (options: CommandOptions) => {
  return options
}
