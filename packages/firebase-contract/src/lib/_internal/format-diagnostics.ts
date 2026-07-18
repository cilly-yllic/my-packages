import { Diagnostic } from './diagnostics.js'

export const formatDiagnostic = (diagnostic: Diagnostic): string => {
  const location = [diagnostic.file, diagnostic.path].filter(Boolean).join(' ')
  const suffix = location ? ` (${location})` : ''
  return `${diagnostic.severity} [${diagnostic.code}] ${diagnostic.message}${suffix}`
}

export const formatDiagnostics = (diagnostics: Diagnostic[]): string =>
  diagnostics.map(diagnostic => formatDiagnostic(diagnostic)).join('\n')

export const countBySeverity = (diagnostics: Diagnostic[]): { errors: number; warnings: number } => ({
  errors: diagnostics.filter(diagnostic => diagnostic.severity === 'error').length,
  warnings: diagnostics.filter(diagnostic => diagnostic.severity === 'warning').length,
})
