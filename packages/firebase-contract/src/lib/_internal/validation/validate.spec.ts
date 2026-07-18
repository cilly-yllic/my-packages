import { describe, expect, it } from 'vitest'

import { Ir, IrField, IrModel } from '../ir/ir.js'

import { validateIr } from './validate.js'

const field = (name: string, overrides: Partial<IrField> = {}): IrField => ({
  name,
  type: { kind: 'scalar', name: 'string' },
  constraints: {},
  optional: false,
  list: false,
  isId: false,
  unique: false,
  relation: false,
  ...overrides,
})

const ir = (partial: Partial<Ir>): Ir => ({
  version: 1,
  enums: [],
  models: [],
  operations: [],
  apis: [],
  firestore: [],
  unions: [],
  envelopes: [],
  ...partial,
})

const model = (name: string, fields: IrField[]): IrModel => ({ name, fields, key: [], indexes: [] })

const codes = (value: Ir): string[] => validateIr(value).map(diagnostic => diagnostic.code)

describe('validateIr', () => {
  it('flags unresolved field types', () => {
    expect(codes(ir({ models: [model('Product', [field('x', { type: { kind: 'unresolved', name: 'Nope' } })])] }))).toContain(
      'UNRESOLVED_TYPE'
    )
  })

  it('flags empty enums', () => {
    expect(codes(ir({ enums: [{ name: 'E', values: [] }] }))).toContain('EMPTY_ENUM')
  })

  it('flags multiple id fields on one model', () => {
    const found = codes(
      ir({
        models: [
          model('M', [
            field('a', { type: { kind: 'scalar', name: 'id' }, isId: true }),
            field('b', { type: { kind: 'scalar', name: 'id' }, isId: true }),
          ]),
        ],
      })
    )
    expect(found).toContain('MULTIPLE_IDS')
  })

  it('warns on optional id and duplicate enum values', () => {
    const found = codes(
      ir({
        enums: [{ name: 'E', values: ['x', 'x'] }],
        models: [model('M', [field('id', { type: { kind: 'scalar', name: 'id' }, isId: true, optional: true })])],
      })
    )
    expect(found).toContain('OPTIONAL_ID')
    expect(found).toContain('DUPLICATE_ENUM_VALUE')
  })

  it('flags invalid identifiers', () => {
    expect(codes(ir({ enums: [{ name: 'has space', values: ['a'] }] }))).toContain('INVALID_NAME')
  })

  it('flags a relation on a non-model field', () => {
    expect(codes(ir({ models: [model('M', [field('x', { relation: true })])] }))).toContain('INVALID_RELATION')
  })

  it('accepts a relation on a model field', () => {
    const found = codes(
      ir({
        models: [
          model('User', [field('id', { type: { kind: 'scalar', name: 'id' }, isId: true })]),
          model('M', [field('owner', { type: { kind: 'model', name: 'User' }, relation: true })]),
        ],
      })
    )
    expect(found).not.toContain('INVALID_RELATION')
  })

  it('validates operations against their model and fields', () => {
    const base = {
      models: [
        model('Product', [
          field('id', { type: { kind: 'scalar', name: 'id' }, isId: true }),
          field('title'),
        ]),
      ],
    }
    expect(codes(ir({ ...base, operations: [{ name: 'X', operationType: 'mutation', model: 'Nope', auth: 'NO_ACCESS', inputs: [], where: [], select: [], orderBy: [], exprs: [], inc: [], connectors: [] }] }))).toContain('UNKNOWN_OPERATION_MODEL')
    expect(codes(ir({ ...base, operations: [{ name: 'X', operationType: 'mutation', model: 'Product', action: 'insert', auth: 'NO_ACCESS', inputs: [{ field: 'nope' }], where: [], select: [], orderBy: [], exprs: [], inc: [], connectors: [] }] }))).toContain('UNKNOWN_OPERATION_FIELD')
    expect(codes(ir({ ...base, operations: [{ name: 'X', operationType: 'mutation', model: 'Product', auth: 'NO_ACCESS', inputs: [{ field: 'title' }], where: [], select: [], orderBy: [], exprs: [], inc: [], connectors: [] }] }))).toContain('MISSING_MUTATION_ACTION')
  })

  it('validates api payload model references', () => {
    expect(
      codes(
        ir({
          apis: [
            {
              name: 'doThing',
              kind: 'callable',
              request: { model: 'Ghost', fields: [], isVoid: false },
              response: { fields: [], isVoid: true },
            },
          ],
        })
      )
    ).toContain('UNKNOWN_API_MODEL')
  })

  it('returns no diagnostics for a clean IR', () => {
    expect(
      validateIr(
        ir({
          enums: [{ name: 'Status', values: ['a', 'b'] }],
          models: [
            model('Product', [
              field('id', { type: { kind: 'scalar', name: 'id' }, isId: true }),
              field('status', { type: { kind: 'enum', name: 'Status' } }),
            ]),
          ],
        })
      )
    ).toEqual([])
  })
})
