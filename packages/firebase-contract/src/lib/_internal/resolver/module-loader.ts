import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, resolve } from 'node:path'

import { ContractError, error } from '../diagnostics.js'

/**
 * Abstracts how import specifiers turn into absolute ids and how their content
 * is read. The default implementation hits the file system, but the resolver
 * depends only on this interface so tests can supply in-memory modules and the
 * pipeline stays free of hard file-system coupling.
 */
export interface ModuleLoader {
  /** Resolve `specifier`, as imported from `importer`, to an absolute id. */
  resolveId(specifier: string, importer: string): string
  /** Read the raw text of a module by its absolute id. */
  load(id: string): string
}

const isRelative = (specifier: string): boolean =>
  specifier.startsWith('./') || specifier.startsWith('../') || isAbsolute(specifier)

/**
 * File-system loader. Relative specifiers resolve against the importer's
 * directory; everything else is treated as an npm package specifier and
 * resolved through Node's module resolution (supports subpath exports).
 */
export const createFsLoader = (): ModuleLoader => ({
  resolveId(specifier, importer) {
    if (isRelative(specifier)) {
      return resolve(dirname(importer), specifier)
    }
    try {
      const require = createRequire(importer)
      return require.resolve(specifier)
    } catch {
      throw new ContractError(`Cannot resolve npm import "${specifier}"`, [
        error('UNRESOLVED_IMPORT', `Cannot resolve npm import "${specifier}"`, {
          file: importer,
        }),
      ])
    }
  },
  load(id) {
    if (!existsSync(id)) {
      throw new ContractError(`Module not found: ${id}`, [
        error('MODULE_NOT_FOUND', `Module not found: ${id}`, { file: id }),
      ])
    }
    return readFileSync(id, 'utf8')
  },
})

/**
 * In-memory loader for tests and programmatic use. `files` maps absolute ids to
 * their text content. Relative imports are resolved with the same rules as the
 * FS loader; npm specifiers are looked up directly in the map.
 */
export const createMemoryLoader = (files: Record<string, string>): ModuleLoader => ({
  resolveId(specifier, importer) {
    const id = isRelative(specifier) ? resolve(dirname(importer), specifier) : specifier
    if (!(id in files)) {
      throw new ContractError(`Cannot resolve import "${specifier}"`, [
        error('UNRESOLVED_IMPORT', `Cannot resolve import "${specifier}" from ${importer}`, {
          file: importer,
        }),
      ])
    }
    return id
  },
  load(id) {
    if (!(id in files)) {
      throw new ContractError(`Module not found: ${id}`, [
        error('MODULE_NOT_FOUND', `Module not found: ${id}`, { file: id }),
      ])
    }
    return files[id]
  },
})
