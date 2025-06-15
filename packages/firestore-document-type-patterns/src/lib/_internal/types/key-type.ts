export interface KeyTypeConst {
  [key: string]: string
}
export type KeyType<T extends KeyTypeConst> = {
  // T[keyof T]
  [key in keyof T]: T[keyof T]
}
export type Type<T extends KeyTypeConst> = KeyType<T>[keyof KeyType<T>]
