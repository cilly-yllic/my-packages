import { describe, expect, it } from 'vitest'

import { buildIr } from '../ir/build-ir.js'
import { Ir } from '../ir/ir.js'
import { parseContract } from '../parser/parse.js'

import { createDataConnectOperationsGenerator } from './data-connect/operations-generator.js'

const SAMPLE = `
enums:
  ProductStatus:
    values: [OPEN, DONE]
models:
  Product:
    fields:
      id: { type: int, id: true }
      title: string
      status: ProductStatus
      createdAt: timestamp
      score: int
  UsageLog:
    fields:
      id: { type: int, id: true }
      shopId: int
      weightedAmount: float
      inputTokens: int
      occurredAt: timestamp
operations:
  SearchProducts:
    type: query
    model: Product
    where:
      - { field: title, op: contains }
      - status
    orderBy:
      - { field: createdAt, dir: DESC }
    limit: 20
    select: [id, title, status]
  GetUsageTotals:
    type: query
    model: UsageLog
    where:
      - { field: shopId, op: eq }
    aggregate:
      count: true
      sum: [weightedAmount, inputTokens]
  TouchProduct:
    type: mutation
    model: Product
    action: update
    exprs:
      updatedAt: request.time
    inc: [score]
`

const irOf = (): Ir => buildIr([parseContract(SAMPLE, '/c.yml')]).ir
const contentOf = (path: string): string => {
  const file = createDataConnectOperationsGenerator()
    .generate(irOf())
    .find(f => f.path === path)
  if (!file) throw new Error(`missing ${path}`)
  return file.content
}
const gql = (): string => contentOf('operations.gql')
const types = (): string => contentOf('operations-types.ts')

describe('D: DC operations richness', () => {
  it('emits where operators, orderBy, and limit', () => {
    const content = gql()
    expect(content).toContain('title: { contains: $title }')
    expect(content).toContain('status: { eq: $status }')
    expect(content).toContain('orderBy: [{ createdAt: DESC }]')
    expect(content).toContain('limit: 20')
  })

  it('emits aggregate selections and result type', () => {
    expect(gql()).toContain('_count')
    expect(gql()).toContain('weightedAmount_sum')
    expect(types()).toContain('_count: number')
    expect(types()).toContain('weightedAmount_sum: number | null')
  })

  it('emits mutation expr and increment operators', () => {
    const content = gql()
    expect(content).toContain('updatedAt_expr: "request.time"')
    expect(content).toContain('score_update: { inc: 1 }')
  })
})
