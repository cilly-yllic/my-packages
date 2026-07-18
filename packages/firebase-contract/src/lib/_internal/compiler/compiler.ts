import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { Diagnostic, error, hasErrors } from '../diagnostics.js'
import { buildIr } from '../ir/build-ir.js'
import { Ir } from '../ir/ir.js'
import { RawContract } from '../parser/raw-document.js'
import { resolveImports } from '../resolver/import-resolver.js'
import { createFsLoader, ModuleLoader } from '../resolver/module-loader.js'
import { validateIr } from '../validation/validate.js'
import { createDefaultRegistry } from '../generators/index.js'
import { GeneratedFile, GeneratorContext } from '../generators/generator.js'
import { toHeaderComment } from '../generators/support/header.js'
import { GeneratorRegistry } from '../generators/registry.js'

export interface CompileOptions {
  /** Override module loading (defaults to the file system). */
  loader?: ModuleLoader
}

export interface CompileResult {
  ir: Ir
  documents: RawContract[]
  diagnostics: Diagnostic[]
}

/**
 * Run the front end of the pipeline: resolve imports, build the IR, and run
 * semantic validation. Generators are intentionally not involved here — the CLI
 * and {@link generate} depend on this, keeping analysis and code emission
 * separable and independently testable.
 */
export const compile = (entryPath: string, options: CompileOptions = {}): CompileResult => {
  const loader = options.loader ?? createFsLoader()
  const { documents, diagnostics: importDiagnostics } = resolveImports(entryPath, loader)
  const { ir, diagnostics: buildDiagnostics } = buildIr(documents)
  const validationDiagnostics = validateIr(ir)
  return {
    ir,
    documents,
    diagnostics: [...importDiagnostics, ...buildDiagnostics, ...validationDiagnostics],
  }
}

export interface GenerateOptions extends CompileOptions {
  outDir: string
  /** Generator names to run; defaults to every generator in the registry. */
  generators?: string[]
  /** Registry to resolve generators from; defaults to the built-ins. */
  registry?: GeneratorRegistry
  /** When true, write the generated files to disk. */
  write?: boolean
  context?: GeneratorContext
}

export interface GenerateTargetResult {
  /** The contract file that declared this target. */
  source: string
  outDir: string
  generators: string[]
  files: GeneratedFile[]
}

export interface GenerateAllResult {
  targets: GenerateTargetResult[]
  diagnostics: Diagnostic[]
  ok: boolean
}

/**
 * Run every `generate:` target declared across the entry contract and its
 * (transitive) imports — the one-command flow: each contract file states where
 * its own outputs go, and `fbc generate <root>` materializes all of them.
 * Output dirs resolve relative to the declaring yml file.
 */
export const generateAll = (
  entryPath: string,
  options: { registry?: GeneratorRegistry; write?: boolean; context?: GeneratorContext; loader?: ModuleLoader } = {}
): GenerateAllResult => {
  const { documents, diagnostics } = compile(entryPath, options)
  if (hasErrors(diagnostics)) {
    return { targets: [], diagnostics, ok: false }
  }
  const collected = [...diagnostics]
  const targets: GenerateTargetResult[] = []
  let ok = true
  for (const doc of documents) {
    for (const output of doc.outputs ?? []) {
      const outDir = join(dirname(doc.filePath), output.out)
      const result = generate(doc.filePath, {
        outDir,
        generators: output.generators,
        registry: options.registry,
        write: options.write,
        ...(options.context ? { context: options.context } : {}),
        ...(options.loader ? { loader: options.loader } : {}),
      })
      // Per-target compiles revisit shared imports; keep only new diagnostics.
      for (const diagnostic of result.diagnostics) {
        if (!collected.some(d => d.code === diagnostic.code && d.message === diagnostic.message)) {
          collected.push(diagnostic)
        }
      }
      if (!result.ok) ok = false
      targets.push({ source: doc.filePath, outDir, generators: output.generators, files: result.files })
    }
  }
  return { targets, diagnostics: collected, ok }
}

export interface FileDrift {
  /** Files whose on-disk content differs from the generated content. */
  changed: string[]
  /** Files that generation produces but do not exist on disk yet. */
  missing: string[]
}

/**
 * Compare generated files against what is currently on disk — the dry-run
 * behind `fbc generate --check`, catching "the contract changed but the
 * committed outputs were not regenerated" drift without touching the tree.
 */
export const diffFiles = (files: GeneratedFile[]): FileDrift => {
  const drift: FileDrift = { changed: [], missing: [] }
  for (const file of files) {
    if (!existsSync(file.path)) {
      drift.missing.push(file.path)
    } else if (readFileSync(file.path, 'utf8') !== file.content) {
      drift.changed.push(file.path)
    }
  }
  return drift
}

export interface GenerateResult {
  ir: Ir
  diagnostics: Diagnostic[]
  /** Output files with paths resolved under `outDir`. Empty when there are errors. */
  files: GeneratedFile[]
  /** True when no error-level diagnostics were produced. */
  ok: boolean
}

/**
 * Compile then emit code. Generation is skipped when compilation produced any
 * error, so generators never see an invalid IR. The CLI is a thin wrapper over
 * this function.
 */
export const generate = (entryPath: string, options: GenerateOptions): GenerateResult => {
  const registry = options.registry ?? createDefaultRegistry()
  const { ir, diagnostics } = compile(entryPath, options)
  const collected: Diagnostic[] = [...diagnostics]

  if (hasErrors(collected)) {
    return { ir, diagnostics: collected, files: [], ok: false }
  }

  const names = options.generators && options.generators.length > 0 ? options.generators : registry.names()
  // CLI/options header wins; otherwise fall back to the contract's `header:`.
  const context: GeneratorContext = { ...options.context }
  if (context.header === undefined && ir.header !== undefined) {
    context.header = toHeaderComment(ir.header)
  }
  const files: GeneratedFile[] = []
  for (const name of names) {
    const generator = registry.get(name)
    if (!generator) {
      collected.push(error('UNKNOWN_GENERATOR', `Unknown generator "${name}"`))
      continue
    }
    for (const file of generator.generate(ir, context)) {
      files.push({ path: join(options.outDir, file.path), content: file.content })
    }
  }

  if (hasErrors(collected)) {
    return { ir, diagnostics: collected, files: [], ok: false }
  }

  if (options.write) {
    for (const file of files) {
      mkdirSync(dirname(file.path), { recursive: true })
      writeFileSync(file.path, file.content, 'utf8')
    }
  }

  return { ir, diagnostics: collected, files, ok: true }
}
