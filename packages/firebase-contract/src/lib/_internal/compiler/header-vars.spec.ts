import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { createMemoryLoader } from '../resolver/module-loader.js'

import { generateAll } from './compiler.js'
import { formatDate, resolveDateTokens } from './header-vars.js'

const NOW = new Date(2026, 6, 19, 9, 5, 7) // 2026-07-19 09:05:07 local time

describe('formatDate', () => {
  it('renders the default date format', () => {
    expect(formatDate('yyyy-MM-dd', NOW)).toBe('2026-07-19')
  })

  it('reads lowercase mm as month before an hour token and minute after one', () => {
    expect(formatDate('yyyy-mm-dd HH:mm:ss', NOW)).toBe('2026-07-19 09:05:07')
    expect(formatDate('HH:mm', NOW)).toBe('09:05')
    expect(formatDate('mm/dd/yy', NOW)).toBe('07/19/26')
  })
})

describe('resolveDateTokens', () => {
  const template = '// Generated: ${generatedAt} / Updated: ${updatedAt}\n\nexport const A = 1\n'

  it('stamps both dates for a new file', () => {
    expect(resolveDateTokens(template, undefined, NOW)).toBe(
      '// Generated: 2026-07-19 / Updated: 2026-07-19\n\nexport const A = 1\n'
    )
  })

  it('carries both dates over when the content is unchanged', () => {
    const existing = '// Generated: 2026-01-01 / Updated: 2026-03-03\n\nexport const A = 1\n'
    expect(resolveDateTokens(template, existing, NOW)).toBe(existing)
  })

  it('keeps generatedAt but bumps updatedAt when the content changed', () => {
    const existing = '// Generated: 2026-01-01 / Updated: 2026-03-03\n\nexport const A = 0\n'
    expect(resolveDateTokens(template, existing, NOW)).toBe(
      '// Generated: 2026-01-01 / Updated: 2026-07-19\n\nexport const A = 1\n'
    )
  })

  it('honors a custom format', () => {
    const custom = '// Updated: ${updatedAt:yyyy-mm-dd HH:mm:ss}\nX\n'
    expect(resolveDateTokens(custom, undefined, NOW)).toBe('// Updated: 2026-07-19 09:05:07\nX\n')
  })
})

describe('header path variables', () => {
  const ROOT = `
header: default
generators:
  - { generator: typescript, out: libs/src }
imports:
  - ./svc/contract.yml
`
  const SVC = `
generators:
  - generator: zod
    out: src
    header: "From \${currentContractPath} (root \${rootContractPath})\\nChain: \${allContractPath}"
models:
  Product:
    fields:
      id: { type: int, id: true }
      title: string
`

  it('expands root/current/all contract paths per document', () => {
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': ROOT, '/proj/svc/contract.yml': SVC }),
      now: NOW,
    })
    expect(result.ok).toBe(true)
    const zod = result.targets.flatMap(t => t.files).find(f => f.path === '/proj/svc/src/schemas.ts')
    expect(zod?.content).toContain('// From svc/contract.yml (root contract.yml)')
    expect(zod?.content).toContain('// Chain: contract.yml -> svc/contract.yml')
  })

  it('includes source path and dates in the default banner', () => {
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': ROOT, '/proj/svc/contract.yml': SVC }),
      now: NOW,
    })
    const types = result.targets.flatMap(t => t.files).find(f => f.path === '/proj/libs/src/types.ts')
    expect(types?.content).toContain('// Source: contract.yml')
    expect(types?.content).toContain('// Generated: 2026-07-19 / Updated: 2026-07-19')
  })
})

describe('date stamping across regenerations (fs)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fbc-header-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  const contract = (title: string) => `
header: default
generators:
  - { generator: typescript, out: out }
models:
  Product:
    fields:
      id: { type: int, id: true }
      ${title}: string
`

  it('keeps dates on a no-change regenerate and bumps updatedAt on change', () => {
    const entry = join(dir, 'contract.yml')
    const outFile = join(dir, 'out', 'types.ts')
    writeFileSync(entry, contract('title'), 'utf8')

    generateAll(entry, { write: true, now: new Date(2026, 0, 1) })
    const first = readFileSync(outFile, 'utf8')
    expect(first).toContain('// Generated: 2026-01-01 / Updated: 2026-01-01')

    // no content change → byte-identical output, dates untouched
    generateAll(entry, { write: true, now: new Date(2026, 1, 2) })
    expect(readFileSync(outFile, 'utf8')).toBe(first)

    // contract change → generatedAt kept, updatedAt bumped
    writeFileSync(entry, contract('name'), 'utf8')
    generateAll(entry, { write: true, now: new Date(2026, 2, 3) })
    const third = readFileSync(outFile, 'utf8')
    expect(third).toContain('// Generated: 2026-01-01 / Updated: 2026-03-03')
    expect(third).toContain('name: string')
  })
})
