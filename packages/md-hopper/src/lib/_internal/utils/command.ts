import { Command as Program } from 'commander'

import { Action, BeforeFunction, ActionArg } from '~types/command.js'

type SettingsFnc<CommandOptions extends Record<string, any>, MdSettings extends Record<string, any>> = (
  options: CommandOptions
) => MdSettings

const invert = (obj: Record<string, string>) => {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [value, key])
  );
}

export const OPTION_SHORTS = Object.freeze({
  a: '',
  b: '',
  c: '',
  d: '',
  e: '',
  f: 'filenames',
  g: '',
  h: '',
  i: 'input',
  j: '',
  k: '',
  l: '',
  m: '',
  n: '',
  o: 'output',
  p: '',
  q: '',
  r: '',
  s: 'skip-hidden',
  t: 'type',
  u: '',
  v: '',
  w: '',
  x: '',
  y: '',
  z: '',
  
  A: '',
  B: '',
  C: '',
  D: 'depth', E: 'exclude', F: '', G: 'id-gen',
  H: '', I: 'include', J: '', K: '',
  L: 'lock', M: '', N: '', O: '', P: '', Q: '', R: '', S: '', T: 'title', U: '', V: '', W: '',  X: '', Y: '', Z: '',
} as const)

const INVERTED_OPTION_SHORTS = invert(OPTION_SHORTS)

const OPTION_KEYS = Object.freeze([
  'filenames', 'input', 'output', 'skip-hidden', 'type', 'depth', 'exclude', 'id-gen', 'include', 'lock', 'title', 'id'
] as const)
export const OPTIONS = OPTION_KEYS.reduce((acc: Record<string, string>, key) => {
  const short = INVERTED_OPTION_SHORTS[key]
  if (!short) {
    acc[key] = `--${key}`
  } else {
    acc[key] = `-${short}, --${key}`
  }
  return acc
}, {})

export class CommandClass<CommandOptions extends Record<string, any>, MdSettings extends Record<string, any>> {
  program!: Program
  private befores: BeforeFunction[] = []
  private args!: ActionArg<CommandOptions, MdSettings>
  private getSettingFnc: SettingsFnc<CommandOptions, MdSettings>

  constructor(program: Program, getSettingFnc: SettingsFnc<CommandOptions, MdSettings>) {
    this.program = program
    this.getSettingFnc = getSettingFnc
  }

  // async init(options: ActionArg<T>['options'], settings: Settings) {
  init(options: CommandOptions, settings: MdSettings) {
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

  help(helpTxt: string) {
    this.program = this.program.on('--help', () => {
      console.log()
      console.log(helpTxt)
    })
    return this
  }

  before(before: Action, ...args: any[]) {
    this.befores.push({ fn: before, args: args })
    return this
  }

  description(description: string) {
    this.program = this.program.description(description)
    return this
  }

  option(...args: any[]) {
    const flags = args.shift()
    this.program = this.program.option(flags, ...args)
    return this
  }

  requiredOption(...args: any[]) {
    const flags = args.shift()
    this.program = this.program.requiredOption(flags, ...args)
    return this
  }

  action(action: Action) {
    this.program = this.program.action(async (...args: any[]) => {
      const options = args[0] as CommandOptions
      await this.init(options, this.getSettingFnc(options))
      for (const before of this.befores) {
        await before.fn(options, ...before.args)
      }
      return action(this.args, ...args)
    })
  }
}

export const setCommands = <CommandOptions extends Record<string, any>, MdSettings extends Record<string, any>>(
  program: Program,
  commands: string[],
  initFnc: (commandClass: CommandClass<CommandOptions, MdSettings>) => void,
  getSettingFnc: SettingsFnc<CommandOptions, MdSettings>
) => {
  for (const command of commands) {
    initFnc(new CommandClass<CommandOptions, MdSettings>(program, getSettingFnc).command(command))
  }
}
