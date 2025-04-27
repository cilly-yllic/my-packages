import { platform } from 'node:process'

import { ActionArg } from '~types/command.js'
import { CommandOptions, MdSettings } from '~types/configs/help.js'
import { info, hop } from '~utils/log.js'
import { get, ENVS } from '~utils/process.js'

const ASCII_ART = `
 
     ___  ___   _____        _   _   _____   _____   _____   _____   _____
    /   |/   | |  _  \\      | | | | /  _  \\ |  _  \\ |  _  \\ | ____| |  _  \\
   / /|   /| | | | | |      | |_| | | | | | | |_| | | |_| | | |__   | |_| |
  / / |__/ | | | | | |      |  _  | | | | | |  ___/ |  ___/ |  __|  |  _  /
 / /       | | | |_| |      | | | | | |_| | | |     | |     | |___  | | \\ \\
/_/        |_| |_____/      |_| |_| \\_____/ |_|     |_|     |_____| |_|  \\_\\

`

const VERSIONS = `
  MD Hopper: ${get(ENVS.PACKAGE_VERSION)}
  Node: ${process.versions.node}
  OS: ${platform} ${process.arch}
  `

const show = () => {
  hop(ASCII_ART)
  info(VERSIONS)
}

export const action = async (_: ActionArg<CommandOptions, MdSettings>) => {
  show()
  // TODO
  return
}
