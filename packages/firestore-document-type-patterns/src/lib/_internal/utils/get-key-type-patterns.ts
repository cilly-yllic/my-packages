// import { DocumentType } from '../types/firestore-field-types.js'
import { KeyTypePatterns, Type } from '~types/key-type-patterns.js'
import { Data } from '~types/utilities.js'

import { isArray, isObject } from './types.js'

const removeListSuffix = (str: string) => str.replace(/\[\]$/, '')

const getObject = (key: string, type: KeyTypePatterns | string) => ({
  [removeListSuffix(key)]: key.endsWith('[]') ? [type] : type,
})

// export const getKeyTypePatterns = <T extends KeyTypePatterns = DocumentType>(keyTypes: T | T[] | Type): T[] => {
export const getKeyTypePatterns = <D extends Data = Data>(
  keyTypes: KeyTypePatterns<D> | KeyTypePatterns<D>[] | Type<D>
): KeyTypePatterns<D>[] => {
  let typePatterns: KeyTypePatterns<D>[] = []
  if (isArray(keyTypes)) {
    for (const keyType of keyTypes as KeyTypePatterns<D>[]) {
      for (const pattern of getKeyTypePatterns(keyType)) {
        typePatterns.push(pattern)
      }
    }
    return typePatterns
  }
  if (isObject(keyTypes)) {
    for (const [key, type] of Object.entries(keyTypes as KeyTypePatterns)) {
      const patterns = []
      for (const _fieldType of getKeyTypePatterns(type as KeyTypePatterns)) {
        patterns.push(_fieldType)
      }
      if (!typePatterns.length) {
        for (const pattern of patterns) {
          typePatterns.push(getObject(key, pattern) as KeyTypePatterns<D>)
        }
      } else {
        const mergedTypePatterns: KeyTypePatterns<D>[] = []
        for (const typePattern of typePatterns) {
          for (const pattern of patterns) {
            mergedTypePatterns.push({
              ...(typePattern as KeyTypePatterns<D>),
              ...getObject(key, pattern),
            })
          }
        }
        typePatterns = mergedTypePatterns
      }
    }
    return typePatterns
  }
  return [keyTypes as KeyTypePatterns<D>]
}
