import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { Diagnostic, error, hasErrors } from '../diagnostics.js'
import { buildIr } from '../ir/build-ir.js'
import { Ir } from '../ir/ir.js'
import { RawApi, RawContract, RawGeneratorDecl, RawGeneratorUse } from '../parser/raw-document.js'
import { resolveImports } from '../resolver/import-resolver.js'
import { createFsLoader, ModuleLoader } from '../resolver/module-loader.js'
import { validateIr } from '../validation/validate.js'
import { createDefaultRegistry } from '../generators/index.js'
import { GeneratedFile, GeneratorContext } from '../generators/generator.js'
import { toHeaderComment } from '../generators/support/header.js'
import { kebabCase } from '../generators/support/naming.js'
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

/** A single generator invocation resolved from the declaration/application DSL. */
interface GeneratorJob {
  source: string
  generatorName: string
  outDir: string
  apiNames?: string[]
}

const OUT_PLACEHOLDER_RE = /\{(api-name|path)\}/

/** `apis:/tasks:/events:` section a raw api belongs to (drives the section defaults lookup). */
const sectionOf = (api: RawApi): 'apis' | 'tasks' | 'events' => {
  if (api.kind === 'task') return 'tasks'
  if (api.kind === 'pubsub') return 'events'
  return 'apis'
}

/** Drop `{param}` segments from a REST path and join the rest (`/ai-models/{id}` → `ai-models`). */
const pathSegments = (apiPath: string): string =>
  apiPath
    .split('/')
    .filter(segment => segment.length > 0 && !(segment.startsWith('{') && segment.endsWith('}')))
    .join('/')

const expandOutTemplate = (
  template: string,
  api: { name: string; path?: string } | undefined,
  diagnostics: Diagnostic[],
  source: string
): string | undefined => {
  if (!OUT_PLACEHOLDER_RE.test(template)) return template
  if (!api) {
    diagnostics.push(
      error('INVALID_OUT_TEMPLATE', `"${template}" uses api placeholders but the generator is document-scoped (${source})`)
    )
    return undefined
  }
  let out = template.replaceAll('{api-name}', kebabCase(api.name))
  if (out.includes('{path}')) {
    if (!api.path) {
      diagnostics.push(
        error('INVALID_OUT_TEMPLATE', `"${template}" uses {path} but api "${api.name}" has no REST path (${source})`)
      )
      return undefined
    }
    out = out.replaceAll('{path}', pathSegments(api.path))
  }
  return out
}

/**
 * Resolve an out template to an absolute directory. `#alias/...` prefixes are
 * matched against the root document's `project.aliases` (longest prefix wins)
 * and resolve relative to the root yml; everything else resolves relative to
 * the declaring yml — same as the legacy `generate:` form.
 */
const resolveOutDir = (
  out: string,
  declaringDoc: RawContract,
  rootDoc: RawContract,
  diagnostics: Diagnostic[]
): string | undefined => {
  if (!out.startsWith('#')) {
    return join(dirname(declaringDoc.filePath), out)
  }
  const aliases = rootDoc.project?.aliases ?? {}
  const candidates = Object.entries(aliases)
    .map(([pattern, target]) => ({ prefix: pattern.endsWith('/*') ? pattern.slice(0, -2) : pattern, pattern, target }))
    .filter(({ prefix }) => out === prefix || out.startsWith(`${prefix}/`))
    .sort((a, b) => b.prefix.length - a.prefix.length)
  const match = candidates[0]
  if (!match) {
    diagnostics.push(
      error('UNKNOWN_ALIAS', `No project.aliases entry matches "${out}" (declare it in the root contract)`)
    )
    return undefined
  }
  const rest = out.slice(match.prefix.length).replace(/^\//, '')
  const targetBase = match.target.endsWith('/*') ? match.target.slice(0, -2) : match.target
  return join(dirname(rootDoc.filePath), targetBase, rest)
}

/** Find a generator declaration by name — nearest first: the declaring yml, then the root yml. */
const findGeneratorDecl = (name: string, doc: RawContract, rootDoc: RawContract): RawGeneratorDecl | undefined =>
  doc.generatorDecls?.find(decl => decl.generator === name) ??
  rootDoc.generatorDecls?.find(decl => decl.generator === name)

/**
 * Build generator jobs from the declaration/application DSL:
 * - api-scoped generators run for entries that opt in (section `defaults` →
 *   entry `generators:`, entry wins; no file-level tier by design)
 * - document-scoped generators run once per yml that declares them
 */
const buildGeneratorJobs = (
  doc: RawContract,
  rootDoc: RawContract,
  registry: GeneratorRegistry,
  diagnostics: Diagnostic[]
): GeneratorJob[] => {
  const jobs: GeneratorJob[] = []
  const grouped = new Map<string, GeneratorJob>()

  for (const [apiName, rawApi] of Object.entries(doc.apis)) {
    const uses: RawGeneratorUse[] | undefined = rawApi.generators ?? doc.sectionDefaults?.[sectionOf(rawApi)]
    for (const use of uses ?? []) {
      const decl = findGeneratorDecl(use.generator, doc, rootDoc)
      const template = use.out ?? decl?.out
      if (template === undefined) {
        diagnostics.push(
          error(
            'UNKNOWN_GENERATOR_DECL',
            `Api "${apiName}" applies generator "${use.generator}" but no declaration with an "out" was found (${doc.filePath})`
          )
        )
        continue
      }
      const api = { name: apiName, ...(rawApi.path !== undefined ? { path: rawApi.path } : {}) }
      const expanded = expandOutTemplate(template, api, diagnostics, doc.filePath)
      if (expanded === undefined) continue
      const outDir = resolveOutDir(expanded, doc, rootDoc, diagnostics)
      if (outDir === undefined) continue
      const key = `${use.generator}\u0000${outDir}`
      const existing = grouped.get(key)
      if (existing) {
        existing.apiNames?.push(apiName)
      } else {
        const job: GeneratorJob = { source: doc.filePath, generatorName: use.generator, outDir, apiNames: [apiName] }
        grouped.set(key, job)
        jobs.push(job)
      }
    }
  }

  for (const decl of doc.generatorDecls ?? []) {
    const generator = registry.get(decl.generator)
    if (!generator) {
      diagnostics.push(error('UNKNOWN_GENERATOR', `Unknown generator "${decl.generator}" (${doc.filePath})`))
      continue
    }
    if ((generator.scope ?? 'document') === 'api') continue // applied via entries, not by declaration
    const expanded = expandOutTemplate(decl.out, undefined, diagnostics, doc.filePath)
    if (expanded === undefined) continue
    const outDir = resolveOutDir(expanded, doc, rootDoc, diagnostics)
    if (outDir === undefined) continue
    jobs.push({ source: doc.filePath, generatorName: decl.generator, outDir })
  }

  return jobs
}

/**
 * Run every generator declared across the entry contract and its (transitive)
 * imports — the one-command flow: each contract file declares its generators
 * (`generators:` + section defaults / entry applications) and
 * `fbc generate <root>` materializes all of them. Output dirs resolve relative
 * to the declaring yml (or the root yml for `#alias/...` templates).
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
  const registry = options.registry ?? createDefaultRegistry()
  // Import order puts dependencies first, so the entry (root) document is last.
  const rootDoc = documents[documents.length - 1]
  const mergeDiagnostics = (incoming: Diagnostic[]): void => {
    // Per-target compiles revisit shared imports; keep only new diagnostics.
    for (const diagnostic of incoming) {
      if (!collected.some(d => d.code === diagnostic.code && d.message === diagnostic.message)) {
        collected.push(diagnostic)
      }
    }
  }
  const runTarget = (doc: RawContract, outDir: string, generators: string[], apiNames?: string[]): void => {
    const result = generate(doc.filePath, {
      outDir,
      generators,
      registry,
      write: options.write,
      context: { ...options.context, ...(apiNames ? { apiNames } : {}) },
      ...(options.loader ? { loader: options.loader } : {}),
    })
    mergeDiagnostics(result.diagnostics)
    if (!result.ok) ok = false
    targets.push({ source: doc.filePath, outDir, generators, files: result.files })
  }
  for (const doc of documents) {
    // Declaration/application DSL (`generators:` + section defaults / entry `generators:`).
    const jobDiagnostics: Diagnostic[] = []
    for (const job of buildGeneratorJobs(doc, rootDoc, registry, jobDiagnostics)) {
      runTarget(doc, job.outDir, [job.generatorName], job.apiNames)
    }
    mergeDiagnostics(jobDiagnostics)
    if (hasErrors(jobDiagnostics)) ok = false
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
