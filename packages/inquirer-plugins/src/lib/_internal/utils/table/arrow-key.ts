import { isDownKey, isLeftKey, isRightKey, isUpKey } from '~utils/keypress.js'
import { getColumnIndex, isValidColumnIndex } from '~utils/table/columns.js'
import { paginate } from '~utils/table/pagenate.js'
import { Key } from 'readline'
import { PageSize, Paginator, PointerIndexes } from '~types/table.js'
import { SetUseState } from '~types/inquirer.js'

export const onArrowKeyPress = (
  key: Key,
  pointerIndexes: PointerIndexes,
  setPointer: SetUseState<PointerIndexes>,
  setPaginator: SetUseState<Paginator>,
  pageSize: PageSize,
  maxColumnIndex: number,
  maxRowIndex: number,
  disableColumnIndexes: number[]
) => {
  let column = pointerIndexes.column
  let row = pointerIndexes.row
  if (isUpKey(key) || isDownKey(key)) {
    row = isUpKey(key) ? Math.max(0, pointerIndexes.row - 1) : Math.min(maxRowIndex, pointerIndexes.row + 1)
    if (!isValidColumnIndex(pointerIndexes.column, maxColumnIndex, disableColumnIndexes)) {
      column = getColumnIndex(1, pointerIndexes.column, maxColumnIndex, disableColumnIndexes)
    }
  } else if (isRightKey(key) || isLeftKey(key)) {
    column = getColumnIndex(isRightKey(key) ? 1 : -1, pointerIndexes.column, maxColumnIndex, disableColumnIndexes)
  }
  const pointer = {
    column,
    row,
  }
  setPointer(pointer)
  if (pointerIndexes.row !== row) {
    setPaginator(paginate(pointer, pageSize, maxRowIndex))
  }
}
