import { getDb } from '../../../firestore/index.js'
import { getRecursiveWrongTypeValues } from '../../security-rule.js'
import { PRIMITIVE_FIELD_TYPES } from '../../types/firestore-field-types.js'
import { REQUIRED_TYPE_VALUES } from '../../types/types.js'
import { getFieldDefaultValues } from '../../utils/test.js'

const ARRAY = [
  // PRIMITIVE_FIELD_TYPES.string,
  PRIMITIVE_FIELD_TYPES.number,
  PRIMITIVE_FIELD_TYPES.int,
  PRIMITIVE_FIELD_TYPES.float,
  PRIMITIVE_FIELD_TYPES.bool,
  PRIMITIVE_FIELD_TYPES.null,
  PRIMITIVE_FIELD_TYPES.timestamp,
  PRIMITIVE_FIELD_TYPES.latlng,
  PRIMITIVE_FIELD_TYPES.path,
]

describe(__filename, () => {
  it(`simple string`, async () => {
    const DOCUMENT_TYPE = {
      string: ARRAY,
    }
    const db = await getDb()
    const defaultValues = getFieldDefaultValues(db)
    const LIST = [
      {
        string: defaultValues.string,
      },
      {
        string: REQUIRED_TYPE_VALUES.__map__,
      },
      {
        string: REQUIRED_TYPE_VALUES.__list__,
      },
    ]
    expect(JSON.stringify(getRecursiveWrongTypeValues([DOCUMENT_TYPE], db))).toBe(JSON.stringify(LIST))
  })

  it(`simple array`, async () => {
    const DOCUMENT_TYPE = {
      'list[]': ARRAY,
    }
    const db = await getDb()
    const defaultValues = getFieldDefaultValues(db)
    const LIST = [
      { list: defaultValues.string },
      { list: defaultValues.number },
      { list: defaultValues.int },
      { list: defaultValues.float },
      { list: defaultValues.bool },
      { list: defaultValues.null },
      { list: defaultValues.timestamp },
      { list: defaultValues.latlng },
      { list: defaultValues.path },
      { list: defaultValues.map },
      { list: [defaultValues.string] },
      { list: [REQUIRED_TYPE_VALUES.__map__] },
    ]
    expect(JSON.stringify(getRecursiveWrongTypeValues([DOCUMENT_TYPE], db))).toBe(JSON.stringify(LIST))
  })

  it(`simple map`, async () => {
    const DOCUMENT_TYPE = {
      map: {
        number: PRIMITIVE_FIELD_TYPES.number,
      },
    }
    const db = await getDb()
    const defaultValues = getFieldDefaultValues(db)
    const LIST = [
      { map: defaultValues.string },
      { map: defaultValues.number },
      { map: defaultValues.int },
      { map: defaultValues.float },
      { map: defaultValues.bool },
      { map: defaultValues.null },
      { map: defaultValues.timestamp },
      { map: defaultValues.latlng },
      { map: defaultValues.path },
      { map: REQUIRED_TYPE_VALUES.__list__ },

      { map: { number: defaultValues.string } },
      { map: { number: defaultValues.bool } },
      { map: { number: defaultValues.null } },
      { map: { number: defaultValues.timestamp } },
      { map: { number: defaultValues.latlng } },
      { map: { number: defaultValues.path } },
      { map: { number: REQUIRED_TYPE_VALUES.__map__ } },
      { map: { number: REQUIRED_TYPE_VALUES.__list__ } },
    ]
    expect(JSON.stringify(getRecursiveWrongTypeValues([DOCUMENT_TYPE], db))).toBe(JSON.stringify(LIST))
  })
})

describe(`${__filename} (specific)`, () => {
  it(`simple string`, async () => {
    const DOCUMENT_TYPE = {
      specific: ['foo', PRIMITIVE_FIELD_TYPES.string],
      string: PRIMITIVE_FIELD_TYPES.string,
    }
    const db = await getDb()
    const defaultValues = getFieldDefaultValues(db)
    const LIST = [
      {
        specific: defaultValues.number,
        string: defaultValues.string,
      },
      {
        specific: defaultValues.int,
        string: defaultValues.string,
      },
      {
        specific: defaultValues.float,
        string: defaultValues.string,
      },
      {
        specific: defaultValues.bool,
        string: defaultValues.string,
      },
      {
        specific: defaultValues.null,
        string: defaultValues.string,
      },
      {
        specific: defaultValues.timestamp,
        string: defaultValues.string,
      },
      {
        specific: defaultValues.latlng,
        string: defaultValues.string,
      },
      {
        specific: defaultValues.path,
        string: defaultValues.string,
      },
      {
        specific: defaultValues.map,
        string: defaultValues.string,
      },
      {
        specific: defaultValues.list,
        string: defaultValues.string,
      },

      {
        specific: 'foo',
        string: defaultValues.number,
      },
      {
        specific: 'foo',
        string: defaultValues.int,
      },
      {
        specific: 'foo',
        string: defaultValues.float,
      },
      {
        specific: 'foo',
        string: defaultValues.bool,
      },
      {
        specific: 'foo',
        string: defaultValues.null,
      },
      {
        specific: 'foo',
        string: defaultValues.timestamp,
      },
      {
        specific: 'foo',
        string: defaultValues.latlng,
      },
      {
        specific: 'foo',
        string: defaultValues.path,
      },
      {
        specific: 'foo',
        string: defaultValues.map,
      },
      {
        specific: 'foo',
        string: defaultValues.list,
      },

      {
        specific: defaultValues.string,
        string: defaultValues.number,
      },
      {
        specific: defaultValues.string,
        string: defaultValues.int,
      },
      {
        specific: defaultValues.string,
        string: defaultValues.float,
      },
      {
        specific: defaultValues.string,
        string: defaultValues.bool,
      },
      {
        specific: defaultValues.string,
        string: defaultValues.null,
      },
      {
        specific: defaultValues.string,
        string: defaultValues.timestamp,
      },
      {
        specific: defaultValues.string,
        string: defaultValues.latlng,
      },
      {
        specific: defaultValues.string,
        string: defaultValues.path,
      },
      {
        specific: defaultValues.string,
        string: defaultValues.map,
      },
      {
        specific: defaultValues.string,
        string: defaultValues.list,
      },
    ]
    expect(JSON.stringify(getRecursiveWrongTypeValues([DOCUMENT_TYPE], db))).toBe(JSON.stringify(LIST))
  })

  it(`simple array`, async () => {
    const DOCUMENT_TYPE = {
      'list[]': [...ARRAY, 'foo'],
    }
    const db = await getDb()
    const defaultValues = getFieldDefaultValues(db)
    const LIST = [
      { list: defaultValues.string },
      { list: defaultValues.number },
      { list: defaultValues.int },
      { list: defaultValues.float },
      { list: defaultValues.bool },
      { list: defaultValues.null },
      { list: defaultValues.timestamp },
      { list: defaultValues.latlng },
      { list: defaultValues.path },
      { list: defaultValues.map },
      { list: [defaultValues.string] },
      { list: [defaultValues.map] },
    ]
    expect(JSON.stringify(getRecursiveWrongTypeValues([DOCUMENT_TYPE], db))).toBe(JSON.stringify(LIST))
  })
})
