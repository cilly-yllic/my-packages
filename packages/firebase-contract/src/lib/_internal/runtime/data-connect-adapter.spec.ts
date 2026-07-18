import { describe, expect, it } from 'vitest'

import { fromAny, identityAdapter, jsonStringAdapter, toAny } from './data-connect-adapter.js'

interface Meta {
  score: number
}

describe('runtime data-connect adapter', () => {
  it('passes values through fromAny/toAny while retyping', () => {
    const value: Meta = { score: 1 }
    expect(toAny(value)).toBe(value)
    expect(fromAny<Meta>(value)).toBe(value)
  })

  it('identityAdapter round-trips a parsed object', () => {
    const adapter = identityAdapter<Meta>()
    const value: Meta = { score: 2 }
    expect(adapter.fromAny(adapter.toAny(value))).toEqual(value)
  })

  it('jsonStringAdapter serializes and parses raw JSON strings', () => {
    const adapter = jsonStringAdapter<Meta>()
    const stored = adapter.toAny({ score: 3 })
    expect(typeof stored).toBe('string')
    expect(adapter.fromAny(stored)).toEqual({ score: 3 })
    // Tolerates an already-parsed value too.
    expect(adapter.fromAny({ score: 4 })).toEqual({ score: 4 })
  })
})
