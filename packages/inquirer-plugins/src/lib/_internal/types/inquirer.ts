import { Status } from '@inquirer/core'
import { type Prettify } from '@inquirer/type'

export type Answers<T> = Readonly<T>
export type SetUseState<Value> = (newValue: Value) => void

interface DoneIf<T> {
  status: Status
  data: T
}
export type Done<T> = (arg: Prettify<DoneIf<T>>) => void

export const STATUSES: Record<Status, Status> = Object.freeze({
  loading: 'loading',
  idle: 'idle',
  done: 'done',
} as const)
