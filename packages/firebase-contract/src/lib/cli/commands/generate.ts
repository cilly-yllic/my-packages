import { Command } from 'commander'

import { diffFiles, generate, generateAll } from '~internal/compiler/compiler.js'
import { DEFAULT_HEADER, toHeaderComment } from '~internal/generators/support/header.js'
import { countBySeverity, formatDiagnostics } from '~internal/format-diagnostics.js'
import { createDefaultRegistry } from '~internal/generators/index.js'
import { loadConfig } from '../config.js'

interface GenerateFlags {
  outDir?: string
  generators?: string
  /** `true` for bare `--header` (default banner); string for custom text. */
  header?: string | boolean
  /** Dry-run: compare generated content against the files on disk. */
  check?: boolean
}

const reportDrift = (changed: string[], missing: string[]): void => {
  if (changed.length === 0 && missing.length === 0) {
    console.log('✔ no drift — on-disk files match the contract')
    return
  }
  console.error('✖ drift detected — regenerate and commit the outputs (fbc generate):')
  for (const path of changed) console.error(`  changed: ${path}`)
  for (const path of missing) console.error(`  missing: ${path}`)
  process.exit(1)
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
    .option('--check', 'verify the on-disk files match what would be generated; exits 1 on drift (writes nothing)')
    .action((entryArg: string | undefined, flags: GenerateFlags) => {
      const config = loadConfig()
      const entry = entryArg ?? config.entry ?? 'contract.yml'
      const outDir = flags.outDir ?? 'generated'
      const generators = flags.generators?.split(',').map(name => name.trim()).filter(Boolean)

      const header =
        flags.header === true ? DEFAULT_HEADER : typeof flags.header === 'string' ? toHeaderComment(flags.header) : undefined
      const registry = createDefaultRegistry()
      const context = header !== undefined ? { header } : undefined

      // Without -o/-g, run every generator declared in the contract
      // graph — the one-command flow. Only explicit flags switch back to
      // single-target mode; the config file cannot (it must never silently
      // disable the contract's own generators: declarations).
      const explicit = flags.outDir !== undefined || flags.generators !== undefined
      if (!explicit) {
        const all = generateAll(entry, { registry, write: !flags.check, ...(context ? { context } : {}) })
        if (all.targets.length > 0 || !all.ok) {
          if (all.diagnostics.length > 0) {
            console.log(formatDiagnostics(all.diagnostics))
          }
          if (!all.ok) {
            const { errors } = countBySeverity(all.diagnostics)
            console.error(`\n✖ generation aborted: ${errors} error(s)`)
            process.exit(1)
          }
          if (flags.check) {
            const drift = diffFiles(all.targets.flatMap(target => target.files))
            reportDrift(drift.changed, drift.missing)
            return
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
        write: !flags.check,
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
      if (flags.check) {
        const drift = diffFiles(result.files)
        reportDrift(drift.changed, drift.missing)
        return
      }
      for (const file of result.files) {
        console.log(`generated ${file.path}`)
      }
      console.log(`\n✔ ${result.files.length} file(s) written to ${outDir}`)
    })
}
