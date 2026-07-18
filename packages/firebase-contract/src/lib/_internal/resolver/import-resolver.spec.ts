import { describe, expect, it } from 'vitest'

import { createMemoryLoader } from './module-loader.js'
import { resolveImports } from './import-resolver.js'

describe('resolveImports', () => {
  it('loads imported documents before their importer (dependency order)', () => {
    const loader = createMemoryLoader({
      '/proj/contract.yml': 'imports:\n  - ./common.yml\nmodels:\n  Product:\n    fields:\n      name: string\n',
      '/proj/common.yml': 'enums:\n  Status:\n    values: [a]\n',
    })
    const { documents, diagnostics } = resolveImports('/proj/contract.yml', loader)
    expect(diagnostics).toEqual([])
    expect(documents.map(doc => doc.filePath)).toEqual(['/proj/common.yml', '/proj/contract.yml'])
  })

  it('loads a diamond import only once', () => {
    const loader = createMemoryLoader({
      '/p/a.yml': 'imports:\n  - ./b.yml\n  - ./c.yml\n',
      '/p/b.yml': 'imports:\n  - ./d.yml\n',
      '/p/c.yml': 'imports:\n  - ./d.yml\n',
      '/p/d.yml': 'models:\n  D:\n    fields:\n      x: string\n',
    })
    const { documents, diagnostics } = resolveImports('/p/a.yml', loader)
    expect(diagnostics).toEqual([])
    expect(documents.filter(doc => doc.filePath === '/p/d.yml')).toHaveLength(1)
  })

  it('detects circular imports', () => {
    const loader = createMemoryLoader({
      '/p/a.yml': 'imports:\n  - ./b.yml\n',
      '/p/b.yml': 'imports:\n  - ./a.yml\n',
    })
    const { diagnostics } = resolveImports('/p/a.yml', loader)
    expect(diagnostics.some(diagnostic => diagnostic.code === 'IMPORT_CYCLE')).toBe(true)
  })

  it('reports an unresolved import', () => {
    const loader = createMemoryLoader({
      '/p/a.yml': 'imports:\n  - ./missing.yml\n',
    })
    const { diagnostics } = resolveImports('/p/a.yml', loader)
    expect(diagnostics.some(diagnostic => diagnostic.code === 'UNRESOLVED_IMPORT')).toBe(true)
  })
})
