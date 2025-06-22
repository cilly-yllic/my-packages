import { Command as Program } from 'commander'

import { BundleOptions } from '~types/options.js'
import { CommandClass } from '~utils/command.js'

import { action } from './action.js'

const setAliases = (commandClass: CommandClass<BundleOptions>) => {
  commandClass
    .description('This command is used to exec target file.')
    .option('--doc <document>', 'true: generate with doc')
    .option('--only <target>', 'firestore, f, storage, s')
    .action(options => {
      return action(options)
    })
}

const commands = ['bundle', 'b']

export const init = (program: Program) => {
  for (const command of commands) {
    setAliases(new CommandClass<BundleOptions>(program).command(command))
  }
}
