import process from 'process'

import { bold, cyan, green, red, yellow } from 'colorette'

import { Table } from '~types/log.js'

import { logger, LogLevel } from './logger.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LogDataOrUndefined = Record<string, any> | undefined

const IS_WINDOWS = process.platform === 'win32'
const SUCCESS_CHAR = IS_WINDOWS ? '+' : '✔'
const WARNING_CHAR = IS_WINDOWS ? '!' : '⚠'
const ERROR_CHAR = IS_WINDOWS ? '!!' : '⬢'

export const success = (message: string, type: LogLevel = 'info', data: LogDataOrUndefined = undefined): void => {
  logger[type](green(bold(`${SUCCESS_CHAR} `)), message, data)
}

export const error = (message: string, type: LogLevel = 'info', data: LogDataOrUndefined = undefined): void => {
  logger[type](red(bold(`${ERROR_CHAR} `)), message, data)
}
export const labeledSuccess = (
  label: string,
  message: string,
  type: LogLevel = 'info',
  data: LogDataOrUndefined = undefined
): void => {
  logger[type](green(bold(`${SUCCESS_CHAR}  ${label}:`)), message, data)
}

export const bullet = (message: string, type: LogLevel = 'info', data: LogDataOrUndefined = undefined): void => {
  logger[type](cyan(bold('i ')), message, data)
}

export const labeledBullet = (
  label: string,
  message: string,
  type: LogLevel = 'info',
  data: LogDataOrUndefined = undefined
): void => {
  logger[type](cyan(bold(`i  ${label}:`)), message, data)
}

export const warning = (message: string, type: LogLevel = 'warn', data: LogDataOrUndefined = undefined): void => {
  logger[type](yellow(bold(`${WARNING_CHAR} `)), message, data)
}

export const labeledWarning = (
  label: string,
  message: string,
  type: LogLevel = 'warn',
  data: LogDataOrUndefined = undefined
): void => {
  logger[type](yellow(bold(`${WARNING_CHAR}  ${label}:`)), message, data)
}

export const labeledError = (
  label: string,
  message: string,
  type: LogLevel = 'error',
  data: LogDataOrUndefined = undefined
): void => {
  logger[type](red(bold(`${ERROR_CHAR}  ${label}:`)), message, data)
}

export const table = (arg: Table) => console.table(arg)
