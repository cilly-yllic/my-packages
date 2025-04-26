import { ExtractedRows, Rows } from '~types/table.js'
import { extractAnsiWrapper } from '~utils/chalk.js'

export const getExtractedAnsiRows = (rows: Rows): ExtractedRows => {
  return rows.map(cells => cells.map(cell => extractAnsiWrapper(cell)))
}
