import { describe, expect, it } from 'vitest'

import { ContractError } from '../diagnostics.js'

import { parseContract } from './parse.js'

describe('parseContract', () => {
  it('parses models, enums, imports, and version', () => {
    const yaml = `
version: 2
imports:
  - ./common.yml
enums:
  Status:
    description: state
    values: [a, b]
models:
  Product:
    description: a product
    fields:
      id: { type: id, id: true }
      title: string
`
    const contract = parseContract(yaml, '/proj/contract.yml')
    expect(contract.version).toBe(2)
    expect(contract.imports).toEqual(['./common.yml'])
    expect(contract.enums.Status.values).toEqual(['a', 'b'])
    expect(contract.models.Product.description).toBe('a product')
    expect(contract.models.Product.fields.id).toEqual({ type: 'id', id: true })
  })

  it('expands the shorthand `field: type` form', () => {
    const contract = parseContract('models:\n  M:\n    fields:\n      name: string\n', '/p.yml')
    expect(contract.models.M.fields.name).toEqual({ type: 'string' })
  })

  it('treats an empty document as an empty contract', () => {
    const contract = parseContract('', '/p.yml')
    expect(contract.models).toEqual({})
    expect(contract.enums).toEqual({})
    expect(contract.version).toBe(1)
  })

  it('throws when a field has no type', () => {
    expect(() => parseContract('models:\n  M:\n    fields:\n      x: { optional: true }\n', '/p.yml')).toThrow(
      ContractError
    )
  })

  it('throws when the root is not a mapping', () => {
    expect(() => parseContract('- 1\n- 2\n', '/p.yml')).toThrow(ContractError)
  })

  it('throws on invalid YAML syntax', () => {
    expect(() => parseContract('key: [unclosed', '/p.yml')).toThrow(ContractError)
  })
})
