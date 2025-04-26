import { Status } from '@inquirer/core'
import { Key } from 'readline'
import {
  Column,
  Memo,
  Parser,
  TableConfig,
  Typing,
  Validator,
  Colors,
  EndStatus,
  END_STATUSES,
  NextClose,
  TableValidator,
  Answers,
  Done,
} from './types.js'
import { Paginator, PointerIndexes, ExtractedRow, ExtractedRows, Cell } from '~types/table.js'
import { KeyMapRows } from './types/rows.js'
import { dim, error } from '~utils/chalk.js'
import { SetUseState, STATUSES } from '~types/inquirer.js'
import { PARSE_TYPES, ParseType } from '~types/parse-types.js'
import Table, { Cell as TableCell } from 'cli-table3'
import cliCursor from 'cli-cursor'
import { isStringNumbers } from 'my-gadgetry/type-check'
import { onArrowKeyPress } from '~utils/table/arrow-key.js'
import { isTrue, getCheckbox } from '~utils/common.js'
import { Message } from '~types/chalk.js'

export const hasEditableColumn = (columns: Column[]): boolean => {
  return columns.filter(column => !('disabled' in column) || !column.disabled).length > 0
}

export const getColor = (
  _value: string,
  isSelected: boolean,
  isEditable: boolean,
  isEditing: boolean,
  colors: Colors
) => {
  const value = isEditable ? _value : dim(_value)
  if (!isSelected) {
    return value
  }
  if (isEditing) {
    return isEditable ? colors.editing(value) : colors.selected(value)
  }
  return isEditable ? colors.editable(value) : colors.selected(value)
}

export const isSelected = (rowIndex: number, columnIndex: number, { row, column }: PointerIndexes) => {
  return row === rowIndex && column === columnIndex
}

export const isEditable = (index: number, { disableColumnIndexes }: Memo) => {
  return !disableColumnIndexes.includes(index)
}

export const getHeaders = (columns: TableConfig['columns']) => {
  return columns.map(({ name }) => `${name}`)
}

const getParser = (columnIndex: number, columns: Column[]): Parser => {
  if ('parser' in columns[columnIndex] && columns[columnIndex].parser) {
    return columns[columnIndex].parser
  }
  return (txt: Cell, _rows: ExtractedRows, _memo: Memo) => txt
}

const getValidator = (columnIndex: number, { columns }: Memo): Validator => {
  if ('validate' in columns[columnIndex] && columns[columnIndex].validate) {
    return columns[columnIndex].validate
  }
  return (_txt: Cell, _rows: ExtractedRows, _memo: Memo) => ({
    isValid: true,
    message: '',
  })
}

const getKeyMapRows = (columns: Column[], rows: ExtractedRows, memo: Memo): KeyMapRows => {
  const result: KeyMapRows = []
  for (let i = 0; i < rows.length; i++) {
    result.push({})
    for (let ii = 0; ii < (rows[i] || []).length; ii++) {
      const { value: key } = columns[ii]
      result[i][key] = getParser(ii, columns)(getRowValue(rows[i][ii], ii, columns), rows, memo)
    }
  }
  return result
}

export const updateRows = (
  rows: ExtractedRows,
  typing: Typing['current'],
  pointerIndexes: PointerIndexes,
  memo: Memo,
  setRows: SetUseState<ExtractedRows>,
  setMessages: SetUseState<Message[]>
): void => {
  const messages: Message[] = []
  if (!(pointerIndexes.row in rows)) {
    messages.push(error(`row index (${pointerIndexes.row}) not found`))
  }
  const rowColumns = rows[pointerIndexes.row]
  if (!(pointerIndexes.column in rowColumns)) {
    messages.push(error(`column index (${pointerIndexes.column}) not found`))
  }
  const validateResult = getValidator(pointerIndexes.column, memo)(typing, rows, memo)
  if (!validateResult.isValid) {
    messages.push(validateResult.message)
  }
  if (messages.length) {
    setMessages(messages)
    return
  }
  rowColumns[pointerIndexes.column] = {
    ...rowColumns[pointerIndexes.column],
    text: `${typing}`,
  }
  setRows(rows)
}

export const getAnswer = (columns: Column[], rows: ExtractedRows, memo: Memo): Answers => {
  return {
    table: getKeyMapRows(columns, rows, memo),
  }
}

export const onEnd = (
  columns: Column[],
  rows: ExtractedRows,
  memo: Memo,
  status: EndStatus,
  setStatus: SetUseState<Status>,
  done: Done
) => {
  setStatus(STATUSES.done)
  done({
    status,
    data: getAnswer(columns, rows, memo),
  })
  cliCursor.show()
}

export const onEscape = (answers: Answers, setStatus: SetUseState<Status>, done: Done) => {
  setStatus(STATUSES.done)
  done({
    status: END_STATUSES.escaped,
    data: answers,
  })
  cliCursor.show()
}

const getTableCellValue = (text: ExtractedRow['text'], type?: ParseType) => {
  return type === PARSE_TYPES.confirm ? getCheckbox(text) : text
}

const getRowValue = (value: ExtractedRow, columnIndex: number, columns: Column[]) => {
  const type = 'type' in columns[columnIndex] ? columns[columnIndex].type : PARSE_TYPES.input
  switch (type) {
    case PARSE_TYPES.confirm:
      return isTrue(value.text)
    case PARSE_TYPES.number:
      return isStringNumbers(value.text) ? Number(value.text) : value.text
    default:
      return value.text
  }
}

const getTableRowValue = (
  value: ExtractedRow,
  columnIndex: number,
  isEditing: boolean,
  columns: Column[],
  rows: ExtractedRows,
  memo: Memo
) => {
  const type = 'type' in columns[columnIndex] ? columns[columnIndex].type : PARSE_TYPES.input
  if (isEditing) {
    return getTableCellValue(value.text, type)
  }
  return getParser(columnIndex, columns)(getTableCellValue(value.text, type), rows, memo)
}

export const getTable = (
  rows: ExtractedRows,
  pointerIndexes: PointerIndexes,
  isEditing: boolean,
  { indexFrom, indexTo }: Paginator,
  memo: Memo
) => {
  const table = new Table({
    head: getHeaders(memo.columns),
  })
  for (let i = 0; i < rows.length; i++) {
    if (i < indexFrom || (indexTo && i > indexTo)) {
      continue
    }
    const columnValues: TableCell[] = []
    for (let ii = 0; ii < (rows[i] || []).length; ii++) {
      const row = rows[i][ii]
      const _isEditable = isEditable(ii, memo)
      const _isSelected = isSelected(i, ii, pointerIndexes)
      const value = getTableRowValue(row, ii, _isSelected && isEditing, memo.columns, rows, memo)
      const coloredValue = getColor(value, _isSelected, _isEditable, isEditing, memo.colors)
      columnValues.push({
        content: coloredValue,
        hAlign: 'center',
        vAlign: 'center',
      })
    }
    table.push(columnValues)
  }
  return table
}

export const getParseType = (columns: Column[], columnIndex: number): ParseType => {
  if (!(columnIndex in columns) || !('type' in columns[columnIndex])) {
    return PARSE_TYPES.input
  }
  return columns[columnIndex].type || PARSE_TYPES.input
}

export const getMessages = (isEditing: boolean, { escape }: NextClose, messages: TableConfig['messages']) => {
  if (escape) {
    return [messages.escape]
  }
  if (!isEditing) {
    return [messages.confirm]
  }
  return []
}

export const clearTyping = (setState: SetUseState<Typing>) => {
  setState({
    current: '',
    backup: '',
  })
}

export const clear = (
  setTyping: SetUseState<Typing>,
  setEditing: SetUseState<boolean>,
  setNextClose: SetUseState<NextClose>
) => {
  clearTyping(setTyping)
  setEditing(false)
  setNextClose({ escape: false })
}

export const onPointer = (
  key: Key,
  pointerIndexes: PointerIndexes,
  setPointer: SetUseState<PointerIndexes>,
  setPaginator: SetUseState<Paginator>,
  memo: Memo
) => {
  onArrowKeyPress(
    key,
    pointerIndexes,
    setPointer,
    setPaginator,
    memo.pageSize,
    memo.maxColumnIndex,
    memo.maxRowIndex,
    memo.disableColumnIndexes
  )
}

export const validTable = (rows: ExtractedRows, answers: Answers, config: TableConfig<TableValidator>, memo: Memo) => {
  return memo.validate(rows, answers, config, memo)
}
