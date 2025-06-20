export const TYPES = {
  firestore: 'firestore',
  storage: 'storage',
} as const

export type Type = (typeof TYPES)[keyof typeof TYPES]

const FIRESTORE_ALIASES = ['firestore', 'f'] as const
type FirestoreAlias = (typeof FIRESTORE_ALIASES)[number]
const STORAGE_ALIASES = ['storage', 's'] as const
type StorageAlias = (typeof STORAGE_ALIASES)[number]

export type TypeAliases = {
  [type in Type]: (FirestoreAlias | StorageAlias)[]
}
export const TYPE_ALIASES: TypeAliases = {
  [TYPES.firestore]: ([] as FirestoreAlias[]).concat(FIRESTORE_ALIASES),
  [TYPES.storage]: ([] as StorageAlias[]).concat(STORAGE_ALIASES),
}

type Alias = FirestoreAlias | StorageAlias
export type AliasTypes = {
  [alias in Alias]: Type
}

export const ALIAS_TYPES = Object.entries(TYPE_ALIASES).reduce((acc, [type, aliases]) => {
  for (const alias of aliases) {
    acc[alias] = type as Type
  }
  return acc
}, {} as AliasTypes)

export type AliasTypesKeys = keyof typeof ALIAS_TYPES

export type Aliases = {
  [alias in Alias]: Alias
}
export const ALIASES: Aliases = Object.values(TYPE_ALIASES).reduce((acc, aliases) => {
  for (const alias of aliases) {
    acc[alias] = alias
  }
  return acc
}, {} as Aliases)
