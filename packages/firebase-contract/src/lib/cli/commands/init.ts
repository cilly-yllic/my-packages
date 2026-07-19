import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { Command } from 'commander'

import { CONFIG_FILENAME } from '../config.js'

const EXAMPLE_CONTRACT = `version: 1

# Declare generators once (name + output template); entries opt in below.
generators:
  - { generator: typescript, out: generated }
  - { generator: zod, out: generated }

enums:
  ProductStatus:
    description: Lifecycle state of a product
    values:
      - todo
      - in_progress
      - done

models:
  User:
    description: An application user
    fields:
      id: { type: id, id: true }
      name: string
      email: string

  Product:
    description: A unit of work
    fields:
      id: { type: id, id: true }
      title: string
      status: ProductStatus
      priority: { type: int, optional: true }
      tags: { type: string, list: true }
      assignee: { type: User, optional: true }
      metadata: { type: json, optional: true }
      createdAt: timestamp
`

const EXAMPLE_CONFIG =
  JSON.stringify(
    {
      entry: 'contract.yml',
      outDir: 'generated',
      generators: [
        'typescript',
        'zod',
        'data-connect-graphql',
        'data-connect-operations',
        'data-connect-adapter',
        'firestore-types',
        'firestore',
        'api-types',
        'api-validation',
      ],
    },
    null,
    2
  ) + '\n'

const writeIfAbsent = (path: string, content: string, force: boolean): boolean => {
  if (existsSync(path) && !force) {
    return false
  }
  writeFileSync(path, content, 'utf8')
  return true
}

export const registerInit = (program: Command): void => {
  program
    .command('init')
    .description('Scaffold a starter contract.yml and firebase-contract.json')
    .option('-f, --force', 'overwrite existing files', false)
    .action((options: { force?: boolean }) => {
      const cwd = process.cwd()
      const targets: Array<[string, string]> = [
        [resolve(cwd, 'contract.yml'), EXAMPLE_CONTRACT],
        [resolve(cwd, CONFIG_FILENAME), EXAMPLE_CONFIG],
      ]
      for (const [path, content] of targets) {
        const written = writeIfAbsent(path, content, Boolean(options.force))
        console.log(written ? `created ${path}` : `skipped ${path} (already exists)`)
      }
    })
}
