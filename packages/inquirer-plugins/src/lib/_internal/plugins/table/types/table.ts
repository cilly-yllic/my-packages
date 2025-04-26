import { PageSize, Rows } from '~types/table.js'
import { ChalkInstance } from 'chalk'
import { Message } from '~types/chalk.js'
import { ValidateResult, Colors } from './common.js'
import { Column } from './columns.js'

export interface Messages {
  escape: Message
  confirm: Message
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Validator = (...args: any[]) => ValidateResult

export interface TableConfig<V extends Validator = Validator> {
  title: string | ChalkInstance
  description: string | ChalkInstance
  messages: Messages
  colors: Colors
  columns: Column[]
  rows: Rows
  validate: V
  pageSize: PageSize
}

export interface PartialTableConfig extends Partial<Omit<TableConfig, 'colors'>> {
  columns: Column[]
  rows: Rows
  colors?: Partial<Colors>
}
