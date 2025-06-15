import { getDb } from '~root/firestore/index.js'
import { PRIMITIVE_FIELD_TYPES, TypePattern } from '~types/firestore-field-types.js'
import { convertTypeToValue } from '~utils/convert-type-to-value.js'
import { TYPE_VALUES } from '~utils/firestore-type-values.js'
import { getFieldDefaultValues } from '~utils/test.js'

describe(__filename, () => {
  it(`check string list`, async () => {
    const PATTERN: TypePattern = {
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
    }
    const db = await getDb()
    const defaultValues = getFieldDefaultValues(db)
    const LIST = {
      string: {
        timestamp: defaultValues.timestamp,
      },
      list: [
        {
          bool: defaultValues.bool,
          list: [defaultValues.latlng],
          path: defaultValues.path,
        },
      ],
    }
    expect(JSON.stringify(convertTypeToValue(PATTERN, TYPE_VALUES(db)))).toBe(JSON.stringify(LIST))
  })
})
