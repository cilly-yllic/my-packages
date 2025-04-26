import { ExtractedAnsiText } from '~types/chalk.js'

export type PageSize = number | null

export interface Paginator {
  indexFrom: number
  indexTo: number | null
}

export interface PointerIndexes {
  row: number
  column: number
}

export type Cell = number | string | boolean
export type Rows = Cell[][]

export type ExtractedRow = ExtractedAnsiText
export type ExtractedRows = ExtractedAnsiText[][]
