// Public, programmatic API for firebase-contract.
// The CLI (bin: firebase-contract / fbc) is a thin wrapper over `compile`/`generate`.
// All implementation lives under lib/_internal; this barrel re-exports it.

export * from '~internal/compiler/index.js'
export * from '~internal/ir/ir.js'
export * from '~internal/generators/index.js'

export type { Diagnostic, DiagnosticSeverity } from '~internal/diagnostics.js'
export { ContractError, hasErrors } from '~internal/diagnostics.js'

export type { RawContract, RawModel, RawField, RawEnum } from '~internal/parser/raw-document.js'
export { parseContract } from '~internal/parser/parse.js'

export type { ResolveResult } from '~internal/resolver/import-resolver.js'
export { resolveImports } from '~internal/resolver/import-resolver.js'
export type { ModuleLoader } from '~internal/resolver/module-loader.js'
export { createFsLoader, createMemoryLoader } from '~internal/resolver/module-loader.js'

export { validateIr } from '~internal/validation/validate.js'
export type { ValidationRule } from '~internal/validation/rules.js'

export * as runtime from '~internal/runtime/index.js'
