import { Status } from '@inquirer/core'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Answers = Readonly<Record<string, any>>
export type SetUseState<Value> = (newValue: Value) => void
export type Done = (answers: Answers) => void

export const STATUSES: Record<Status, Status> = Object.freeze({
  loading: 'loading',
  idle: 'idle',
  done: 'done',
} as const)
