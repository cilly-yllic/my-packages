import { ExtractedRows, Cell } from '~types/table.js'

export const getCellValue = (columnIndex: number, rowIndex: number, rows: ExtractedRows): Cell => {
  if (rowIndex in rows && columnIndex in rows[rowIndex]) {
    return rows[rowIndex][columnIndex].text || ''
  }
  return ''
}
