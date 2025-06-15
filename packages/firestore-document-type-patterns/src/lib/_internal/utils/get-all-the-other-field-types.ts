import { Inclusions } from '~types/inclusion-types.js'
import { KeyTypePatterns, Type as KeyTypePatternsType } from '~types/key-type-patterns.js'
import { KeyTypeConst, KeyType, Type } from '~types/key-type.js'
import { PathType } from '~types/path-type.js'
import { REQUIRED_TYPES } from '~types/types.js'
import { Data } from '~types/utilities.js'

import { getLeftTypes } from './get-left-types.js'
import { isObject, isArray } from './types.js'

const addTypes = <C extends KeyTypeConst = KeyTypeConst>(pathTypes: PathType<C>[], adds: PathType<C>[]) => {
  for (const pathType of adds) {
    pathTypes.push(pathType)
  }
}

const addLeftTypes = <C extends KeyTypeConst = KeyTypeConst>(
  pathTypes: PathType<C>[],
  types: Type<C>[],
  keyValues: KeyType<C>,
  inclusions: Inclusions<C>,
  path: string
) => {
  for (const type of getLeftTypes<KeyType<C>>(types, keyValues, inclusions)) {
    pathTypes.push({
      path,
      type,
    })
  }
}

const getTypeKinds = <D extends Data = Data, C extends KeyTypeConst = KeyTypeConst>(
  types: KeyTypePatternsType<D>[]
) => {
  const primitiveTypes: PathType<C>['type'][] = []
  const objectTypes: KeyTypePatterns<D>[] = []
  for (const type of types) {
    if (isObject(type)) {
      objectTypes.push(type as KeyTypePatterns<D>)
    } else {
      primitiveTypes.push(type as PathType<C>['type'])
    }
  }
  return {
    primitiveTypes,
    objectTypes,
  }
}

const addKeyTypes = <D extends Data = Data, C extends KeyTypeConst = KeyTypeConst>(
  pathTypes: PathType<C>[],
  key: string,
  types: KeyTypePatternsType<D>[],
  keyType: KeyType<C>,
  inclusions: Inclusions<C>,
  path: string
) => {
  const { primitiveTypes, objectTypes } = getTypeKinds<D, C>(types)
  if (objectTypes.length) {
    primitiveTypes.push(REQUIRED_TYPES.map)
  }
  if (key.endsWith('[]')) {
    primitiveTypes.push(REQUIRED_TYPES.list)
    addLeftTypes<C>(pathTypes, [REQUIRED_TYPES.list] as Type<C>[], keyType, inclusions, path.replace(/\[\]$/, ''))
  }
  addLeftTypes<C>(pathTypes, primitiveTypes as Type<C>[], keyType, inclusions, path)
  for (const objectType of objectTypes) {
    addTypes<C>(pathTypes, _getAllTheOtherFieldTypes<D, C>(objectType, keyType, inclusions, path))
  }
}

const _getAllTheOtherFieldTypes = <D extends Data = Data, C extends KeyTypeConst = KeyTypeConst>(
  keyTypes: KeyTypePatterns<D>,
  keyType: KeyType<C>,
  inclusions: Inclusions<C>,
  path = ''
): PathType<C>[] => {
  const pathTypes: PathType<C>[] = []
  for (const [key, _types] of Object.entries(keyTypes)) {
    const currentPath = `${path}.${key}`.replace(/^\./, '')
    const types = (isArray(_types) ? _types : [_types]) as KeyTypePatternsType<D>[]
    addKeyTypes<D, C>(pathTypes, key, types, keyType, inclusions, currentPath)
  }
  return pathTypes
}

export const getAllTheOtherFieldTypes = <D extends Data = Data, C extends KeyTypeConst = KeyTypeConst>(
  keyTypes: KeyTypePatterns<D>,
  keyType: KeyType<C>,
  inclusions: Inclusions<C>,
  path = ''
): PathType<C>[] => {
  return _getAllTheOtherFieldTypes<D, C>(keyTypes, { ...keyType, ...REQUIRED_TYPES }, inclusions, path)
}
