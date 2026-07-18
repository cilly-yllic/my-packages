import { Ir } from '../ir/ir.js'

export interface GeneratedFile {
  /** Path relative to the generation output directory. */
  path: string
  content: string
}

export interface GeneratorContext {
  /** Optional banner prepended to each generated file. */
  header?: string
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
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[]
}
