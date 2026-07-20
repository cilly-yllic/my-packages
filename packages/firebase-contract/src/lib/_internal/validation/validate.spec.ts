import { describe, expect, it } from 'vitest'

import { Ir, IrField, IrModel } from '../ir/ir.js'

import { graphqlNameCollisions } from './rules.js'
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

  describe('nameCollisions', () => {
    const idField = (): IrField => field('id', { type: { kind: 'scalar', name: 'id' }, isId: true })

    it('flags a model and an enum sharing a name', () => {
      const found = codes(
        ir({
          enums: [{ name: 'Status', values: ['a'] }],
          models: [model('Status', [idField()])],
        })
      )
      expect(found).toContain('NAME_COLLISION')
    })

    it('reports a colliding pair only once across namespaces', () => {
      const found = codes(
        ir({
          enums: [{ name: 'Status', values: ['a'] }],
          models: [model('Status', [idField()])],
        })
      ).filter(code => code === 'NAME_COLLISION')
      expect(found).toHaveLength(1)
    })

    it('flags two enums whose const names collide via constantCase', () => {
      const found = codes(
        ir({
          enums: [
            { name: 'TaskStatus', values: ['a'] },
            { name: 'Task_Status', values: ['b'] },
          ],
        })
      )
      expect(found).toContain('NAME_COLLISION')
    })

    it('flags a model colliding with an enum Key companion type', () => {
      const found = codes(
        ir({
          enums: [{ name: 'Status', values: ['a'] }],
          models: [model('StatusKey', [idField()])],
        })
      )
      expect(found).toContain('NAME_COLLISION')
    })

    it('flags an enum colliding with a model zod schema const', () => {
      const found = codes(
        ir({
          enums: [{ name: 'TaskSchema', values: ['a'] }],
          models: [model('Task', [idField()])],
        })
      )
      expect(found).toContain('NAME_COLLISION')
    })

    it('flags gqlName renames colliding in the GraphQL namespace (scoped rule)', () => {
      const collided = graphqlNameCollisions(
        ir({
          models: [
            model('TaskRow', [idField()]),
            { ...model('Task', [idField()]), gqlName: 'TaskRow' },
          ],
        })
      )
      expect(collided.map(d => d.code)).toContain('NAME_COLLISION')
    })

    it('keeps gqlName reuse out of the default rules (namespace is per service)', () => {
      const found = codes(
        ir({
          models: [
            model('TaskRow', [idField()]),
            { ...model('Task', [idField()]), gqlName: 'TaskRow' },
          ],
        })
      )
      expect(found).not.toContain('NAME_COLLISION')
    })

    it('flags fsName renames colliding in the firestore namespace', () => {
      const found = codes(
        ir({
          enums: [
            { name: 'ChatStatus', values: ['a'], fsName: 'Status' },
            { name: 'ReviewStatus', values: ['b'], fsName: 'Status' },
          ],
        })
      )
      expect(found).toContain('NAME_COLLISION')
    })

    it('flags a firestore doc colliding with an embedded model fs name', () => {
      const found = codes(
        ir({
          models: [model('Attachment', [field('url')])], // no id → embedded value object
          firestore: [
            { name: 'Attachment', from: undefined, collection: 'x/{id}', pick: [], omit: [], fields: [field('a')], meta: false },
          ],
        })
      )
      expect(found).toContain('NAME_COLLISION')
    })

    it('flags a union sharing a logical name with a model', () => {
      const found = codes(
        ir({
          models: [model('Draft', [idField(), field('operationType')])],
          unions: [{ name: 'Draft', discriminant: 'operationType', variants: ['Draft'] }],
        })
      )
      expect(found).toContain('NAME_COLLISION')
    })

    it('flags a model claiming the reserved Json type', () => {
      const found = codes(ir({ models: [model('Json', [idField()])] }))
      expect(found).toContain('NAME_COLLISION')
    })

    it('allows the same name across namespaces (fsName renames)', () => {
      const found = codes(
        ir({
          enums: [{ name: 'Status', values: ['a'], fsName: 'ReviewStatus' }],
          models: [model('Review', [idField(), field('status', { type: { kind: 'enum', name: 'Status' } })])],
        })
      )
      expect(found).not.toContain('NAME_COLLISION')
    })

    it('allows a firestore doc named after the table it projects', () => {
      const found = codes(
        ir({
          models: [model('Task', [idField()])],
          firestore: [{ name: 'Task', from: 'Task', collection: 'tasks/{id}', pick: [], omit: [], fields: [], meta: true }],
        })
      )
      expect(found).not.toContain('NAME_COLLISION')
    })
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
