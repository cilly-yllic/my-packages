import { Command } from 'commander'

import { compile } from '~internal/compiler/compiler.js'
import { formatDiagnostics } from '~internal/format-diagnostics.js'
import { hasErrors } from '~internal/diagnostics.js'
import { loadConfig } from '../config.js'

export const registerInspect = (program: Command): void => {
  program
    .command('inspect')
    .description('Print the normalized IR for a contract (for debugging)')
    .argument('[entry]', 'entry contract file')
    .action((entryArg?: string) => {
      const config = loadConfig()
      const entry = entryArg ?? config.entry ?? 'contract.yml'

      const { ir, diagnostics } = compile(entry)
      if (diagnostics.length > 0) {
        console.error(formatDiagnostics(diagnostics))
        console.error('')
      }
      console.log(JSON.stringify(ir, null, 2))
      if (hasErrors(diagnostics)) {
        process.exit(1)
      }
    })
}
