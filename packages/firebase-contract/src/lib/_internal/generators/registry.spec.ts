import { describe, expect, it } from 'vitest'

import { Generator } from './generator.js'
import { GeneratorRegistry } from './registry.js'

const stub = (name: string): Generator => ({ name, generate: () => [] })

describe('GeneratorRegistry', () => {
  it('registers, looks up, and lists generators', () => {
    const registry = new GeneratorRegistry().register(stub('a')).register(stub('b'))
    expect(registry.has('a')).toBe(true)
    expect(registry.get('b')?.name).toBe('b')
    expect(registry.names()).toEqual(['a', 'b'])
    expect(registry.list()).toHaveLength(2)
  })

  it('returns undefined for an unknown generator', () => {
    expect(new GeneratorRegistry().get('nope')).toBeUndefined()
  })

  it('lets a later registration override an earlier one', () => {
    const first = stub('x')
    const second = stub('x')
    const registry = new GeneratorRegistry().register(first).register(second)
    expect(registry.get('x')).toBe(second)
    expect(registry.names()).toEqual(['x'])
  })
})
