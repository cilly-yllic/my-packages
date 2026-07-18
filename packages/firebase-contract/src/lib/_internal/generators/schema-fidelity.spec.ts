import { describe, expect, it } from 'vitest'

import { buildIr } from '../ir/build-ir.js'
import { Ir } from '../ir/ir.js'
import { parseContract } from '../parser/parse.js'

import { createDataConnectGraphqlGenerator } from './data-connect/graphql-generator.js'

const SAMPLE = `
enums:
  ProductStatus:
    values: [OPEN, DONE]
models:
  Shop:
    fields:
      id: { type: int, id: true }
      slug: { type: string, unique: true }
      seq: { type: int, default: 0 }
  Catalog:
    fields:
      id: { type: int, id: true }
      catalogNo: int
  Product:
    key: [catalog, productNo]
    indexes:
      - { fields: [status, productNo] }
      - { fields: [catalog, productNo], unique: true }
    fields:
      catalog: { type: Catalog, relation: true }
      productNo: int
      status: ProductStatus
`

const irOf = (): Ir => buildIr([parseContract(SAMPLE, '/c.yml')]).ir

describe('C: DC schema fidelity', () => {
  const gql = (): string => createDataConnectGraphqlGenerator().generate(irOf())[0].content

  it('emits @table with derived snake_case plural name and single key', () => {
    expect(gql()).toContain('type Shop @table(name: "shops", key: ["id"]) {')
  })

  it('emits @col(bigserial) on Int64 primary keys', () => {
    expect(gql()).toContain('id: Int! @col(dataType: "bigserial")')
  })

  it('emits @unique and @default(expr) on fields', () => {
    const content = gql()
    expect(content).toContain('slug: String! @unique')
    expect(content).toContain('seq: Int! @default(expr: "0")')
  })

  it('emits composite key and type-level @index/@unique', () => {
    const content = gql()
    expect(content).toContain('type Product @table(name: "products", key: ["catalog", "productNo"])')
    expect(content).toContain('@index(fields: ["status", "productNo"], name: "products_status_productNo_idx")')
    expect(content).toContain('@unique(fields: ["catalog", "productNo"], indexName: "products_catalog_productNo_uidx")')
  })
})
