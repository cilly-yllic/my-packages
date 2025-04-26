import { ParseType } from '~types/parse-types.js'
import { Message } from '~types/chalk.js'
import { ValidateResult } from './common.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DisabledColumn {
  name: Message
  value: string
  disabled: true
}

interface EditableColumn<
  P extends (...args: any[]) => any = (...args: any[]) => any,
  V extends (...args: any[]) => ValidateResult = (...args: any[]) => ValidateResult
> {
  name: Message
  value: string
  type: ParseType
  validate?: V
  parser?: P
}

export type Column = DisabledColumn | EditableColumn

/* eslint-enable @typescript-eslint/no-explicit-any */
