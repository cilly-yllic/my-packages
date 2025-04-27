import { input, confirm, number, rawlist, select } from '@inquirer/prompts'

type Types = typeof input | typeof confirm | typeof number | typeof rawlist | typeof select

interface Question<Q extends Types> {
  name: string
  question: () => ReturnType<Q>
  filter?: (...args: any[]) => any
}

export type InputQuestion = Question<typeof input>
export type ConfirmQuestion = Question<typeof confirm>
export type NumberQuestion = Question<typeof number>
export type RawListQuestion = Question<typeof rawlist>
export type SelectQuestion = Question<typeof select>

export type Questions = ReadonlyArray<InputQuestion | ConfirmQuestion | NumberQuestion | RawListQuestion | SelectQuestion>

type AwaitedReturn<T> = T extends Promise<infer U> ? U : never;
export type Answer<Q extends Types> = AwaitedReturn<ReturnType<Q>>
export interface Answers {
  [name: string]: Answer<Types>
}