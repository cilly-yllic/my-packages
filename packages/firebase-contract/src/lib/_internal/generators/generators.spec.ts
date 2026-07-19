import { describe, expect, it } from 'vitest'

import { buildIr } from '../ir/build-ir.js'
import { Ir } from '../ir/ir.js'
import { parseContract } from '../parser/parse.js'

import { createDataConnectAdapterGenerator } from './data-connect/adapter-generator.js'
import { createDataConnectGraphqlGenerator } from './data-connect/graphql-generator.js'
import { createFirestoreTypeGenerator } from './firestore/firestore-type-generator.js'
import { createTypeScriptGenerator } from './typescript/typescript-generator.js'
import { createZodGenerator } from './zod/zod-generator.js'
import { createDefaultRegistry } from './index.js'

const SAMPLE = `
enums:
  Status:
    values: [todo, in_progress, done]
models:
  User:
    fields:
      id: { type: id, id: true }
      name: string
  Product:
    fields:
      id: { type: id, id: true }
      status: Status
      tags: { type: string, list: true }
      owner: { type: User, optional: true }
      metadata: { type: json, optional: true }
      createdAt: timestamp
`

const sampleIr = (): Ir => buildIr([parseContract(SAMPLE, '/c.yml')]).ir

describe('typescript generator', () => {
  it('emits interfaces, const enums (Key + value types), and the Json type', () => {
    const [file] = createTypeScriptGenerator().generate(sampleIr())
    expect(file.path).toBe('types.ts')
    expect(file.content).toContain('export const STATUS = Object.freeze({')
    expect(file.content).toContain("  IN_PROGRESS: 'in_progress',")
    expect(file.content).toContain('export type StatusKey = keyof typeof STATUS')
    expect(file.content).toContain('export type Status = (typeof STATUS)[StatusKey]')
    expect(file.content).toContain('export interface Product {')
    expect(file.content).toContain('tags: string[]')
    expect(file.content).toContain('owner?: User')
    expect(file.content).toContain('metadata?: Json')
  })

  it('can emit plain string-literal unions when enumStyle is union', () => {
    const [file] = createTypeScriptGenerator({ enumStyle: 'union' }).generate(sampleIr())
    expect(file.content).toContain("export type Status = 'todo' | 'in_progress' | 'done'")
  })
})

describe('zod generator', () => {
  it('emits z.enum, lazy model refs, and optional/array modifiers', () => {
    const [file] = createZodGenerator().generate(sampleIr())
    expect(file.content).toContain("import { z } from 'zod'")
    expect(file.content).toContain("export const StatusSchema = z.enum(['todo', 'in_progress', 'done'])")
    expect(file.content).toContain('z.lazy(() => UserSchema).optional()')
    expect(file.content).toContain('tags: z.array(z.string())')
  })
})

describe('data-connect graphql generator', () => {
  it('maps json and embedded models to Any and preserves the logical type', () => {
    const [file] = createDataConnectGraphqlGenerator().generate(sampleIr())
    expect(file.path).toBe('schema.gql')
    expect(file.content).toContain('type Product @table(name: "products", key: ["id"]) {')
    expect(file.content).toContain('scalar Any')
    expect(file.content).toContain('owner: Any # logical: User')
    expect(file.content).toContain('IN_PROGRESS')
    expect(file.content).toContain('createdAt: Timestamp!')
  })
})

describe('data-connect adapter generator', () => {
  it('restores logical types via fromAny/toAny', () => {
    const [file] = createDataConnectAdapterGenerator().generate(sampleIr())
    expect(file.content).toContain("import { fromAny, toAny, type Any } from 'firebase-contract/runtime'")
    expect(file.content).toContain('fromAny<User>(row.owner)')
    expect(file.content).toContain('toAny(value.owner)')
    expect(file.content).toContain('owner?: Any')
  })
})

describe('firestore type generator', () => {
  it('maps timestamps to the Firestore Timestamp and adds WithId', () => {
    const [file] = createFirestoreTypeGenerator().generate(sampleIr())
    expect(file.content).toContain("import { Timestamp } from 'firebase/firestore'")
    expect(file.content).toContain('export type WithId<T> = T & { id: string }')
    expect(file.content).toContain('createdAt: Timestamp')
  })

  it('honors a custom timestamp import', () => {
    const [file] = createFirestoreTypeGenerator({ timestampImport: 'firebase-admin/firestore' }).generate(sampleIr())
    expect(file.content).toContain("import { Timestamp } from 'firebase-admin/firestore'")
  })
})

describe('default registry', () => {
  it('registers all built-in generators in priority order', () => {
    // 分割レイアウトは別 id ではなく各 generator の split: true で選択する
    expect(createDefaultRegistry().names()).toEqual([
      'typescript',
      'zod',
      'data-connect-graphql',
      'data-connect-operations',
      'data-connect-adapter',
      'firestore-types',
      'firestore',
      'api-types',
      'api-validation',
      'api-dto',
      'task-payloads',
      'sql-migrations',
      'id-codecs',
      'unions',
      'config',
    ])
  })
})
