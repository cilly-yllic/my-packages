import { describe, expect, it } from 'vitest'

import { buildIr } from '../ir/build-ir.js'
import { GeneratorContext } from './generator.js'
import { parseContract } from '../parser/parse.js'

import { createFirestoreProjectionGenerator } from './firestore/firestore-projection-generator.js'
import { createTypeScriptGenerator } from './typescript/typescript-generator.js'
import { createZodGenerator } from './zod/zod-generator.js'

// Shared `_meta_`-style envelope declared as a placement-pinned value object,
// spliced into projections via `extends`. Mirrors how a consumer replaces the
// former hardcoded `_meta_` with contract-owned declarations.
const CONTRACT = `
models:
  MetaOp:
    out: firestore/_
    file: _meta_.ts
    fields:
      id: { type: string, description: op id }
  Meta:
    description: consistency envelope
    out: firestore/_
    file: _meta_.ts
    fields:
      scope: { type: float, nullable: true }
      op: { type: MetaOp, nullable: true }
  Shop:
    fields:
      id: { type: id, id: true }
      name: string
fragments:
  meta:
    fields:
      _meta_: { type: Meta }
firestore:
  Shop:
    from: Shop
    collection: shops/{shopId}
    extends: [meta]
`

const filesOf = (): { path: string; content: string }[] => {
  const { ir } = buildIr([parseContract(CONTRACT, '/c.yml')])
  const context: GeneratorContext = { output: { split: true } }
  return createFirestoreProjectionGenerator().generate(ir, context)
}

const contentOf = (files: { path: string; content: string }[], path: string): string =>
  files.find(f => f.path === path)?.content ?? ''

describe('fragments + pinned value objects (split firestore)', () => {
  it('emits pinned value objects at their `out`, dependency-ordered, with an index barrel', () => {
    const files = filesOf()
    const meta = contentOf(files, 'firestore/_/_meta_.ts')
    // Referenced value object comes before its referrer (same file).
    expect(meta.indexOf('MetaOpSchema')).toBeLessThan(meta.indexOf('export const MetaSchema'))
    expect(meta).toContain('export const MetaSchema = z.object({')
    expect(meta).toContain('op: MetaOpSchema.nullable(),')
    // Pinned files carry no AUTO-GENERATED banner and start with the zod import.
    expect(meta.startsWith("import { z } from 'zod'")).toBe(true)
    expect(contentOf(files, 'firestore/_/index.ts')).toBe("export * from './_meta_'\n")
  })

  it('splices the fragment field into the doc and imports the pinned schema by dir', () => {
    const files = filesOf()
    const shop = contentOf(files, 'firestore/shops.ts')
    expect(shop).toContain("import { MetaSchema } from './_'")
    expect(shop).toContain('_meta_: MetaSchema,')
  })

  it('keeps pinned value objects out of the barrel doc list but re-exports their dir', () => {
    const barrel = contentOf(filesOf(), 'firestore.ts')
    expect(barrel).toContain("export * from './firestore/shops'")
    expect(barrel).toContain("export * from './firestore/_'")
  })

  it('excludes pinned value objects from the typescript and zod outputs', () => {
    const { ir } = buildIr([parseContract(CONTRACT, '/c.yml')])
    const ts = createTypeScriptGenerator().generate(ir)[0].content
    const zod = createZodGenerator().generate(ir)[0].content
    expect(ts).not.toContain('Meta')
    expect(ts).toContain('export interface Shop')
    expect(zod).not.toContain('MetaSchema')
    expect(zod).toContain('export const ShopSchema')
  })
})
