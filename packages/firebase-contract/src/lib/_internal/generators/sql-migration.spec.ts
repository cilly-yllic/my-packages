import { describe, expect, it } from 'vitest'

import { buildIr } from '../ir/build-ir.js'
import { Ir } from '../ir/ir.js'
import { parseContract } from '../parser/parse.js'

import { createSqlMigrationGenerator } from './sql/sql-migration-generator.js'

const SAMPLE = `
models:
  Product:
    key: [catalog, productNo]
    fields:
      productNo: int
  ProductLink:
    key: [catalog, parentProductNo, childProductNo]
    sql:
      checks:
        - "parent_product_no != child_product_no"
      foreignKeys:
        - { columns: [catalog_id, parent_product_no], references: "products(catalog_id, product_no)" }
        - { columns: [catalog_id, child_product_no], references: "products(catalog_id, product_no)" }
      indexes:
        - { columns: [catalog_id, child_product_no] }
    fields:
      parentProductNo: int
      childProductNo: int
`

const irOf = (): Ir => buildIr([parseContract(SAMPLE, '/c.yml')]).ir

describe('E: SQL migration generator', () => {
  it('emits ALTER TABLE / CREATE INDEX for composite FK, CHECK, and indexes', () => {
    const files = createSqlMigrationGenerator().generate(irOf())
    expect(files).toHaveLength(1)
    const [file] = files
    expect(file.path).toBe('migrations/constraints.sql')
    expect(file.content).toContain(
      'ALTER TABLE "product_links" ADD CONSTRAINT "product_links_chk_1" CHECK (parent_product_no != child_product_no);'
    )
    expect(file.content).toContain(
      'ALTER TABLE "product_links" ADD CONSTRAINT "product_links_catalog_id_parent_product_no_fkey" FOREIGN KEY ("catalog_id", "parent_product_no") REFERENCES products(catalog_id, product_no);'
    )
    expect(file.content).toContain('CREATE INDEX "product_links_catalog_id_child_product_no_idx" ON "product_links" ("catalog_id", "child_product_no");')
  })

  it('emits nothing when no model declares sql constraints', () => {
    const ir = buildIr([parseContract('models:\n  M:\n    fields:\n      x: string\n', '/c.yml')]).ir
    expect(createSqlMigrationGenerator().generate(ir)).toEqual([])
  })
})
