import { DocumentReference } from '@firebase/firestore'
import { GeoPoint, FieldValue } from 'firebase/firestore'

import { getDb } from '~root/firestore/index.js'
import { PRIMITIVE_FIELD_TYPES } from '~types/firestore-field-types.js'
import { TYPE_VALUES } from '~utils/firestore-type-values.js'

describe(__filename, () => {
  it(`is ${PRIMITIVE_FIELD_TYPES.string}`, async () => {
    const db = await getDb()
    const typeValues = TYPE_VALUES(db)()
    expect(typeValues[PRIMITIVE_FIELD_TYPES.string]).toBe('hoge')
  })
  it(`is ${PRIMITIVE_FIELD_TYPES.number}`, async () => {
    const db = await getDb()
    const typeValues = TYPE_VALUES(db)()
    expect(typeValues[PRIMITIVE_FIELD_TYPES.number]).toBe(-1)
  })
  it(`is ${PRIMITIVE_FIELD_TYPES.int}`, async () => {
    const db = await getDb()
    const typeValues = TYPE_VALUES(db)()
    expect(typeValues[PRIMITIVE_FIELD_TYPES.int]).toBe(1)
  })
  it(`is ${PRIMITIVE_FIELD_TYPES.float}`, async () => {
    const db = await getDb()
    const typeValues = TYPE_VALUES(db)()
    expect(typeValues[PRIMITIVE_FIELD_TYPES.float]).toBe(1.1)
  })
  it(`is ${PRIMITIVE_FIELD_TYPES.bool}`, async () => {
    const db = await getDb()
    const typeValues = TYPE_VALUES(db)()
    expect(typeValues[PRIMITIVE_FIELD_TYPES.bool]).toBe(true)
  })
  it(`is ${PRIMITIVE_FIELD_TYPES.null}`, async () => {
    const db = await getDb()
    const typeValues = TYPE_VALUES(db)()
    expect(typeValues[PRIMITIVE_FIELD_TYPES.null]).toBe(null)
  })
  it(`is ${PRIMITIVE_FIELD_TYPES.timestamp}`, async () => {
    const db = await getDb()
    const typeValues = TYPE_VALUES(db)()
    expect(typeValues[PRIMITIVE_FIELD_TYPES.timestamp] instanceof FieldValue).toBe(true)
  })
  it(`is ${PRIMITIVE_FIELD_TYPES.latlng}`, async () => {
    const db = await getDb()
    const typeValues = TYPE_VALUES(db)()
    expect(typeValues[PRIMITIVE_FIELD_TYPES.latlng] instanceof GeoPoint).toBe(true)
  })
  it(`is ${PRIMITIVE_FIELD_TYPES.path}`, async () => {
    const db = await getDb()
    const typeValues = TYPE_VALUES(db)()
    expect(typeValues[PRIMITIVE_FIELD_TYPES.path] instanceof DocumentReference).toBe(true)
  })
  it(`is specific`, async () => {
    const db = await getDb()
    const typeValues = TYPE_VALUES<{ specific: 'specific' }>(db, { specific: 'specific' })()
    expect(typeValues['specific']).toBe('specific')
  })
})
