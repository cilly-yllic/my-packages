import { KeyTypeConst, Type } from './key-type.js'
export type Inclusions<T extends KeyTypeConst> = Partial<{
  [type in Type<T>]: Type<T>[]
}>
