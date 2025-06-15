import { RequiredKeyValue } from './types.js'
export interface KeyValue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export type Value<T extends KeyValue = KeyValue> = T[keyof T]
export type KeyTypeValues<T extends KeyValue = KeyValue> = {
  [key in keyof T]: Value<T> | Value<T>[] | KeyTypeValues<T>
} & Partial<RequiredKeyValue>

export type KeyTypeValueFnc<T extends KeyValue = KeyValue> = (depth: number, isInArray: boolean) => KeyTypeValues<T>
export type KeyTypeValue<T extends KeyValue = KeyValue> = KeyTypeValues<T>[keyof KeyTypeValues<T>]

export interface KeyValues<T extends KeyValue = KeyValue> {
  [key: string]: Value<T> | [Value<T>] | KeyValues<T>
}
