import { Data, IncludeArrayKeyMap } from './utilities.js'

export type Type<T extends Data = Data> = string | KeyTypeMap<T>

export type KeyTypeMap<T extends Data = Data> = {
  [key in keyof T]: Type | Type[]
}

export type KeyTypePatterns<T extends Data = Data> = KeyTypeMap<Partial<IncludeArrayKeyMap<T>>>
