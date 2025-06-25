import { createPrompt, useState, useKeypress, useMemo, ValidationError, Status } from '@inquirer/core'
import cliCursor from 'cli-cursor'
import {
  PartialTableConfig,
  TableConfig as _TableConfig,
  DEFAULT_OPTIONS,
  END_STATUSES,
  Memo,
  Typing,
  NextClose,
  TableValidator,
  Answers,
  Done,
} from './table/types.js'
import { Paginator, PointerIndexes, ExtractedRows } from '~types/table.js'
import {
  hasEditableColumn,
  updateRows,
  getTable,
  getParseType,
  getAnswer,
  onEnd,
  onEscape,
  getMessages,
  clearTyping,
  clear,
  onPointer,
  validTable,
  isEditable,
} from './table/utils.js'
import { STATUSES, DoneIf } from '~types/inquirer.js'
import {
  getBackspaceText,
  getKeypressValue,
  isUpKey,
  isDownKey,
  isRightKey,
  isLeftKey,
  isEscapeKey,
  isSpaceKey,
} from '~utils/keypress.js'
import { getCellValue } from '~utils/table/cell.js'
import { getExtractedAnsiRows } from '~utils/table/rows.js'
import { isTrue } from '~utils/common.js'
import { getPageCount } from '~utils/table/pagenate.js'
import { PARSE_TYPES } from '~types/parse-types.js'
import { error } from '~utils/chalk.js'
import { Message } from '~types/chalk.js'

type TableConfig = _TableConfig<TableValidator>

const mergeConfig = (config: PartialTableConfig): TableConfig => {
  return {
    ...DEFAULT_OPTIONS,
    ...config,
    messages: {
      ...DEFAULT_OPTIONS.messages,
      ...config.messages,
    },
    colors: {
      ...DEFAULT_OPTIONS.colors,
      ...config.colors,
    },
  }
}

export const TablePlugin: ReturnType<typeof createPrompt<DoneIf<Answers>, PartialTableConfig>> = createPrompt(
  (_config: PartialTableConfig, done: Done) => {
    const config = mergeConfig(_config)

    const [nextClose, setNextClose] = useState<NextClose>({
      escape: false,
    })
    const [status, setStatus] = useState<Status>(STATUSES.idle)
    const [rows, setRows] = useState<ExtractedRows>(getExtractedAnsiRows(config.rows))

    const [typing, setTyping] = useState<Typing>({
      current: '',
      backup: '',
    })
    const [messages, setMessages] = useState<Message[]>([])
    const [isEditing, setEditing] = useState<boolean>(false)
    const [paginator, setPaginator] = useState<Paginator>({
      indexFrom: 0,
      indexTo: config.pageSize && config.pageSize > 0 ? config.pageSize - 1 : null,
    })
    const [pointerIndexes, setPointer] = useState<PointerIndexes>({
      row: 0,
      column: 0,
    })

    const memo = useMemo<Memo>(() => {
      if (!hasEditableColumn(config.columns)) {
        throw new ValidationError('[table-plugin prompt] No editable column. All columns are not editable column.')
      }

      const disableColumnIndexes = config.columns.reduce((acc: number[], column, i) => {
        if ('disabled' in column) {
          acc.push(i)
        }
        return acc
      }, [])
      const maxRowIndex = config.rows.length - 1
      const pageSize = config.pageSize || null
      return {
        maxRowIndex,
        maxColumnIndex: config.columns.length - 1,
        disableColumnIndexes,
        columns: config.columns,
        pageSize,
        pageCount: getPageCount(maxRowIndex, pageSize),
        colors: config.colors,
        messages: config.messages,
        validate: config.validate,
      }
    }, [config.rows, config.columns])

    const [backupAnswers] = useState<Answers>(getAnswer(memo.columns, rows, memo))

    useKeypress(async key => {
      if (status !== STATUSES.idle) {
        return
      }
      setStatus(STATUSES.loading)
      setMessages([])
      switch (key.name) {
        case 'enter':
        case 'return': {
          if (isEditing) {
            setEditing(false)
            break
          }
          const valid = validTable(rows, getAnswer(memo.columns, rows, memo), config, memo)
          if (!valid.isValid) {
            setMessages([valid.message])
            break
          }
          onEnd(memo.columns, rows, memo, END_STATUSES.confirmed, setStatus, done)
          break
        }
        case 'escape':
          if (isEditing) {
            updateRows(rows, typing.backup, pointerIndexes, memo, setRows, setMessages)
          } else if (nextClose.escape) {
            onEscape(backupAnswers, setStatus, done)
          } else {
            setTyping({
              current: '',
              backup: '',
            })
            setNextClose({ escape: true })
          }
          setEditing(false)
          break
        case 'delete':
          setTyping({
            current: '',
            backup: '',
          })
          break
        case 'backspace':
          setTyping({
            ...typing,
            current: getBackspaceText(`${typing.current}`),
          })
          break
        case 'down':
        case 'up':
        case 'left':
        case 'right':
          onPointer(key, pointerIndexes, setPointer, setPaginator, memo)
          break
        default: {
          if (!isEditable(pointerIndexes.column, memo)) {
            setMessages([error('this column is not editable.')])
            break
          }
          if (!isEditing) {
            typing.current = ''
            typing.backup = getCellValue(pointerIndexes.column, pointerIndexes.row, rows)
            setEditing(true)
          }
          let current: string | boolean = `${typing.current}${getKeypressValue(key)}`
          if (isSpaceKey(key) && getParseType(memo.columns, pointerIndexes.column) === PARSE_TYPES.confirm) {
            current = !isTrue(getCellValue(pointerIndexes.column, pointerIndexes.row, rows))
            clearTyping(setTyping)
          } else {
            setTyping({
              ...typing,
              current,
            })
          }
          updateRows(rows, current, pointerIndexes, memo, setRows, setMessages)
          break
        }
      }
      if (isUpKey(key) || isDownKey(key) || isRightKey(key) || isLeftKey(key)) {
        clear(setTyping, setEditing, setNextClose)
      } else if (!isEscapeKey(key)) {
        setNextClose({ escape: false })
      }
      if (status === STATUSES.done) {
        cliCursor.show()
      } else {
        cliCursor.hide()
      }
      if (status !== STATUSES.done) {
        setStatus(STATUSES.idle)
      }
    })

    const table = getTable(rows, pointerIndexes, isEditing, paginator, memo)
    const contents = [config.title, config.description, table.toString()]

    messages.push(...getMessages(isEditing, nextClose, memo.messages))
    contents.push(...messages)

    return contents.filter(Boolean).join('\n')
  }
)
