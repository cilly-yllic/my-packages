import { describe, expect, it } from 'vitest'

import { buildIr } from '../ir/build-ir.js'
import { Ir } from '../ir/ir.js'
import { parseContract } from '../parser/parse.js'

import { createIdCodecGenerator } from './id/id-codec-generator.js'
import { createUnionGenerator } from './union/union-generator.js'

const SAMPLE = `
enums:
  OperationType:
    values: [ADD_RELATION, CUT_RELATION]
models:
  User:
    fields:
      id: { type: id, id: true }
  Shop:
    fields:
      id: { type: int, id: true }
  AddLinkOperation:
    fields:
      operationType: OperationType
      parentProductNo: int
      childProductNo: int
  CutLinkOperation:
    fields:
      operationType: OperationType
      parentProductNo: int
      childProductNo: int
unions:
  CatalogOperationDraft:
    discriminant: operationType
    variants: [AddLinkOperation, CutLinkOperation]
`

const irOf = (): Ir => buildIr([parseContract(SAMPLE, '/c.yml')]).ir

describe('G: per-entity id codecs', () => {
  it('emits numeric codec for Int64 ids and string codec for string ids', () => {
    const [file] = createIdCodecGenerator().generate(irOf())
    expect(file.content).toContain("import { encodeNumericId, decodeNumericId, encodeStringId, decodeStringId } from './id-core.js'")
    expect(file.content).toContain('export const encodeShopId = (id: number | string): string => encodeNumericId(String(id))')
    expect(file.content).toContain('export const decodeShopId = (encoded: string): string => decodeNumericId(encoded)')
    expect(file.content).toContain('export const encodeUserId = (id: string): string => encodeStringId(id)')
  })

  it('honors a custom core import', () => {
    const [file] = createIdCodecGenerator({ core: 'my-utils/hashids' }).generate(irOf())
    expect(file.content).toContain("from 'my-utils/hashids'")
  })
})

describe('I: discriminated unions', () => {
  it('emits z.discriminatedUnion + TS union referencing variant schemas/types', () => {
    const [file] = createUnionGenerator().generate(irOf())
    expect(file.content).toContain("import { AddLinkOperationSchema, CutLinkOperationSchema } from './schemas.js'")
    expect(file.content).toContain("import type { AddLinkOperation, CutLinkOperation } from './types.js'")
    expect(file.content).toContain(
      "export const CatalogOperationDraftSchema = z.discriminatedUnion('operationType', [AddLinkOperationSchema, CutLinkOperationSchema])"
    )
    expect(file.content).toContain('export type CatalogOperationDraft = AddLinkOperation | CutLinkOperation')
  })
})
