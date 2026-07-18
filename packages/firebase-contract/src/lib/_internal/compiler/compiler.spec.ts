import { describe, expect, it } from 'vitest'

import { createMemoryLoader } from '../resolver/module-loader.js'

import { compile, generate } from './compiler.js'

const CONTRACT = `
imports:
  - ./common.yml
models:
  Product:
    fields:
      id: { type: id, id: true }
      status: Status
      title: string
`
const COMMON = `
enums:
  Status:
    values: [open, closed]
`

const loaderOf = (files: Record<string, string>) => createMemoryLoader(files)

describe('compile', () => {
  it('resolves imports and produces a clean IR', () => {
    const { ir, diagnostics } = compile('/proj/contract.yml', {
      loader: loaderOf({ '/proj/contract.yml': CONTRACT, '/proj/common.yml': COMMON }),
    })
    expect(diagnostics).toEqual([])
    expect(ir.enums.map(e => e.name)).toEqual(['Status'])
    expect(ir.models.map(m => m.name)).toEqual(['Product'])
    const status = ir.models[0].fields.find(f => f.name === 'status')
    expect(status?.type).toEqual({ kind: 'enum', name: 'Status' })
  })

  it('surfaces validation errors for unknown types', () => {
    const { diagnostics } = compile('/c.yml', {
      loader: loaderOf({ '/c.yml': 'models:\n  M:\n    fields:\n      x: Nope\n' }),
    })
    expect(diagnostics.some(d => d.code === 'UNRESOLVED_TYPE')).toBe(true)
  })
})

describe('generate', () => {
  it('runs selected generators and returns output files', () => {
    const result = generate('/proj/contract.yml', {
      loader: loaderOf({ '/proj/contract.yml': CONTRACT, '/proj/common.yml': COMMON }),
      outDir: 'out',
      generators: ['typescript', 'zod'],
    })
    expect(result.ok).toBe(true)
    expect(result.files.map(f => f.path)).toEqual(['out/types.ts', 'out/schemas.ts'])
  })

  it('does not generate when compilation has errors', () => {
    const result = generate('/c.yml', {
      loader: loaderOf({ '/c.yml': 'models:\n  M:\n    fields:\n      x: Nope\n' }),
      outDir: 'out',
    })
    expect(result.ok).toBe(false)
    expect(result.files).toEqual([])
  })

  it('reports an unknown generator name', () => {
    const result = generate('/proj/contract.yml', {
      loader: loaderOf({ '/proj/contract.yml': CONTRACT, '/proj/common.yml': COMMON }),
      outDir: 'out',
      generators: ['nope'],
    })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some(d => d.code === 'UNKNOWN_GENERATOR')).toBe(true)
  })
})

describe('diffFiles', () => {
  it('classifies missing, changed, and matching files', async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { diffFiles } = await import('./compiler.js')
    const dir = mkdtempSync(join(tmpdir(), 'fbc-diff-'))
    try {
      writeFileSync(join(dir, 'same.ts'), 'a\n')
      writeFileSync(join(dir, 'stale.ts'), 'old\n')
      const drift = diffFiles([
        { path: join(dir, 'same.ts'), content: 'a\n' },
        { path: join(dir, 'stale.ts'), content: 'new\n' },
        { path: join(dir, 'new.ts'), content: 'x\n' },
      ])
      expect(drift.changed).toEqual([join(dir, 'stale.ts')])
      expect(drift.missing).toEqual([join(dir, 'new.ts')])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
