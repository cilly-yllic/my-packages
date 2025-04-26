import { Cell } from '~types/table.js'
import { ChalkInstance } from 'chalk'

export const DEFAULT_PAGE_SIZE = 5

export const END_STATUSES = Object.freeze({
  confirmed: 'confirmed',
  escaped: 'escaped',
} as const)

export type EndStatus = (typeof END_STATUSES)[keyof typeof END_STATUSES]

export interface ValidateResult {
  isValid: boolean
  message: string
}

export interface Colors {
  selected: ChalkInstance
  editable: ChalkInstance
  editing: ChalkInstance
}

export interface Typing {
  current: Cell
  backup: Cell
}

export interface NextClose {
  escape: boolean
}
