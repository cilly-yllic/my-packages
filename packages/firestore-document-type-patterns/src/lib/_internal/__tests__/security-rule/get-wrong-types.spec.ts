import { DocumentData } from 'firebase/firestore'

import { getRecursiveWrongTypes } from '../../security-rule.js'
import { ALL_FIELD_TYPES } from '../../types/firestore-field-types.js'

type Data = DocumentData
type KeyTypeConst = typeof ALL_FIELD_TYPES

const ARRAY = [
  // PRIMITIVE_FIELD_TYPES.string,
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

    const LIST = [{ string: ALL_FIELD_TYPES.string }, { string: ALL_FIELD_TYPES.map }, { string: ALL_FIELD_TYPES.list }]
    expect(JSON.stringify(getRecursiveWrongTypes<Data, KeyTypeConst>([DOCUMENT_TYPE]))).toBe(JSON.stringify(LIST))
  })

  it(`simple array`, async () => {
    const DOCUMENT_TYPE = {
      'list[]': ARRAY,
    }

    const LIST = [
      { list: ALL_FIELD_TYPES.string },
      { list: ALL_FIELD_TYPES.number },
      { list: ALL_FIELD_TYPES.int },
      { list: ALL_FIELD_TYPES.float },
      { list: ALL_FIELD_TYPES.bool },
      { list: ALL_FIELD_TYPES.null },
      { list: ALL_FIELD_TYPES.timestamp },
      { list: ALL_FIELD_TYPES.latlng },
      { list: ALL_FIELD_TYPES.path },
      { list: ALL_FIELD_TYPES.map },
      { list: [ALL_FIELD_TYPES.string] },
      { list: [ALL_FIELD_TYPES.map] },
    ]
    expect(JSON.stringify(getRecursiveWrongTypes<Data, KeyTypeConst>([DOCUMENT_TYPE]))).toBe(JSON.stringify(LIST))
  })

  it(`simple map`, async () => {
    const DOCUMENT_TYPE = {
      map: {
        number: ALL_FIELD_TYPES.number,
      },
    }

    const LIST = [
      { map: ALL_FIELD_TYPES.string },
      { map: ALL_FIELD_TYPES.number },
      { map: ALL_FIELD_TYPES.int },
      { map: ALL_FIELD_TYPES.float },
      { map: ALL_FIELD_TYPES.bool },
      { map: ALL_FIELD_TYPES.null },
      { map: ALL_FIELD_TYPES.timestamp },
      { map: ALL_FIELD_TYPES.latlng },
      { map: ALL_FIELD_TYPES.path },
      { map: ALL_FIELD_TYPES.list },

      { map: { number: ALL_FIELD_TYPES.string } },
      { map: { number: ALL_FIELD_TYPES.bool } },
      { map: { number: ALL_FIELD_TYPES.null } },
      { map: { number: ALL_FIELD_TYPES.timestamp } },
      { map: { number: ALL_FIELD_TYPES.latlng } },
      { map: { number: ALL_FIELD_TYPES.path } },
      { map: { number: ALL_FIELD_TYPES.map } },
      { map: { number: ALL_FIELD_TYPES.list } },
    ]
    expect(JSON.stringify(getRecursiveWrongTypes<Data, KeyTypeConst>([DOCUMENT_TYPE]))).toBe(JSON.stringify(LIST))
  })

  it(`complex`, async () => {
    const DOCUMENT_TYPES = [
      {
        result: {
          status: 'success',
          code: ALL_FIELD_TYPES.null,
          message: ALL_FIELD_TYPES.string,
        },
      },
      {
        result: {
          status: 'error',
          code: ALL_FIELD_TYPES.number,
          message: ALL_FIELD_TYPES.string,
        },
      },
    ]

    const LIST = [
      { result: ALL_FIELD_TYPES.string },
      { result: ALL_FIELD_TYPES.number },
      { result: ALL_FIELD_TYPES.int },
      { result: ALL_FIELD_TYPES.float },
      { result: ALL_FIELD_TYPES.bool },
      { result: ALL_FIELD_TYPES.null },
      { result: ALL_FIELD_TYPES.timestamp },
      { result: ALL_FIELD_TYPES.latlng },
      { result: ALL_FIELD_TYPES.path },
      { result: ALL_FIELD_TYPES.list },

      { result: { status: ALL_FIELD_TYPES.string, code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.number, code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.int, code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.float, code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.bool, code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.null, code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.timestamp, code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.latlng, code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.path, code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.map, code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.list, code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.string } },

      { result: { status: 'success', code: ALL_FIELD_TYPES.string, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.int, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.float, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.bool, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.timestamp, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.latlng, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.path, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.map, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.list, message: ALL_FIELD_TYPES.string } },

      { result: { status: 'success', code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.number } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.int } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.float } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.bool } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.null } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.timestamp } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.latlng } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.path } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.map } },
      { result: { status: 'success', code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.list } },

      { result: { status: ALL_FIELD_TYPES.string, code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.number, code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.int, code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.float, code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.bool, code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.null, code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.timestamp, code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.latlng, code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.path, code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.map, code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.string } },
      { result: { status: ALL_FIELD_TYPES.list, code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.string } },

      { result: { status: 'error', code: ALL_FIELD_TYPES.string, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.bool, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.null, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.timestamp, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.latlng, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.path, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.map, message: ALL_FIELD_TYPES.string } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.list, message: ALL_FIELD_TYPES.string } },

      { result: { status: 'error', code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.number } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.int } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.float } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.bool } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.null } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.timestamp } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.latlng } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.path } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.map } },
      { result: { status: 'error', code: ALL_FIELD_TYPES.number, message: ALL_FIELD_TYPES.list } },
    ]
    expect(JSON.stringify(getRecursiveWrongTypes<Data, KeyTypeConst>(DOCUMENT_TYPES))).toBe(JSON.stringify(LIST))
  })
})
