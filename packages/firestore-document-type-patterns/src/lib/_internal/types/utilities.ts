export interface Data {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface KeyMap {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any | KeyMap
}

export type ArrayKey<T extends Data = Data> = `${Extract<keyof T, string>}[]`

export type IncludeArrayKeyMap<T extends Data = Data> = T & {
  [key in ArrayKey<T>]: T[keyof T]
}
