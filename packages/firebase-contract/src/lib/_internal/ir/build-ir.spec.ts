import { describe, expect, it } from 'vitest'

import { parseContract } from '../parser/parse.js'

import { buildIr } from './build-ir.js'
import { IrTypeRef } from './ir.js'

const refOf = (documents: string, model: string, field: string): IrTypeRef => {
  const { ir } = buildIr([parseContract(documents, '/c.yml')])
  const found = ir.models.find(m => m.name === model)?.fields.find(f => f.name === field)
  if (!found) throw new Error('field not found')
  return found.type
}

describe('buildIr', () => {
  it('resolves scalar, enum, and model references', () => {
    const yaml = `
enums:
  Status:
    values: [a]
models:
  User:
    fields:
      id: { type: id, id: true }
  Product:
    fields:
      status: Status
      owner: User
      title: string
`
    expect(refOf(yaml, 'Product', 'status')).toEqual({ kind: 'enum', name: 'Status' })
    expect(refOf(yaml, 'Product', 'owner')).toEqual({ kind: 'model', name: 'User' })
    expect(refOf(yaml, 'Product', 'title')).toEqual({ kind: 'scalar', name: 'string' })
  })

  it('marks unknown type names as unresolved', () => {
    const yaml = 'models:\n  M:\n    fields:\n      x: Nope\n'
    expect(refOf(yaml, 'M', 'x')).toEqual({ kind: 'unresolved', name: 'Nope' })
  })

  it('carries field modifiers into the IR', () => {
    const yaml = 'models:\n  M:\n    fields:\n      tags: { type: string, list: true, optional: true }\n'
    const { ir } = buildIr([parseContract(yaml, '/c.yml')])
    const field = ir.models[0].fields[0]
    expect(field.list).toBe(true)
    expect(field.optional).toBe(true)
  })

  it('reports duplicate definitions across documents', () => {
    const a = parseContract('models:\n  Product:\n    fields:\n      x: string\n', '/a.yml')
    const b = parseContract('models:\n  Product:\n    fields:\n      y: string\n', '/b.yml')
    const { diagnostics, ir } = buildIr([a, b])
    expect(diagnostics.some(diagnostic => diagnostic.code === 'DUPLICATE_DEFINITION')).toBe(true)
    expect(ir.models).toHaveLength(1)
  })
})
