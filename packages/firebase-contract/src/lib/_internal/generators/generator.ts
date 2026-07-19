import { Ir } from '../ir/ir.js'

export interface GeneratedFile {
  /** Path relative to the generation output directory. */
  path: string
  content: string
}

export interface GeneratorContext {
  /** Optional banner prepended to each generated file. */
  header?: string
  /**
   * Api-scoped generation: restrict output to these api names. `undefined`
   * keeps the legacy behavior (all apis in the IR). Set by the compiler when
   * entries opt into a generator via section defaults / entry `generators:`.
   */
  apiNames?: string[]
  /**
   * Resolved output settings (declaration → entry override → generator
   * default). Generators fall back to their own `defaultOutput` when absent
   * (e.g. direct programmatic `generate()` calls).
   */
  output?: GeneratorOutputSettings
}

/** How an api-scoped generator materializes files — all declarable in YAML. */
export interface GeneratorOutputSettings {
  /** File name template; `{api-name}` / `{path}` allowed when `split` is true. */
  file?: string
  /** true: one file per api. false: one bundled file per job. */
  split?: boolean
  /** Free-form generator-specific tweaks (e.g. api-types `typesImport`). */
  options?: Record<string, string>
}

/**
 * A code generator turns the IR into one or more output files. Implementations
 * MUST depend only on the IR — never on YAML, raw documents, other generators,
 * or shared mutable state. That independence is what lets generators be added,
 * removed, or run in isolation.
 */
export interface Generator {
  /** Unique key used to select the generator from the CLI/registry. */
  readonly name: string
  readonly description?: string
  /**
   * `api`: output follows per-entry applications (section defaults → entry).
   * `document` (default): declaring the generator in a yml's `generators:`
   * block runs it once for that yml.
   */
  readonly scope?: 'api' | 'document'
  /** Built-in output defaults (api-scoped generators); overridable per declaration. */
  readonly defaultOutput?: { file: string; split: boolean }
  /** Document scope: true when `split: true` switches to a per-item file layout. */
  readonly splittable?: boolean
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[]
}

/** Narrow `ir.apis` to the compiler-selected subset (no-op without a filter). */
export const selectApis = <T extends { name: string }>(apis: T[], context?: GeneratorContext): T[] => {
  if (!context?.apiNames) return apis
  const allowed = new Set(context.apiNames)
  return apis.filter(api => allowed.has(api.name))
}
