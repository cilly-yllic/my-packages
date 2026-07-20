import { Command } from 'commander'

import { registerGenerate } from './generate.js'
import { registerInit } from './init.js'
import { registerInspect } from './inspect.js'
import { registerValidate } from './validate.js'
import { registerWhere } from './where.js'

/** Register every CLI command on the program. */
export const registerCommands = (program: Command): void => {
  registerInit(program)
  registerValidate(program)
  registerGenerate(program)
  registerInspect(program)
  registerWhere(program)
}
