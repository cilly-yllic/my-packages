import { resolve } from 'node:path'

import { ContractError, Diagnostic, error } from '../diagnostics.js'
import { parseContract } from '../parser/parse.js'
import { RawContract } from '../parser/raw-document.js'

import { ModuleLoader } from './module-loader.js'

export interface ResolveResult {
  /**
   * Every document reachable from the entry, in dependency order: an imported
   * document always appears before the document that imports it. This gives the
   * IR builder a deterministic merge order.
   */
  documents: RawContract[]
  diagnostics: Diagnostic[]
}

/**
 * Load the entry contract and everything it imports (transitively), following
 * both relative and npm specifiers via the {@link ModuleLoader}.
 *
 * Detects and reports:
 * - circular imports (`IMPORT_CYCLE`)
 * - unresolved/unreadable modules (`UNRESOLVED_IMPORT`, `MODULE_NOT_FOUND`)
 *
 * Duplicate *definitions* across files are detected later, during IR build,
 * because that is where names from every document are merged.
 */
export const resolveImports = (entryPath: string, loader: ModuleLoader): ResolveResult => {
  const entryId = resolve(entryPath)
  const documents: RawContract[] = []
  const loaded = new Set<string>()
  const visiting = new Set<string>()
  const diagnostics: Diagnostic[] = []

  const collectFrom = (thrown: unknown): void => {
    if (thrown instanceof ContractError && thrown.diagnostics.length > 0) {
      diagnostics.push(...thrown.diagnostics)
    } else {
      const message = thrown instanceof Error ? thrown.message : String(thrown)
      diagnostics.push(error('LOAD_ERROR', message))
    }
  }

  const visit = (id: string, chain: string[]): void => {
    if (visiting.has(id)) {
      const cycle = [...chain.slice(chain.indexOf(id)), id].join(' -> ')
      diagnostics.push(error('IMPORT_CYCLE', `Circular import detected: ${cycle}`, { file: id }))
      return
    }
    if (loaded.has(id)) {
      return
    }

    let content: string
    try {
      content = loader.load(id)
    } catch (thrown) {
      collectFrom(thrown)
      return
    }

    let document: RawContract
    try {
      document = parseContract(content, id)
    } catch (thrown) {
      collectFrom(thrown)
      return
    }

    visiting.add(id)
    for (const specifier of document.imports) {
      let importId: string
      try {
        importId = loader.resolveId(specifier, id)
      } catch (thrown) {
        collectFrom(thrown)
        continue
      }
      visit(importId, [...chain, id])
    }
    visiting.delete(id)

    loaded.add(id)
    documents.push(document)
  }

  visit(entryId, [])

  return { documents, diagnostics }
}
