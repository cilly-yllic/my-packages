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

  describe('value validation', () => {
    const diagnose = (yaml: string): { code: string; severity: string; path?: string }[] =>
      buildIr([parseContract(yaml, '/c.yml')]).diagnostics.map(d => ({ code: d.code, severity: d.severity, path: d.path }))

    const OP = (extra: string): string =>
      `models:\n  M:\n    fields:\n      id: { type: id, id: true }\n      title: string\noperations:\n  Q:\n    type: query\n    model: M\n${extra}`

    it('errors on an invalid auth level (no silent NO_ACCESS fallback)', () => {
      const found = diagnose(OP('    auth: PUBILC\n'))
      expect(found).toContainEqual({ code: 'INVALID_VALUE', severity: 'error', path: 'operations.Q.auth' })
    })

    it('errors on an invalid mutation action', () => {
      const found = diagnose('models:\n  M:\n    fields:\n      id: { type: id, id: true }\noperations:\n  Mut:\n    type: mutation\n    model: M\n    action: insrt\n')
      expect(found.some(d => d.code === 'INVALID_VALUE' && d.path === 'operations.Mut.action')).toBe(true)
    })

    it('errors on an invalid orderBy dir and single kind', () => {
      const found = diagnose(OP('    single: ID\n    orderBy:\n      - { field: title, dir: Dsec }\n'))
      expect(found.some(d => d.code === 'INVALID_VALUE' && d.path === 'operations.Q.single')).toBe(true)
      expect(found.some(d => d.code === 'INVALID_VALUE' && d.path === 'operations.Q.orderBy')).toBe(true)
    })

    it('errors on an invalid style value', () => {
      const found = diagnose(OP('    style: { data: verbose }\n'))
      expect(found.some(d => d.code === 'INVALID_VALUE' && d.path === 'operations.Q.style.data')).toBe(true)
    })

    it('warns (not errors) on an unknown where operator', () => {
      const found = diagnose(OP('    where:\n      - { field: title, op: eqq }\n'))
      expect(found).toContainEqual({ code: 'UNKNOWN_WHERE_OP', severity: 'warning', path: 'operations.Q.where' })
      expect(found.some(d => d.code === 'INVALID_VALUE')).toBe(false)
    })

    it('accepts all valid values without diagnostics', () => {
      const found = diagnose(OP('    auth: PUBLIC\n    authReason: public feed\n    single: id\n    orderBy:\n      - { field: title, dir: DESC }\n    where:\n      - { field: title, op: contains }\n    style: { data: compact, orderBy: bare }\n'))
      expect(found).toEqual([])
    })
  })
})
