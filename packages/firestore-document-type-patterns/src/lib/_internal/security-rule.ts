import { DocumentData } from 'firebase/firestore'

import { Firestore, DocumentType, PRIMITIVE_FIELD_TYPES, INCLUSIONS } from '~types/firestore-field-types.js'
import { Inclusions } from '~types/inclusion-types.js'
import { KeyValue, KeyValues, KeyTypeValueFnc } from '~types/key-type-values.js'
import { KeyType } from '~types/key-type.js'
import { TYPE_VALUES } from '~utils/firestore-type-values.js'

import {
  getKeyTypePatterns as _getKeyTypePatterns,
  convertTypeToValue as _convertTypeToValue,
  getRecursiveWrongTypes as _getRecursiveWrongTypes,
  getRecursiveWrongTypeValues as _getRecursiveWrongTypeValues,
  getRecursiveRightTypeValues as _getRecursiveRightTypeValues,
} from './index.js'

type KeyTypeConst = typeof PRIMITIVE_FIELD_TYPES

export const getRecursiveWrongTypes = <D extends DocumentData = DocumentData, C extends KeyTypeConst = KeyTypeConst>(
  keyTypes: DocumentType<D>[]
) => _getRecursiveWrongTypes<D, C>(keyTypes, PRIMITIVE_FIELD_TYPES as KeyType<C>, INCLUSIONS as Inclusions<C>)
export const getKeyTypePatterns = <D extends DocumentData = DocumentData>(documentTypes: DocumentType<D>[]) =>
  _getKeyTypePatterns<D>(documentTypes)
export const convertTypeToValue = <D extends DocumentData = DocumentData, V extends KeyValue = KeyValue>(
  pattern: DocumentType<D>,
  db: Firestore
) => _convertTypeToValue<D, V>(pattern, TYPE_VALUES(db) as KeyTypeValueFnc<V>)

export const getRecursiveWrongTypeValues = <
  D extends DocumentData = DocumentData,
  C extends KeyTypeConst = KeyTypeConst,
  V extends KeyValue = KeyValue,
>(
  keyTypes: DocumentType<D>[],
  db: Firestore
): KeyValues<V>[] =>
  _getRecursiveWrongTypeValues<D, C, V>(
    keyTypes,
    PRIMITIVE_FIELD_TYPES as KeyType<C>,
    INCLUSIONS as Inclusions<C>,
    TYPE_VALUES(db) as KeyTypeValueFnc<V>
  )

export const getRecursiveRightTypeValues = <D extends DocumentData = DocumentData, V extends KeyValue = KeyValue>(
  documentTypes: DocumentType<D>[],
  db: Firestore
): KeyValues<V>[] => {
  return _getRecursiveRightTypeValues<D, V>(documentTypes, TYPE_VALUES(db) as KeyTypeValueFnc<V>)
}
