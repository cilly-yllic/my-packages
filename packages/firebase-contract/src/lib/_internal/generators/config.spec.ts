import { describe, expect, it } from 'vitest'

import { buildIr } from '../ir/build-ir.js'
import { Ir } from '../ir/ir.js'
import { parseContract } from '../parser/parse.js'

import { createConfigGenerator } from './config/config-generator.js'

const SAMPLE = `
project:
  services:
    - name: shop
      database: shop
      connectors: [app, api, admin]
    - name: warehouse
      database: warehouse
      connectors: [app, api]
  codebases:
    shp: shop
    whs: warehouse
`

const irOf = (): Ir => buildIr([parseContract(SAMPLE, '/c.yml')]).ir

describe('H: config + sync constants', () => {
  const files = (): { path: string; content: string }[] => createConfigGenerator().generate(irOf())
  const contentOf = (path: string): string => {
    const found = files().find(f => f.path === path)
    if (!found) throw new Error(`missing ${path}`)
    return found.content
  }

  it('emits per-service dataconnect.yaml and per-connector connector.yaml', () => {
    const paths = files().map(f => f.path)
    expect(paths).toContain('shop/dataconnect.yaml')
    expect(paths).toContain('shop/connectors/admin/connector.yaml')
    expect(paths).toContain('warehouse/connectors/api/connector.yaml')
    expect(contentOf('shop/dataconnect.yaml')).toContain('serviceId: shop')
    expect(contentOf('shop/dataconnect.yaml')).toContain("connectorDirs: ['./connectors/app', './connectors/api', './connectors/admin']")
    expect(contentOf('warehouse/connectors/api/connector.yaml')).toContain(
      "package: '@dataconnect/warehouse-generated-api'"
    )
  })

  it('emits the sync constants (FIRESTORE_DATABASES + API_CODEBASES)', () => {
    const c = contentOf('constants.ts')
    expect(c).toContain('export const FIRESTORE_DATABASES = Object.freeze({')
    expect(c).toContain("  SHOP: 'shop',")
    expect(c).toContain("  WAREHOUSE: 'warehouse',")
    expect(c).toContain('export const API_CODEBASES = Object.freeze({')
    expect(c).toContain("  SHOP: 'shp',")
    expect(c).toContain("  WAREHOUSE: 'whs',")
  })

  it('emits nothing without a project section', () => {
    const ir = buildIr([parseContract('models:\n  M:\n    fields:\n      x: string\n', '/c.yml')]).ir
    expect(createConfigGenerator().generate(ir)).toEqual([])
  })
})
