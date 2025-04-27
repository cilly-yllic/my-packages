#!/usr/bin/env node
// import { EventEmitter } from 'events';
import { program } from 'commander'

import { error } from '~utils/log.js'
import { get, ENVS, init } from '~utils/process.js'

import { init as initCommands } from './commands/index.js'

// EventEmitter.defaultMaxListeners = 50

init()
program.version(`${get(ENVS.PACKAGE_VERSION)}`)
await initCommands(program)
program.action((_, args) => {
  const cmd = args[0]
  error(`${cmd} is not a Link MD command`)
  error('')
  error(`${cmd} has been renamed, please run instead`)
  console.log('exit')
  process.exit(1)
})
program.parse(process.argv)
