import { getRecursiveRightTypeValues } from '~internal/index.js'
import { KeyTypeValueFnc } from '~types/key-type-values.js'

describe(__filename, () => {
  it(`simple string`, async () => {
    const PARAMS = [
      {
        hoge: 'hoge',
        piyo: ['hoge', 'foo'],
      },
    ]

    const KEY_VALUES = {
      hoge: 1,
      foo: 2,
    }
    const DEFAULT_VALUES: KeyTypeValueFnc<typeof KEY_VALUES> = () => {
      return KEY_VALUES
    }
    const LIST = [
      { hoge: KEY_VALUES.hoge, piyo: KEY_VALUES.hoge },
      { hoge: KEY_VALUES.hoge, piyo: KEY_VALUES.foo },
    ]
    expect(
      JSON.stringify(getRecursiveRightTypeValues<(typeof PARAMS)[0], typeof KEY_VALUES>(PARAMS, DEFAULT_VALUES))
    ).toBe(JSON.stringify(LIST))
  })
})
