import { doc } from 'firebase/firestore'

import {
  Firestore,
  collectionName,
  documentId,
  date,
  ALL_FIELD_TYPES,
  AllFieldTypes,
} from '~types/firestore-field-types.js'

import { getGeoPoint, getServerTimestamp } from './firestore.js'

type Optionals = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

type AllFieldTypeValues = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [field in AllFieldTypes]: any
}

export const TYPE_VALUES =
  <D extends Optionals = Optionals>(db: Firestore, optionals?: D) =>
  (_depth = 0, isInArray = false): AllFieldTypeValues & D => {
    return {
      [ALL_FIELD_TYPES.string]: 'hoge',
      [ALL_FIELD_TYPES.int]: 1,
      [ALL_FIELD_TYPES.float]: 1.1,
      [ALL_FIELD_TYPES.number]: -1,
      [ALL_FIELD_TYPES.bool]: true,
      [ALL_FIELD_TYPES.map]: {},
      [ALL_FIELD_TYPES.list]: [],
      [ALL_FIELD_TYPES.null]: null,
      [ALL_FIELD_TYPES.timestamp]: isInArray ? date : getServerTimestamp(),
      [ALL_FIELD_TYPES.latlng]: getGeoPoint(1, 1),
      [ALL_FIELD_TYPES.path]: doc(db, collectionName, documentId),
      ...(optionals || {}),
    } as AllFieldTypeValues & D
  }

export type TypeValues = ReturnType<ReturnType<typeof TYPE_VALUES>>
