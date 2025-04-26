import { Colors, DEFAULT_PAGE_SIZE, ValidateResult } from './types/common.js';
import { Column } from './types/columns.js'
import { Messages, TableConfig } from './types/table.js'
import { ExtractedRows, PageSize } from '~types/table.js'
import { cyan, hop, success, warn } from '~utils/chalk.js';

export * from './types/columns.js'
export * from './types/common.js'
export * from './types/rows.js'
export * from './types/table.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

export type TableValidator = (raws: ExtractedRows, config: TableConfig<TableValidator>, memo: Memo) => ValidateResult
export type Validator = (input: any, raws: ExtractedRows, memo: Memo) => ValidateResult
export type Parser = (input: any, raws: ExtractedRows, memo: Memo) => any

export interface Memo {
  maxRowIndex: number
  maxColumnIndex: number
  disableColumnIndexes: number[]
  columns: Column[]
  pageSize: PageSize
  colors: Colors
  pageCount: number
  messages: Messages
  validate: TableValidator
}

export interface DefaultOptions extends Required<Omit<TableConfig<TableValidator>, 'type' | 'name' | 'colors'>> {
  colors: Colors
}

export const DEFAULT_OPTIONS: DefaultOptions = {
  title: '',
  description: '',
  messages: {
    escape: warn.bgWhite.bold('Press ESC again to cancel!'),
    confirm: cyan('Press ENTER again to confirm!'),
  },
  colors: {
    selected: warn,
    editable: success,
    editing: hop,
  },
  columns: [],
  rows: [],
  pageSize: DEFAULT_PAGE_SIZE,
  validate: () => ({ isValid: true, message: '' }),
}

/* eslint-enable @typescript-eslint/no-explicit-any */
