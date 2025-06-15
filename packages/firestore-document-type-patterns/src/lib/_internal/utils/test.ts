import { doc } from 'firebase/firestore'

import { Firestore, collectionName, documentId, date } from '~types/firestore-field-types.js'

import { getGeoPoint, getServerTimestamp } from './firestore.js'

export const getFieldDefaultValues = (db: Firestore, isInArray = false) => ({
  string: 'hoge',
  int: 1,
  float: 1.1,
  number: -1,
  bool: true,
  map: {},
  list: [],
  null: null,
  timestamp: isInArray ? date : getServerTimestamp(),
  latlng: getGeoPoint(1, 1),
  path: doc(db, collectionName, documentId),
})
