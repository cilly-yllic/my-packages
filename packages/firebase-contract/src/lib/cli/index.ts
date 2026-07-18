#!/usr/bin/env node
import { program } from 'commander'

import { registerCommands } from './commands/index.js'
import { getVersion } from './version.js'

program
  .name('firebase-contract')
  .description('Generate types, validation, and Firebase artifacts from a YAML contract')
  .version(getVersion())

registerCommands(program)

program.parseAsync(process.argv).catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : String(cause))
  process.exit(1)
})
