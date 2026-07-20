import { Command } from 'commander'

import { compile } from '~internal/compiler/compiler.js'
import { hasErrors } from '~internal/diagnostics.js'
import { formatDiagnostics } from '~internal/format-diagnostics.js'
import { Ir } from '~internal/ir/ir.js'
import { loadConfig } from '../config.js'

interface Definition {
  kind: string
  name: string
  sourceFile?: string
  yamlPath: string
  /** Extra name mappings worth surfacing (gqlName / fsName / table). */
  renames: string[]
}

const definitionsOf = (ir: Ir): Definition[] => [
  ...ir.models.map(m => ({
    kind: 'model',
    name: m.name,
    sourceFile: m.sourceFile,
    yamlPath: `models.${m.name}`,
    renames: [
      ...(m.gqlName ? [`gqlName: ${m.gqlName}`] : []),
      ...(m.fsName ? [`fsName: ${m.fsName}`] : []),
      ...(m.table ? [`table: ${m.table}`] : []),
    ],
  })),
  ...ir.enums.map(e => ({
    kind: 'enum',
    name: e.name,
    sourceFile: e.sourceFile,
    yamlPath: `enums.${e.name}`,
    renames: [...(e.gqlName ? [`gqlName: ${e.gqlName}`] : []), ...(e.fsName ? [`fsName: ${e.fsName}`] : [])],
  })),
  ...ir.unions.map(u => ({ kind: 'union', name: u.name, sourceFile: u.sourceFile, yamlPath: `unions.${u.name}`, renames: [] })),
  ...ir.firestore.map(d => ({ kind: 'firestore doc', name: d.name, sourceFile: d.sourceFile, yamlPath: `firestore.${d.name}`, renames: [] })),
  ...ir.envelopes.map(e => ({ kind: 'envelope', name: e.name, sourceFile: e.sourceFile, yamlPath: `envelopes.${e.name}`, renames: [] })),
  ...ir.apis.map(a => ({ kind: 'api', name: a.name, sourceFile: a.sourceFile, yamlPath: `apis.${a.name}`, renames: [] })),
  ...ir.operations.map(o => ({ kind: 'operation', name: o.name, sourceFile: o.sourceFile, yamlPath: `operations.${o.name}`, renames: [] })),
]

/** True when the definition is known by `query` under any of its names. */
const matches = (definition: Definition, query: string): boolean =>
  definition.name === query || definition.renames.some(rename => rename.endsWith(`: ${query}`))

export const registerWhere = (program: Command): void => {
  program
    .command('where')
    .description('Locate the yml that defines a type (matches logical, gqlName, fsName, and table names)')
    .argument('<name>', 'type name to look up')
    .argument('[entry]', 'entry contract file')
    .action((name: string, entryArg?: string) => {
      const config = loadConfig()
      const entry = entryArg ?? config.entry ?? 'contract.yml'

      const { ir, diagnostics } = compile(entry)
      if (hasErrors(diagnostics)) {
        console.error(formatDiagnostics(diagnostics))
        process.exit(1)
      }

      const found = definitionsOf(ir).filter(definition => matches(definition, name))
      if (found.length === 0) {
        console.error(`"${name}" is not defined in ${entry} or its imports`)
        process.exit(1)
      }
      for (const definition of found) {
        const location = definition.sourceFile ?? '(unknown file)'
        const renames = definition.renames.length > 0 ? `  [${definition.renames.join(', ')}]` : ''
        console.log(`${definition.kind} ${definition.name}  ${location}  (${definition.yamlPath})${renames}`)
      }
    })
}
