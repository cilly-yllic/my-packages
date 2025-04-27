import { ActionArg } from '~types/command.js'
import { CommandOptions, MdSettings, TYPES, GENERATE_TYPES, QUESTIONS, Type } from '~types/configs/generate.js'
import { CommandClass, OPTIONS } from '~utils/command.js'
import { DEFAULT_MD_FILENAME } from '~utils/configs.js'
import { getCommands } from '~utils/path.js'

import { action } from './action.js'

export const COMMANDS = getCommands(import.meta.url)

const DEFAULT_SETTINGS: MdSettings = {
  include: [],
  exclude: [],
  filenames: [],
  skipHidden: true,
  input: '.',
  output: DEFAULT_MD_FILENAME,
  idGen: GENERATE_TYPES.path,
  id: '',
  title: '',
  lock: false,
  depth: 0,
}

const mergeSetting = (options: CommandOptions): MdSettings => {
  return {
    include: options.include ? options.include.split(',') : DEFAULT_SETTINGS.include,
    exclude: options.exclude ? options.exclude.split(',') : DEFAULT_SETTINGS.exclude,
    filenames: options.filenames ? options.filenames.split(',') : DEFAULT_SETTINGS.filenames,
    skipHidden: options.skipHidden || DEFAULT_SETTINGS.skipHidden,
    input: options.input || DEFAULT_SETTINGS.input,
    output: options.output || DEFAULT_SETTINGS.output,
    idGen: options.idGen || DEFAULT_SETTINGS.idGen,
    id: options.id || DEFAULT_SETTINGS.id,
    title: options.title || DEFAULT_SETTINGS.title,
    lock: options.lock || DEFAULT_SETTINGS.lock,
    depth: options.depth || DEFAULT_SETTINGS.depth,
  }
}

export const beforeAction = async (args: ActionArg<CommandOptions, MdSettings>) => {
  const { options: opts } = args
  const answers = await QUESTIONS(opts)[opts.type as Type]()
  console.log(answers)
  const options = {
    ...opts,
    ...answers,
  }
  return action({
    options,
    settings: mergeSetting(options),
  })
}

export const init = (commandClass: CommandClass<CommandOptions, MdSettings>) => {
  commandClass
    .description('This command is generate template.')
    .option(
      `${OPTIONS.type} <string>`,
      `template type default: ${TYPES.rc} (${Object.values(TYPES).join(', ')})`,
      (value: string) => {
        const values = Object.values(TYPES)
        if (!(values as string[]).includes(value)) {
          throw new Error(`Invalid type. Allowed values are: ${values.join(', ')}`)
        }
        return value
      },
      TYPES.rc
    )
    .option(`${OPTIONS['skip-hidden']} <boolean>`, 'skip read hidden dir (default: true)')
    .option(`${OPTIONS.include} <strings>`, 'include dirs (default: [] (all files))')
    .option(`${OPTIONS.exclude} <strings>`, 'ignore dirs (default: node_modules only)')
    .option(`${OPTIONS.filenames} <strings>`, 'filenames (default: README.md only)')
    .option(`${OPTIONS.output} <filename>`, 'output filename (default: README.md (replace))')
    .option(`${OPTIONS.input} <filename>`, 'target root filename (default: README.md)')
    .option(`${OPTIONS['id-gen']} <string>`, `Choose generate type (default: ${GENERATE_TYPES.path})`, (value: string) => {
      const values = Object.values(GENERATE_TYPES)
      if (!(values as string[]).includes(value)) {
        throw new Error(`Invalid type. Allowed values are: ${values.join(', ')}`)
      }
      return value
    })
    .option(`${OPTIONS.id} <string>`, 'type id')
    .option(`${OPTIONS.title} <string>`, 'title name')
    .option(`${OPTIONS.lock} <boolean>`, 'is locked? if true not link this file. (default: false)')
    .option(`${OPTIONS.depth} <filename>`, 'depth level more than 0')
    .action(beforeAction)
}

export const getSettings = (_options: CommandOptions) => {
  return {}
}
