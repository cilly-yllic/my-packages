/* eslint-disable @typescript-eslint/no-explicit-any */
import stripAnsi from 'strip-ansi'
import { SPLAT } from 'triple-beam'
import winston from 'winston'

import { get, ENVS } from './process.js'

export function tryStringify(value: any) {
  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value)
  } catch {
    return value
  }
}

const rawLogger = winston.createLogger()
rawLogger.add(new winston.transports.Console({ silent: true }))

// if (IS_DEBUG) {
if (get(ENVS.IS_DEBUG)) {
  rawLogger.add(
    new winston.transports.Console({
      level: 'debug',
      format: winston.format.printf(info => {
        const segments = [info.message, ...((info[SPLAT] as any[]) || [])].map(tryStringify)
        return `${stripAnsi(segments.join(' '))}`
      }),
    })
  )
} else {
  rawLogger.add(
    new winston.transports.Console({
      level: 'info',
      format: winston.format.printf(info =>
        [info.message, ...((info[SPLAT] as any[]) || [])].filter(chunk => typeof chunk === 'string').join(' ')
      ),
    })
  )
}
rawLogger.exitOnError = false

export const LOG_LEVELS = {
  error: 'error',
  warn: 'warn',
  help: 'help',
  data: 'data',
  info: 'info',
  debug: 'debug',
  prompt: 'prompt',
  http: 'http',
  verbose: 'verbose',
  input: 'input',
  silly: 'silly',
} as const

export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS]
export const logger = rawLogger

/* eslint-enable @typescript-eslint/no-explicit-any */
