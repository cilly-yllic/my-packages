/* eslint-disable @typescript-eslint/no-explicit-any */
import { Command as Program } from 'commander'

import { Action, BeforeFunction, ActionArg } from '~types/command.js'
import { DefaultOptions } from '~types/options.js'
import { Settings } from '~types/settings.js'

import { getSettings } from './settings.js'

export class CommandClass<T extends DefaultOptions> {
  program!: Program
  private befores: BeforeFunction[] = []
  private args!: ActionArg<T>

  constructor(program: Program) {
    this.program = program
  }

  async init(options: ActionArg<T>['options'], settings: Settings) {
    this.args = {
      options,
      settings,
    }
    return this
  }

  command(command: string) {
    this.program = this.program.command(command).option('-d, --debug', 'turn on debugging', false)
    return this
  }

  help(helpTxt: string): CommandClass<T> {
    this.program = this.program.on('--help', () => {
      console.log()
      console.log(helpTxt)
    })
    return this
  }

  before(before: Action, ...args: any[]): CommandClass<T> {
    this.befores.push({ fn: before, args: args })
    return this
  }

  description(description: string): CommandClass<T> {
    this.program = this.program.description(description)
    return this
  }

  option(...args: any[]): CommandClass<T> {
    const flags = args.shift()
    this.program = this.program.option(flags, ...args)
    return this
  }

  requiredOption(...args: any[]): CommandClass<T> {
    const flags = args.shift()
    this.program = this.program.requiredOption(flags, ...args)
    return this
  }

  action(action: Action) {
    this.program = this.program.action(async (...args: any[]) => {
      const options = args[0]
      await this.init(options, await getSettings())
      for (const before of this.befores) {
        await before.fn(options, ...before.args)
      }
      return action(this.args, ...args)
    })
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */
