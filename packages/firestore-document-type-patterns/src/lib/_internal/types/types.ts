export const REQUIRED_TYPES = {
  map: '__map__',
  list: '__list__',
} as const

export type RequiredTypes = (typeof REQUIRED_TYPES)[keyof typeof REQUIRED_TYPES]

export const REQUIRED_TYPE_VALUES = {
  [REQUIRED_TYPES.map]: {},
  [REQUIRED_TYPES.list]: [],
} as const

export type RequiredTypeValues = (typeof REQUIRED_TYPE_VALUES)[keyof typeof REQUIRED_TYPE_VALUES]

export type RequiredKeyValue = {
  [key in keyof typeof REQUIRED_TYPE_VALUES]: RequiredTypeValues
}
