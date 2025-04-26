import { Cell } from '~types/table.js'
import figures from 'figures'

export const isTrue = (value: Cell): boolean => value === true || value === 'true'
export const getCheckbox = (bool: Cell) => (isTrue(bool) ? figures.checkboxOn : figures.checkboxOff)
