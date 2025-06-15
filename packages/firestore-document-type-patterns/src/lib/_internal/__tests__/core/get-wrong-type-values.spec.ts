import { getRecursiveWrongTypeValues } from '~internal/index.js'
import { Inclusions } from '~types/inclusion-types.js'
import { KeyTypePatterns } from '~types/key-type-patterns.js'
import { KeyTypeValueFnc, KeyTypeValues, KeyValues } from '~types/key-type-values.js'
import { KeyType } from '~types/key-type.js'
import { REQUIRED_TYPE_VALUES } from '~types/types.js'

interface Data {
  hoge: string
  foo: string
}

type KeyTypeConst = {
  hoge: string
  foo: string
}

type KeyValue = {
  hoge: number
  foo: number
}

describe(__filename, () => {
  it(`simple string`, async () => {
    const KEY_TYPES = {
      hoge: 'hoge',
      foo: 'foo',
    }
    const PARAMS = [
      {
        hoge: KEY_TYPES.hoge,
        piyo: [KEY_TYPES.hoge, KEY_TYPES.foo],
      },
    ]

    const KEY_VALUES = {
      hoge: 1,
      foo: 2,
      ...REQUIRED_TYPE_VALUES,
    }
    const DEFAULT_VALUES: KeyTypeValueFnc<typeof KEY_VALUES> = () => {
      return KEY_VALUES
    }
    const LIST = [
      {
        hoge: KEY_VALUES.foo,
        piyo: KEY_VALUES.hoge,
      },
      {
        hoge: KEY_VALUES.__map__,
        piyo: KEY_VALUES.hoge,
      },
      {
        hoge: KEY_VALUES.__list__,
        piyo: KEY_VALUES.hoge,
      },
      {
        hoge: KEY_VALUES.hoge,
        piyo: KEY_VALUES.__map__,
      },
      {
        hoge: KEY_VALUES.hoge,
        piyo: KEY_VALUES.__list__,
      },

      {
        hoge: KEY_VALUES.foo,
        piyo: KEY_VALUES.foo,
      },

      {
        hoge: KEY_VALUES.__map__,
        piyo: KEY_VALUES.foo,
      },
      {
        hoge: KEY_VALUES.__list__,
        piyo: KEY_VALUES.foo,
      },
    ]
    expect(
      JSON.stringify(
        getRecursiveWrongTypeValues<(typeof PARAMS)[0], typeof KEY_TYPES, typeof KEY_VALUES>(
          PARAMS,
          KEY_TYPES,
          {},
          DEFAULT_VALUES
        )
      )
    ).toBe(JSON.stringify(LIST))
  })
  it(`simple inclusions`, async () => {
    const KEY_TYPES: KeyType<KeyTypeConst> = {
      hoge: 'hoge',
      foo: 'foo',
    }
    const INCLUSIONS: Inclusions<KeyTypeConst> = {
      [KEY_TYPES.hoge]: [KEY_TYPES.hoge, KEY_TYPES.foo],
    }
    const PARAMS: KeyTypePatterns<Data>[] = [
      {
        hoge: KEY_TYPES.hoge,
        foo: KEY_TYPES.foo,
      },
    ]

    const KEY_VALUES: KeyTypeValues<KeyValue> = {
      hoge: 1,
      foo: 2,
      // ...REQUIRED_TYPE_VALUES,
    }
    const DEFAULT_VALUES: KeyTypeValueFnc<KeyValue> = () => {
      return KEY_VALUES
    }
    const LIST: KeyValues<KeyTypeValues<KeyValue>>[] = [
      {
        hoge: KEY_VALUES.foo,
        foo: KEY_VALUES.foo,
      },
      {
        hoge: REQUIRED_TYPE_VALUES.__map__,
        foo: KEY_VALUES.foo,
      },
      {
        hoge: REQUIRED_TYPE_VALUES.__list__,
        foo: KEY_VALUES.foo,
      },
      {
        hoge: KEY_VALUES.hoge,
        foo: REQUIRED_TYPE_VALUES.__map__,
      },
      {
        hoge: KEY_VALUES.hoge,
        foo: REQUIRED_TYPE_VALUES.__list__,
      },
    ]
    expect(
      JSON.stringify(
        getRecursiveWrongTypeValues<Data, KeyTypeConst, KeyValue>(PARAMS, KEY_TYPES, INCLUSIONS, DEFAULT_VALUES)
      )
    ).toBe(JSON.stringify(LIST))
  })
})
