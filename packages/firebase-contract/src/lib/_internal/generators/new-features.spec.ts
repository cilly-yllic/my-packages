import { describe, expect, it } from 'vitest'

import { buildIr } from '../ir/build-ir.js'
import { Ir } from '../ir/ir.js'
import { parseContract } from '../parser/parse.js'

import { createApiTypesGenerator } from './api/api-types-generator.js'
import { createApiValidationGenerator } from './api/api-validation-generator.js'
import { createDataConnectAdapterGenerator } from './data-connect/adapter-generator.js'
import { createDataConnectGraphqlGenerator } from './data-connect/graphql-generator.js'
import { createDataConnectOperationsGenerator } from './data-connect/operations-generator.js'
import { createFirestoreProjectionGenerator } from './firestore/firestore-projection-generator.js'
import { createTypeScriptGenerator } from './typescript/typescript-generator.js'

const SAMPLE = `
enums:
  Status:
    values: [OPEN, DONE]
models:
  User:
    fields:
      id: { type: id, id: true }
      name: string
  Shop:
    fields:
      id: { type: int, id: true }
      name: string
      owner: { type: User, relation: true }
      profile: { type: User, optional: true }
  Product:
    fields:
      id: { type: int, id: true }
      title: string
      status: Status
      shop: { type: Shop, relation: true }
operations:
  CreateProduct:
    type: mutation
    model: Product
    action: insert
    auth: NO_ACCESS
    connectors: [app, api]
    inputs: [title, status, shop]
  ListProductsByShop:
    type: query
    model: Product
    auth: PUBLIC
    authReason: gated by app auth
    where: [shop]
    select: [id, title, status]
tasks:
  createProduct:
    request:
      fields:
        shopId: string
        title: string
    response:
      void: true
apis:
  /products/{product-id}:
    operationId: getProduct
    kind: callable
    request:
      fields:
        id: int
    response:
      model: Product
firestore:
  Product:
    from: Product
    collection: shops/{wsId}/catalogs/{catalogId}/products/{productNo}
    omit: [shop, id]
    fields:
      parentProductNos: { type: int, list: true }
      childProductNos: { type: int, list: true }
      linkedCatalogTitle: { type: string, optional: true }
`

const irOf = (): Ir => buildIr([parseContract(SAMPLE, '/c.yml')]).ir

const contentOf = (files: { path: string; content: string }[], path: string): string => {
  const found = files.find(file => file.path === path)
  if (!found) throw new Error(`missing generated file ${path}`)
  return found.content
}

describe('relation support', () => {
  it('emits a Data Connect relation (not Any) for relation fields', () => {
    const [file] = createDataConnectGraphqlGenerator().generate(irOf())
    expect(file.content).toContain('owner: User!')
    expect(file.content).toContain('shop: Shop!')
    // embedded (non-relation) model field still collapses to Any
    expect(file.content).toContain('profile: Any # logical: User')
  })

  it('exposes the foreign-key id in TypeScript for relations', () => {
    const [file] = createTypeScriptGenerator().generate(irOf())
    expect(file.content).toContain('ownerId: string') // User.id is `id` scalar -> string
    expect(file.content).toContain('shopId: number') // Shop.id is int -> number
  })

  it('passes relation FKs through the adapter without fromAny', () => {
    const [file] = createDataConnectAdapterGenerator().generate(irOf())
    expect(file.content).toContain('ownerId: row.ownerId')
    expect(file.content).not.toContain('fromAny<User>(row.ownerId)')
  })
})

describe('data-connect operations generator', () => {
  it('routes operations per connector and to the root', () => {
    const files = createDataConnectOperationsGenerator().generate(irOf())
    const paths = files.map(f => f.path).sort()
    // CreateProduct -> connectors [app, api]; ListProductsByShop -> root
    expect(paths).toContain('app/operations.gql')
    expect(paths).toContain('api/operations.gql')
    expect(paths).toContain('operations.gql')
    // CreateProduct appears in both app and api, not at the root
    expect(contentOf(files, 'app/operations.gql')).toContain('mutation CreateProduct')
    expect(contentOf(files, 'api/operations.gql')).toContain('mutation CreateProduct')
    expect(contentOf(files, 'operations.gql')).not.toContain('mutation CreateProduct')
    expect(contentOf(files, 'operations.gql')).toContain('query ListProductsByShop')
  })

  it('emits mutation/query .gql with @auth, typed variables, and relation refs', () => {
    const files = createDataConnectOperationsGenerator().generate(irOf())
    const gql = contentOf(files, 'app/operations.gql')
    expect(gql).toContain('mutation CreateProduct(\n  $title: String!\n  $status: Status!\n  $shopId: Int!\n) @auth(level: NO_ACCESS)')
    expect(gql).toContain('product_insert(\n    data: {')
    expect(gql).toContain('shop: { id: $shopId }')
    const rootGql = contentOf(files, 'operations.gql')
    expect(rootGql).toContain('query ListProductsByShop($shopId: Int!)\n@auth(\n  level: PUBLIC\n  insecureReason: "gated by app auth"\n) {')
    expect(rootGql).toContain('products(where: { shop: { id: { eq: $shopId } } })')
  })

  it('emits Variables and Result TS types with a depth-correct types import', () => {
    const files = createDataConnectOperationsGenerator().generate(irOf())
    const appTs = contentOf(files, 'app/operations-types.ts')
    expect(appTs).toContain('export interface CreateProductVariables')
    expect(appTs).toContain('shopId: number')
    const rootTs = contentOf(files, 'operations-types.ts')
    expect(rootTs).toContain('export interface ListProductsByShopResult')
    expect(rootTs).toContain("Pick<Product, 'id' | 'title' | 'status'>[]")
    expect(rootTs).toContain("from './types'")
    // connector files are one directory deeper
    const apiTs = contentOf(files, 'api/operations-types.ts')
    expect(apiTs).toContain("from '../types'")
  })
})

describe('api generators', () => {
  it('emits request/response types (inline, void, and model-backed)', () => {
    const [file] = createApiTypesGenerator().generate(irOf())
    expect(file.content).toContain('export interface CreateProductRequest')
    expect(file.content).toContain('export type CreateProductResponse = void')
    expect(file.content).toContain('export type GetProductResponse = Product')
  })

  it('emits request-validation zod schemas', () => {
    const [file] = createApiValidationGenerator().generate(irOf())
    expect(file.content).toContain("import { z } from 'zod'")
    expect(file.content).toContain('export const CreateProductRequestSchema = z.object({')
    expect(file.content).toContain('shopId: z.string()')
  })
})

describe('firestore projection generator', () => {
  it('derives from the model, resolves relations to ids, dates timestamps, adds _meta_', () => {
    const [file] = createFirestoreProjectionGenerator().generate(irOf())
    expect(file.content).toContain("import { z } from 'zod'")
    expect(file.content).toContain('export const _Meta_Schema = z.object({')
    expect(file.content).toContain('export const ProductSchema = z.object({')
    // kept base fields
    expect(file.content).toContain('title: z.string(),')
    expect(file.content).toContain("status: z.enum(['OPEN', 'DONE']),")
    // omitted the relation + id
    expect(file.content).not.toContain('shopId:')
    // denormalized additions + envelope
    expect(file.content).toContain('parentProductNos: z.array(z.number()),')
    expect(file.content).toContain('linkedCatalogTitle: z.string().nullable(),')
    expect(file.content).toContain('_meta_: _Meta_Schema,')
  })
})
