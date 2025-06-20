type TableCellValue = any
type SingleTable = TableCellValue[]
type SimpleTable = TableCellValue[][]

export type ColumnNameTable = {
  [key: string]: TableCellValue
}[]

export type IndexNameTable = {
  [index: string]: TableCellValue[]
}
export type IndexNameAndColumnNameTable = {
  [index: string]: {
    [key: string]: TableCellValue
  }
}
export type Table = SingleTable | SimpleTable | ColumnNameTable | IndexNameTable | IndexNameAndColumnNameTable
