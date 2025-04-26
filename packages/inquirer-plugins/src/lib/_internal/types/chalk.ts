import { ChalkInstance } from 'chalk'

export type Message = string | ChalkInstance

export interface ExtractedAnsiText {
  text: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attach: (v: any) => string
}
