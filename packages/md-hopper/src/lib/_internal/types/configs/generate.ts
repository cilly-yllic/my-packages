import { input, confirm, number, select } from '@inquirer/prompts'
import { InputQuestion, ConfirmQuestion, NumberQuestion, Questions, Answers } from '~types/inquirer.js'
import { isNumber } from 'my-gadgetry/type-check'

import { DEFAULT_MD_FILENAME } from '~utils/configs.js'
import { isDirectory } from '~utils/path.js'

export const TYPES = {
  rc: 'rc',
  link: 'link',
} as const

export type Type = (typeof TYPES)[keyof typeof TYPES]

export interface CommandOptions {
  debug?: boolean
  type?: Type
  include?: string
  exclude?: string
  filenames?: string
  input?: string
  output?: string
  idGen?: GenerateType
  depth?: number
  id?: string
  lock?: boolean
  skipHidden?: boolean
  title?: string
}

export interface MdSettings {
  include: string[]
  exclude: string[]
  filenames: string[]
  skipHidden: boolean
  input: string
  output: string
  idGen: GenerateType
  id: string
  title: string
  lock: boolean
  depth: number
}

const INPUT_QUESTION_PARAMS = {
  message: 'Please put path from current dir with filename? ex: "./{path}/{filename}.md"',
}

const INPUT_QUESTION: InputQuestion = {
  name: 'input',
  question: () => input(INPUT_QUESTION_PARAMS),
}

const SKIP_HIDDEN_QUESTION: ConfirmQuestion = {
  name: 'skipHidden',
  question: () =>
    confirm({
      message: 'skip search hidden file? default Yes.',
      default: true,
    }),
}

const INCLUDE_QUESTION: InputQuestion = {
  name: 'include',
  question: () =>
    input({
      message: 'include pattern minimatch list with comma. ex: xxx,xxx',
      default: '',
    }),
}

const EXCLUDE_QUESTION: InputQuestion = {
  name: 'exclude',
  question: () =>
    input({
      message: 'exclude pattern minimatch list with comma. ex: xxx,xxx',
      default: '',
    }),
}

const FILENAMES_QUESTION: InputQuestion = {
  name: 'filenames',
  question: () =>
    input({
      message: 'search filenames with comma. (default: README.md) ex: README.md,CHANGELOG.md',
      default: DEFAULT_MD_FILENAME,
    }),
}

const OUTPUT_QUESTION: InputQuestion = {
  name: 'output',
  question: () =>
    input({
      message: 'output filename. (default: same name as read, means update file) ex: README_GENERATE.md',
    }),
}

const DEPTH_QUESTION: NumberQuestion = {
  name: 'depth',
  question: () =>
    number({
      message: 'search depth number. more than 0. (if all put 0)',
      validate: input => {
        return isNumber(input, true) && (input as number) >= 0
      },
      default: 0,
    }),
  filter: input => {
    return input >= 0 ? Number(input) : ''
  },
}

const DIR_QUESTIONS = [SKIP_HIDDEN_QUESTION, INCLUDE_QUESTION, EXCLUDE_QUESTION, FILENAMES_QUESTION, DEPTH_QUESTION]

const RC_QUESTIONS = (_options: CommandOptions) => async (): Promise<Answers> => {
  const answers: Answers = {
    [INPUT_QUESTION.name]: await input({
      ...INPUT_QUESTION_PARAMS,
      validate: input => {
        return !!input
      },
    }),
  }
  await setQuestions(
    [SKIP_HIDDEN_QUESTION, INCLUDE_QUESTION, EXCLUDE_QUESTION, FILENAMES_QUESTION, OUTPUT_QUESTION, DEPTH_QUESTION],
    answers
  )
  return answers
}

export const GENERATE_TYPES = Object.freeze({
  path: 'path',
  random: 'random',
  manual: 'manual',
} as const)

export type GenerateType = (typeof GENERATE_TYPES)[keyof typeof GENERATE_TYPES]

const GENERATE_TYPE_CHOICES = Object.freeze([
  { name: 'auto generate with directory path', short: 'dir path', value: GENERATE_TYPES.path },
  { name: 'auto generate with uuid', short: 'random', value: GENERATE_TYPES.random },
  { name: 'generate yourself', short: 'manually', value: GENERATE_TYPES.manual },
] as const)

const setDirQuestions = async (inputPath: string, options: CommandOptions, answers: Answers) => {
  if (isInputPathDirectory(inputPath, options)) {
    await setQuestions(DIR_QUESTIONS, answers)
  }
}

const setFileQuestions = async (inputPath: string, options: CommandOptions, answers: Answers) => {
  if (!isInputPathDirectory(inputPath, options)) {
    await setQuestions(FILE_QUESTIONS, answers)
  }
}

const FILE_QUESTIONS: Questions = [
  {
    name: 'title',
    question: () => input({ message: 'title name. (default: auto detect title)' }),
  },
  {
    name: 'lock',
    question: () => confirm({ message: 'is locked? if true not link this file. (default: false)', default: false }),
  },
]

const isInputPathDirectory = (path: string, options: CommandOptions) => isDirectory(path || options.input || '')

const getIdGenQuestions = (path: string, options: CommandOptions) => {
  if (isInputPathDirectory(path, options)) {
    return GENERATE_TYPE_CHOICES.filter(({ value }) =>
      ([GENERATE_TYPES.path, GENERATE_TYPES.random] as string[]).includes(value)
    )
  }
  return GENERATE_TYPE_CHOICES
}

const setQuestions = async (questions: Questions, answers: Answers) => {
  for (const { name, question } of questions) {
    answers[name] = await question()
  }
}

const LINK_QUESTIONS = (options: CommandOptions) => async (): Promise<Answers> => {
  const inputPath = await input({
    message: 'Please put path from current dir with filename? (default: ".") ex: "./{path}/{filename}.md"',
    default: '.',
  })
  const answers: Answers = {
    [INPUT_QUESTION.name]: inputPath,
  }

  answers['idGen'] = await select({
    message: `Choose generate type (default: ${GENERATE_TYPE_CHOICES[0].short})`,
    default: 0,
    choices: getIdGenQuestions(inputPath, options),
  })
  if (answers.idGen === GENERATE_TYPES.manual) {
    answers['id'] = await input({
      message: 'type id',
      validate: input => {
        return !!input
      },
    })
  }
  await setDirQuestions(inputPath, options, answers)
  await setFileQuestions(inputPath, options, answers)
  return answers
}

export const QUESTIONS = (options: CommandOptions): Record<string, () => Promise<Answers>> => ({
  [TYPES.rc]: RC_QUESTIONS(options),
  [TYPES.link]: LINK_QUESTIONS(options),
})
