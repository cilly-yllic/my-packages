import * as chalk from './chalk.js'

export const success = (...args: any[]) => {
  console.log(chalk.success(...args))
}

export const warn = (...args: any[]) => {
  console.log(chalk.warn(...args))
}

export const info = (...args: any[]) => {
  console.log(chalk.info(...args))
}

export const error = (...args: any[]) => {
  console.log(chalk.error(...args))
}

export const hop = (...args: any[]) => {
  console.log(chalk.hop(...args))
}
