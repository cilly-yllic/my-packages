export type DiagnosticSeverity = 'error' | 'warning'

/**
 * A single problem found while compiling a contract. Diagnostics are collected
 * across the pipeline (import resolution, IR build, semantic validation) rather
 * than thrown, so the CLI can report every issue at once.
 */
export interface Diagnostic {
  severity: DiagnosticSeverity
  /** Stable machine-readable identifier, e.g. `UNRESOLVED_TYPE`. */
  code: string
  message: string
  /** Absolute path of the source file the problem originates from. */
  file?: string
  /** Logical location inside the contract, e.g. `models.User.fields.id`. */
  path?: string
}

export const error = (code: string, message: string, extra: Partial<Diagnostic> = {}): Diagnostic => ({
  severity: 'error',
  code,
  message,
  ...extra,
})

export const warning = (code: string, message: string, extra: Partial<Diagnostic> = {}): Diagnostic => ({
  severity: 'warning',
  code,
  message,
  ...extra,
})

export const hasErrors = (diagnostics: Diagnostic[]): boolean =>
  diagnostics.some(diagnostic => diagnostic.severity === 'error')

/**
 * Thrown for unrecoverable problems (e.g. a YAML syntax error) where producing
 * a partial result is not meaningful. Recoverable, semantic problems are
 * reported as {@link Diagnostic}s instead.
 */
export class ContractError extends Error {
  readonly diagnostics: Diagnostic[]

  constructor(message: string, diagnostics: Diagnostic[] = []) {
    super(message)
    this.name = 'ContractError'
    this.diagnostics = diagnostics
  }
}
