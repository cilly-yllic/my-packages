import { Paginator, PointerIndexes, PageSize } from '~types/table.js'

export const getPageCount = (maxRowIndex: number, pageSize: PageSize) => {
  if (!pageSize) {
    return 1
  }
  return Math.ceil((maxRowIndex + 1) / pageSize)
}

export const paginate = (pointerIndexes: PointerIndexes, pageSize: PageSize, maxRowIndex: number): Paginator => {
  if (!pageSize) {
    return {
      indexFrom: 0,
      indexTo: maxRowIndex,
    }
  }
  const middleOfPage = Math.floor(pageSize / 2)
  let indexFrom = Math.max(0, pointerIndexes.row - middleOfPage)
  const maxPageSizeIndex = pageSize - 1
  const indexTo = Math.min(maxRowIndex, indexFrom + maxPageSizeIndex)
  indexFrom = Math.min(indexFrom, indexTo - (pageSize - 1))
  return { indexFrom, indexTo }
}
