import { platform } from 'node:process'

import { cyan } from 'colorette'

import { ActionArg } from '~types/command.js'
import { HelpOptions } from '~types/options.js'
import { logger } from '~utils/logger.js'
import { get, ENVS } from '~utils/process.js'

const ASCII_ART = `
 _____   _____         _____   _   _   __   _   _____   _       _____   _____
|  ___| |  _  \\       |  _  \\ | | | | |  \\ | | |  _  \\ | |     | ____| |  _  \\
| |__   | |_| |       | |_| | | | | | |   \\| | | | | | | |     | |__   | |_| |
|  __|  |  _  /       |  _  { | | | | | |\\   | | | | | | |     |  __|  |  _  /
| |     | | \\ \\       | |_| | | |_| | | | \\  | | |_| | | |___  | |___  | | \\ \\
|_|     |_|  \\_\\      |_____/ \\_____/ |_|  \\_| |_____/ |_____| |_____| |_|  \\_\\

    `

const VERSIONS = `
  Firebase Rules Bundler: ${get(ENVS.PACKAGE_VERSION)}
  Node: ${process.versions.node}
  OS: ${platform} ${process.arch}
  `

const show = () => {
  logger.info(
    ASCII_ART.split('\n')
      .map(x => cyan(x))
      .join('\n')
  )
  logger.info(VERSIONS)
}

export const action = async (_: ActionArg<HelpOptions>) => {
  show()
  // TODO
  return
}
