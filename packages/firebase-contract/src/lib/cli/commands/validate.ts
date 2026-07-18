import { Command } from 'commander'

import { compile } from '~internal/compiler/compiler.js'
import { countBySeverity, formatDiagnostics } from '~internal/format-diagnostics.js'
import { loadConfig } from '../config.js'

export const registerValidate = (program: Command): void => {
  program
    .command('validate')
    .description('Parse, resolve imports, and semantically validate a contract')
    .argument('[entry]', 'entry contract file')
    .action((entryArg?: string) => {
      const config = loadConfig()
      const entry = entryArg ?? config.entry ?? 'contract.yml'

      const { diagnostics } = compile(entry)
      if (diagnostics.length > 0) {
        console.log(formatDiagnostics(diagnostics))
      }
      const { errors, warnings } = countBySeverity(diagnostics)
      if (errors > 0) {
        console.error(`\n✖ ${errors} error(s), ${warnings} warning(s)`)
        process.exit(1)
      }
      console.log(`✔ ${entry} is valid${warnings > 0 ? ` (${warnings} warning(s))` : ''}`)
    })
}
