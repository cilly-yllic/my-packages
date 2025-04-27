import { ActionArg } from '~types/command.js'
import { CommandOptions, MdSettings, TYPES } from '~types/configs/generate.js'

import { exec as linkExec } from './actions/link.js'
import { exec as rcExec } from './actions/rc.js'

type Arg = ActionArg<CommandOptions, MdSettings>

export const action = async (args: Arg) => {
  const { options, settings } = args
  switch (options.type) {
    case TYPES.rc:
      return rcExec(settings)
    case TYPES.link:
      return linkExec(settings)
  }
}
