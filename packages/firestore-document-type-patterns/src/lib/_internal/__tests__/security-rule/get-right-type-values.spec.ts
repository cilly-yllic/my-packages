import { getDb } from '../../../firestore/index.js'
import { getRecursiveRightTypeValues } from '../../security-rule.js'
import { ALL_FIELD_TYPES } from '../../types/firestore-field-types.js'
import { getFieldDefaultValues } from '../../utils/test.js'

const ARRAY = [
  // ALL_FIELD_TYPES.string,
  ALL_FIELD_TYPES.number,
  ALL_FIELD_TYPES.int,
  ALL_FIELD_TYPES.float,
  ALL_FIELD_TYPES.bool,
  ALL_FIELD_TYPES.null,
  ALL_FIELD_TYPES.timestamp,
  ALL_FIELD_TYPES.latlng,
  ALL_FIELD_TYPES.path,
]

describe(__filename, () => {
  it(`simple string`, async () => {
    const DOCUMENT_TYPE = {
      string: ARRAY,
    }
    const db = await getDb()
    const defaultValues = getFieldDefaultValues(db)
    const LIST = [
      { string: defaultValues.number },
      { string: defaultValues.int },
      { string: defaultValues.float },
      { string: defaultValues.bool },
      { string: defaultValues.null },
      { string: defaultValues.timestamp },
      { string: defaultValues.latlng },
      { string: defaultValues.path },
    ]
    expect(JSON.stringify(getRecursiveRightTypeValues([DOCUMENT_TYPE], db))).toBe(JSON.stringify(LIST))
  })

  it(`simple list`, async () => {
    const DOCUMENT_TYPE = {
      'list[]': ARRAY,
    }
    const db = await getDb()
    const defaultValues = getFieldDefaultValues(db, true)
    const LIST = [
      { list: [defaultValues.number] },
      { list: [defaultValues.int] },
      { list: [defaultValues.float] },
      { list: [defaultValues.bool] },
      { list: [defaultValues.null] },
      { list: [defaultValues.timestamp] },
      { list: [defaultValues.latlng] },
      { list: [defaultValues.path] },
    ]
    expect(JSON.stringify(getRecursiveRightTypeValues([DOCUMENT_TYPE], db))).toBe(JSON.stringify(LIST))
  })

  it(`simple map`, async () => {
    const DOCUMENT_TYPE = {
      map: {
        number: [ALL_FIELD_TYPES.number, ALL_FIELD_TYPES.string],
      },
    }
    const db = await getDb()
    const defaultValues = getFieldDefaultValues(db)
    const LIST = [{ map: { number: defaultValues.number } }, { map: { number: defaultValues.string } }]
    expect(JSON.stringify(getRecursiveRightTypeValues([DOCUMENT_TYPE], db))).toBe(JSON.stringify(LIST))
  })
})

describe(`${__filename} (specific)`, () => {
  it(`simple string (specific)`, async () => {
    const DOCUMENT_TYPE = {
      specific: ['foo'],
    }
    const db = await getDb()
    const LIST = [{ specific: 'foo' }]
    expect(JSON.stringify(getRecursiveRightTypeValues([DOCUMENT_TYPE], db))).toBe(JSON.stringify(LIST))
  })
  it(`simple strings (specific)`, async () => {
    const DOCUMENT_TYPE = {
      specific: [...ARRAY, 'foo'],
    }
    const db = await getDb()
    const defaultValues = getFieldDefaultValues(db)
    const LIST = [
      { specific: defaultValues.number },
      { specific: defaultValues.int },
      { specific: defaultValues.float },
      { specific: defaultValues.bool },
      { specific: defaultValues.null },
      { specific: defaultValues.timestamp },
      { specific: defaultValues.latlng },
      { specific: defaultValues.path },
      { specific: 'foo' },
    ]
    expect(JSON.stringify(getRecursiveRightTypeValues([DOCUMENT_TYPE], db))).toBe(JSON.stringify(LIST))
  })

  it(`simple list (specific)`, async () => {
    const DOCUMENT_TYPE = {
      'list[]': ['foo'],
    }
    const db = await getDb()
    const LIST = [{ list: ['foo'] }]
    expect(JSON.stringify(getRecursiveRightTypeValues([DOCUMENT_TYPE], db))).toBe(JSON.stringify(LIST))
  })

  it(`simple lists (specific)`, async () => {
    const DOCUMENT_TYPE = {
      'list[]': [...ARRAY, 'foo'],
    }
    const db = await getDb()
    const defaultValues = getFieldDefaultValues(db, true)
    const LIST = [
      { list: [defaultValues.number] },
      { list: [defaultValues.int] },
      { list: [defaultValues.float] },
      { list: [defaultValues.bool] },
      { list: [defaultValues.null] },
      { list: [defaultValues.timestamp] },
      { list: [defaultValues.latlng] },
      { list: [defaultValues.path] },
      { list: ['foo'] },
    ]
    expect(JSON.stringify(getRecursiveRightTypeValues([DOCUMENT_TYPE], db))).toBe(JSON.stringify(LIST))
  })

  it(`simple map (specific)`, async () => {
    const DOCUMENT_TYPE = {
      map: {
        specific: 'foo',
      },
    }
    const db = await getDb()
    const LIST = [{ map: { specific: 'foo' } }]
    expect(JSON.stringify(getRecursiveRightTypeValues([DOCUMENT_TYPE], db))).toBe(JSON.stringify(LIST))
  })

  it(`simple maps (specific)`, async () => {
    const DOCUMENT_TYPE = {
      map: {
        specific: ['foo', ALL_FIELD_TYPES.number],
      },
    }
    const db = await getDb()
    const defaultValues = getFieldDefaultValues(db)
    const LIST = [{ map: { specific: 'foo' } }, { map: { specific: defaultValues.number } }]
    expect(JSON.stringify(getRecursiveRightTypeValues([DOCUMENT_TYPE], db))).toBe(JSON.stringify(LIST))
  })

  it(`complex`, async () => {
    const DOCUMENT_TYPES = [
      {
        result: {
          status: 'success',
          code: ALL_FIELD_TYPES.null,
          message: ALL_FIELD_TYPES.string,
          detail: ALL_FIELD_TYPES.null,
        },
      },
      {
        result: {
          status: 'error',
          code: ALL_FIELD_TYPES.number,
          message: ALL_FIELD_TYPES.string,
          detail: [ALL_FIELD_TYPES.string, ALL_FIELD_TYPES.map, ALL_FIELD_TYPES.list],
        },
      },
    ]
    const db = await getDb()
    const defaultValues = getFieldDefaultValues(db)
    const LIST = [
      {
        result: {
          status: 'success',
          code: defaultValues.null,
          message: defaultValues.string,
          detail: defaultValues.null,
        },
      },
      {
        result: {
          status: 'error',
          code: defaultValues.number,
          message: defaultValues.string,
          detail: defaultValues.string,
        },
      },
      {
        result: {
          status: 'error',
          code: defaultValues.number,
          message: defaultValues.string,
          detail: defaultValues.map,
        },
      },
      {
        result: {
          status: 'error',
          code: defaultValues.number,
          message: defaultValues.string,
          detail: defaultValues.list,
        },
      },
    ]
    expect(JSON.stringify(getRecursiveRightTypeValues(DOCUMENT_TYPES, db))).toBe(JSON.stringify(LIST))
  })
})
