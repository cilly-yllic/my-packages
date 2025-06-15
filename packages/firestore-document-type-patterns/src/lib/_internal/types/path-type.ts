// import { Data } from './utilities.js'
import { Type } from './key-type-patterns.js'
import { KeyTypeConst } from './key-type.js'
import { RequiredTypes } from './types.js'

export interface PathType<T extends KeyTypeConst = KeyTypeConst> {
  path: string
  type: RequiredTypes | Type<T>
}
