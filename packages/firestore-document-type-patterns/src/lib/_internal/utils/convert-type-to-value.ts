import { KeyTypePatterns, Type as KeyTypeType } from '~types/key-type-patterns.js'
import { KeyTypeValueFnc, KeyValue, KeyValues, Value as KeyTypeValueValue } from '~types/key-type-values.js'
import { REQUIRED_TYPE_VALUES, RequiredTypes } from '~types/types.js'
import { Data } from '~types/utilities.js'

import { isArray, isObject } from './types.js'

const convertRequiredValue = (type: string) => {
  return REQUIRED_TYPE_VALUES[type as RequiredTypes] || type
}

const getTypeValue = <T extends KeyValue = KeyValue>(
  keyValueFnc: KeyTypeValueFnc<T>,
  type: keyof T,
  depth = 0,
  isInArray = false
) => {
  const val = keyValueFnc(depth, isInArray)[type as keyof T]
  if (!val) {
    // for null, undefined string
    return `${val}` === type ? val : convertRequiredValue(type as string)
  }
  return val
}

export const convertTypeToValue = <D extends Data = Data, V extends KeyValue = KeyValue>(
  keyTypes: KeyTypePatterns<D>,
  keyValueFnc: KeyTypeValueFnc<V>,
  depth = 0,
  isInArray = false
): KeyValues<V> => {
  const keyValues: KeyValues<V> = {}
  let res!: KeyTypeValueValue<V>[keyof KeyTypeValueValue<V>]
  for (const [key, types] of Object.entries(keyTypes)) {
    if (isObject(types)) {
      res = convertTypeToValue<D, V>(types as D, keyValueFnc, depth, isInArray)
    } else if (isArray(types)) {
      const type = (types as KeyTypePatterns[])[0] as KeyTypeType
      res = [
        isObject(type)
          ? convertTypeToValue<D, V>(type as D, keyValueFnc, depth + 1, true)
          : getTypeValue<V>(keyValueFnc, type as keyof V, depth, true),
      ]
    } else {
      res = getTypeValue<V>(keyValueFnc, types as keyof V, depth, isInArray)
    }
    keyValues[key] = res
  }
  return keyValues
}
