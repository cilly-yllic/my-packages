import { Inclusions } from '~types/inclusion-types.js'
import { KeyTypePatterns, KeyTypeMap } from '~types/key-type-patterns.js'
import { KeyTypeValueFnc, KeyValue } from '~types/key-type-values.js'
import { KeyType, KeyTypeConst } from '~types/key-type.js'
import { Data } from '~types/utilities.js'
import { convertTypeToValue } from '~utils/convert-type-to-value.js'
import { getAllTheOtherFieldTypes } from '~utils/get-all-the-other-field-types.js'
import { getKeyTypePatterns as _getKeyTypePatterns } from '~utils/get-key-type-patterns.js'
import { updateObjProp, copy, hasKey, getUnique } from '~utils/utilities.js'

export { convertTypeToValue } from '~utils/convert-type-to-value.js'
export { getAllTheOtherFieldTypes } from '~utils/get-all-the-other-field-types.js'

export const getKeyTypePatterns = <D extends Data = Data>(keyTypesList: KeyTypePatterns<D>[]) => {
  const types = keyTypesList.reduce((acc: KeyTypePatterns<D>[], keyTypes) => {
    return acc.concat(_getKeyTypePatterns<D>(keyTypes))
  }, [])

  return getUnique(types)
}

const _getRecursiveWrongTypes = <D extends Data = Data, C extends KeyTypeConst = KeyTypeConst>(
  keyTypes: KeyTypePatterns<D>,
  keyType: KeyType<C>,
  inclusions: Inclusions<C>
) => {
  const patterns = _getKeyTypePatterns<D>(keyTypes) as KeyTypeMap<D>[]
  const types = getAllTheOtherFieldTypes<D, C>(keyTypes, keyType, inclusions)
  const list: KeyTypeMap<D>[] = []
  for (const pattern of patterns) {
    for (const { path, type } of types) {
      if (!hasKey(pattern, path.replace(/\[\]$/, ''))) {
        continue
      }
      const _pattern = copy(pattern)
      updateObjProp(_pattern, type as string, path)
      list.push(_pattern)
    }
  }
  return list.filter(
    (pattern, index) => list.findIndex(_pattern => JSON.stringify(_pattern) === JSON.stringify(pattern)) === index
  )
}

export const getRecursiveWrongTypes = <D extends Data = Data, C extends KeyTypeConst = KeyTypeConst>(
  keyTypesList: KeyTypePatterns<D>[],
  keyType: KeyType<C>,
  inclusions: Inclusions<C>
) => {
  const types = keyTypesList.reduce((acc: KeyTypeMap<D>[], keyTypes) => {
    return acc.concat(_getRecursiveWrongTypes<D, C>(keyTypes, keyType, inclusions))
  }, [])

  return getUnique(types)
}

export const getRecursiveWrongTypeValues = <
  D extends Data = Data,
  C extends KeyTypeConst = KeyTypeConst,
  V extends KeyValue = KeyValue,
>(
  keyTypesList: KeyTypePatterns<D>[],
  keyType: KeyType<C>,
  inclusions: Inclusions<C>,
  keyValueFnc: KeyTypeValueFnc<V>
) => {
  return getRecursiveWrongTypes<D, C>(keyTypesList, keyType, inclusions).map(type =>
    convertTypeToValue<D, V>(type, keyValueFnc)
  )
}

export const getRecursiveRightTypeValues = <D extends Data = Data, V extends KeyValue = KeyValue>(
  keyTypesList: KeyTypePatterns<D>[],
  keyValueFnc: KeyTypeValueFnc<V>
) => {
  const types = getKeyTypePatterns<D>(keyTypesList)
  return types.map(type => convertTypeToValue<D, V>(type, keyValueFnc))
}
