import { RulesTestContext } from '@firebase/rules-unit-testing'
// import { GeoPoint, FieldValue, DocumentReference, DocumentData } from 'firebase/firestore'
import { DocumentData } from 'firebase/firestore'
import { v4 as randomStr } from 'uuid'

import { Inclusions } from './inclusion-types.js'
import { REQUIRED_TYPES } from './types.js'
import { Data, IncludeArrayKeyMap } from './utilities.js'

export type Firestore = ReturnType<RulesTestContext['firestore']>
export const collectionName = randomStr()
export const documentId = randomStr()
export const date = new Date()

export const PRIMITIVE_FIELD_TYPES = {
  string: 'string',
  number: 'number',
  int: 'int',
  float: 'float',
  bool: 'bool',
  null: 'null',
  timestamp: 'timestamp',
  latlng: 'latlng',
  path: 'path',
} as const
export const ALL_FIELD_TYPES = {
  ...PRIMITIVE_FIELD_TYPES,
  map: REQUIRED_TYPES.map,
  list: REQUIRED_TYPES.list,
} as const

export type PrimitiveFieldTypes = (typeof PRIMITIVE_FIELD_TYPES)[keyof typeof PRIMITIVE_FIELD_TYPES]
export type AllFieldTypes = (typeof ALL_FIELD_TYPES)[keyof typeof ALL_FIELD_TYPES]

// type Inclusions = {
//   [type in AllFieldTypes]: AllFieldTypes[]
// }
export const INCLUSIONS: Inclusions<typeof ALL_FIELD_TYPES> = {
  [ALL_FIELD_TYPES.number]: [ALL_FIELD_TYPES.number, ALL_FIELD_TYPES.int, ALL_FIELD_TYPES.float],
  [ALL_FIELD_TYPES.int]: [ALL_FIELD_TYPES.number, ALL_FIELD_TYPES.int],
  [ALL_FIELD_TYPES.float]: [ALL_FIELD_TYPES.number, ALL_FIELD_TYPES.float],
}

export type FieldType = PrimitiveFieldTypes | FieldMap | string // for specific

export type FieldMap<T extends Data = DocumentData> = {
  [fieldName in keyof T]: FieldType | FieldType[]
}

export type DocumentType<T extends Data = DocumentData> = FieldMap<Partial<IncludeArrayKeyMap<T>>>

export type PatternType = AllFieldTypes | PatternMap
export type PatternMap = TypePattern
export interface TypePattern {
  [fieldName: string]: PatternType | PatternType[]
}
export interface PathType {
  path: string
  type: AllFieldTypes
}

// export type Value =
//   | string
//   | number
//   | boolean
//   | Record<string, unknown>
//   | []
//   | null
//   | FieldValue
//   | Date
//   | GeoPoint
//   | DocumentReference<DocumentData>

// export interface TypeValue {
//   [fieldName: string]: Value | Value[] | TypeValue
// }
