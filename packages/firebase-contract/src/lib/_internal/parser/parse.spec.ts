import { describe, expect, it } from 'vitest'

import { ContractError, Diagnostic } from '../diagnostics.js'

import { parseContract } from './parse.js'

describe('parseContract', () => {
  it('parses models, enums, and imports', () => {
    const yaml = `
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
  })

  it('reports unknown keys as UNKNOWN_KEY errors instead of ignoring them', () => {
    const diagnostics: Diagnostic[] = []
    parseContract(
      `
version: 1
models:
  M:
    tabel: ms
    fields:
      name: { type: string, optionnal: true }
`,
      '/p.yml',
      diagnostics
    )
    const found = diagnostics.filter(d => d.code === 'UNKNOWN_KEY')
    expect(found).toHaveLength(3) // version (removed), tabel, optionnal
    expect(found.every(d => d.severity === 'error')).toBe(true)
    expect(found.map(d => d.path)).toEqual(['(root).version', 'models.M.tabel', 'models.M.fields.name.optionnal'])
  })

  it('collects no UNKNOWN_KEY diagnostics for a fully known contract', () => {
    const diagnostics: Diagnostic[] = []
    parseContract(
      `
enums:
  Status:
    values: [{ value: a, key: A, description: d }]
models:
  M:
    gqlName: MM
    fields:
      id: { type: id, id: true }
`,
      '/p.yml',
      diagnostics
    )
    expect(diagnostics).toEqual([])
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
