import { KeyMap } from '~types/utilities.js'

import { isObject } from './types.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const copy = (data: any) => JSON.parse(JSON.stringify(data))

export const hasKey = (pattern: KeyMap, path: string) => {
  if (!isObject(pattern)) {
    return false
  }
  let current = copy(pattern)
  for (const key of path.split('.')) {
    if (!isObject(current)) {
      return false
    }
    if (!(key in (current || {}))) {
      return false
    }
    current = current[key]
  }
  return true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const updateObjProp = (obj: Record<string, any>, value: string, propPath: string) => {
  const [head, ...rest] = propPath.split('.')
  const key = head.replace(/\[\]$/, '')
  const _isArray = head.endsWith('[]')
  if (!rest.length) {
    obj[key] = _isArray ? [value] : value
  } else {
    const _value = _isArray ? obj[key][0] : obj[key]
    updateObjProp(_value, value, rest.join('.'))
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getUnique = (list: any[]) => Array.from(new Map(list.map(data => [JSON.stringify(data), data])).values())
