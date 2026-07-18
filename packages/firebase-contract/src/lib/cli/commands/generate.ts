import { Command } from 'commander'

import { generate, generateAll } from '~internal/compiler/compiler.js'
import { DEFAULT_HEADER, toHeaderComment } from '~internal/generators/support/header.js'
import { countBySeverity, formatDiagnostics } from '~internal/format-diagnostics.js'
import { createDefaultRegistry } from '~internal/generators/index.js'
import { loadConfig } from '../config.js'

interface GenerateFlags {
  outDir?: string
  generators?: string
  /** `true` for bare `--header` (default banner); string for custom text. */
  header?: string | boolean
}

export const registerGenerate = (program: Command): void => {
  program
    .command('generate')
    .description('Generate outputs from a contract')
    .argument('[entry]', 'entry contract file')
    .option('-o, --out-dir <dir>', 'output directory')
    .option('-g, --generators <list>', 'comma-separated generator names')
    .option(
      '--header [text]',
      'prepend a comment header to generated files (bare --header = default banner; omitted = contract `header:` or none)'
    )
    .action((entryArg: string | undefined, flags: GenerateFlags) => {
      const config = loadConfig()
      const entry = entryArg ?? config.entry ?? 'contract.yml'
      const outDir = flags.outDir ?? config.outDir ?? 'generated'
      const generators =
        flags.generators?.split(',').map(name => name.trim()).filter(Boolean) ?? config.generators

      const header =
        flags.header === true ? DEFAULT_HEADER : typeof flags.header === 'string' ? toHeaderComment(flags.header) : undefined
      const registry = createDefaultRegistry()
      const context = header !== undefined ? { header } : undefined

      // Without -o/-g, run every `generate:` target declared in the contract
      // graph — the one-command flow. Flags switch back to single-target mode.
      const explicit = flags.outDir !== undefined || flags.generators !== undefined || config.outDir !== undefined || config.generators !== undefined
      if (!explicit) {
        const all = generateAll(entry, { registry, write: true, ...(context ? { context } : {}) })
        if (all.targets.length > 0 || !all.ok) {
          if (all.diagnostics.length > 0) {
            console.log(formatDiagnostics(all.diagnostics))
          }
          if (!all.ok) {
            const { errors } = countBySeverity(all.diagnostics)
            console.error(`\n✖ generation aborted: ${errors} error(s)`)
            process.exit(1)
          }
          let total = 0
          for (const target of all.targets) {
            total += target.files.length
            console.log(`✔ ${target.files.length} file(s) → ${target.outDir} (${target.generators.join(', ')})`)
          }
          console.log(`\n✔ ${total} file(s) written from ${all.targets.length} target(s)`)
          return
        }
        // No declared targets anywhere: fall through to single-target mode.
      }

      const result = generate(entry, {
        outDir,
        generators,
        registry,
        write: true,
        ...(context ? { context } : {}),
      })

      if (result.diagnostics.length > 0) {
        console.log(formatDiagnostics(result.diagnostics))
      }
      if (!result.ok) {
        const { errors } = countBySeverity(result.diagnostics)
        console.error(`\n✖ generation aborted: ${errors} error(s)`)
        process.exit(1)
      }
      for (const file of result.files) {
        console.log(`generated ${file.path}`)
      }
      console.log(`\n✔ ${result.files.length} file(s) written to ${outDir}`)
    })
}
