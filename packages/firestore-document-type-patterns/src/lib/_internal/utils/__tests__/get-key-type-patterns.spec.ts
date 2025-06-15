import { DocumentType, PRIMITIVE_FIELD_TYPES } from '~types/firestore-field-types.js'
import { getKeyTypePatterns } from '~utils/get-key-type-patterns.js'

describe(__filename, () => {
  it(`type list check`, async () => {
    const DOCUMENT_TYPE: DocumentType = {
      string: [PRIMITIVE_FIELD_TYPES.string, PRIMITIVE_FIELD_TYPES.timestamp],
    }
    const LIST = [
      {
        string: PRIMITIVE_FIELD_TYPES.string,
      },
      {
        string: PRIMITIVE_FIELD_TYPES.timestamp,
      },
    ]
    expect(JSON.stringify(getKeyTypePatterns<DocumentType>(DOCUMENT_TYPE))).toBe(JSON.stringify(LIST))
  })
  it(`type specific list check`, async () => {
    const DOCUMENT_TYPE: DocumentType = {
      string: [PRIMITIVE_FIELD_TYPES.string, 'foo'],
    }
    const LIST = [
      {
        string: PRIMITIVE_FIELD_TYPES.string,
      },
      {
        string: 'foo',
      },
    ]
    expect(JSON.stringify(getKeyTypePatterns<DocumentType>(DOCUMENT_TYPE))).toBe(JSON.stringify(LIST))
  })
  it(`complicated check`, async () => {
    const DOCUMENT_TYPE: DocumentType = {
      string: [
        PRIMITIVE_FIELD_TYPES.string,
        {
          timestamp: [PRIMITIVE_FIELD_TYPES.timestamp],
        },
      ],
      'list[]': [
        PRIMITIVE_FIELD_TYPES.number,
        {
          bool: [PRIMITIVE_FIELD_TYPES.bool],
          'list[]': [PRIMITIVE_FIELD_TYPES.latlng],
          path: [PRIMITIVE_FIELD_TYPES.path],
        },
      ],
    }
    const LIST = [
      {
        string: PRIMITIVE_FIELD_TYPES.string,
        list: [PRIMITIVE_FIELD_TYPES.number],
      },
      {
        string: PRIMITIVE_FIELD_TYPES.string,
        list: [
          {
            bool: PRIMITIVE_FIELD_TYPES.bool,
            list: [PRIMITIVE_FIELD_TYPES.latlng],
            path: PRIMITIVE_FIELD_TYPES.path,
          },
        ],
      },
      {
        string: {
          timestamp: PRIMITIVE_FIELD_TYPES.timestamp,
        },
        list: [PRIMITIVE_FIELD_TYPES.number],
      },
      {
        string: {
          timestamp: PRIMITIVE_FIELD_TYPES.timestamp,
        },
        list: [
          {
            bool: PRIMITIVE_FIELD_TYPES.bool,
            list: [PRIMITIVE_FIELD_TYPES.latlng],
            path: PRIMITIVE_FIELD_TYPES.path,
          },
        ],
      },
    ]
    expect(JSON.stringify(getKeyTypePatterns<DocumentType>(DOCUMENT_TYPE))).toBe(JSON.stringify(LIST))
  })
})
