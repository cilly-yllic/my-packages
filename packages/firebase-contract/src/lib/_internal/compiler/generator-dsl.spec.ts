import { describe, expect, it } from 'vitest'

import { parseContract } from '../parser/parse.js'
import { createMemoryLoader } from '../resolver/module-loader.js'

import { generateAll } from './compiler.js'

const ROOT = `
project:
  aliases:
    "#contracts/*": libs/contracts/src/*
generators:
  - generator: api-types
    out: "#contracts/api-types/{api-name}"
imports:
  - ./svc/contract.yml
`

const SERVICE = `
generators:
  - generator: api-dto
    out: src/generated
  - generator: task-payloads
    out: src/generated
envelopes:
  ReconTaskPayload:
    fields:
      identifierId: string
      opId: string
apis:
  /ai-models/{model-id}:
    operationId: updateAiModel
    method: PUT
    generators:
      - api-dto
      - api-types
    request:
      fields:
        displayName: string
    response:
      void: true
  /ai-providers:
    operationId: createAiProvider
    method: POST
    request:
      fields:
        name: string
    response:
      void: true
tasks:
  defaults:
    generators: [task-payloads]
  createUser:
    envelope: ReconTaskPayload
    maxAttempts: 3
    request:
      fields:
        uid: { type: string, description: Firebase Auth UID }
    response:
      void: true
`

const loader = () =>
  createMemoryLoader({
    '/proj/contract.yml': ROOT,
    '/proj/svc/contract.yml': SERVICE,
  })

describe('generator declaration/application DSL', () => {
  it('runs api-scoped generators for opted-in entries only', () => {
    const result = generateAll('/proj/contract.yml', { loader: loader() })
    expect(result.ok).toBe(true)
    const paths = result.targets.flatMap(t => t.files.map(f => f.path))

    // updateAiModel opted into api-dto → emitted; createAiProvider did not → absent
    const dto = result.targets.find(t => t.files.some(f => f.path.endsWith('api-dtos.ts')))
    expect(dto?.outDir).toBe('/proj/svc/src/generated')
    const dtoContent = dto?.files[0]?.content ?? ''
    expect(dtoContent).toContain('UpdateAiModel')
    expect(dtoContent).not.toContain('CreateAiProvider')

    // alias + {api-name} placeholder resolves relative to the root yml, per api
    expect(paths).toContain('/proj/libs/contracts/src/api-types/update-ai-model/api-types.ts')
    expect(paths.some(p => p.includes('create-ai-provider'))).toBe(false)
  })

  it('applies section defaults when an entry declares no generators', () => {
    const result = generateAll('/proj/contract.yml', { loader: loader() })
    const payloads = result.targets.find(t => t.files.some(f => f.path.endsWith('task-payloads.ts')))
    expect(payloads?.outDir).toBe('/proj/svc/src/generated')
    expect(payloads?.files[0]?.content).toContain('CreateUserTaskData')
  })

  it('does not run api-scoped generators from declarations alone (document scope only)', () => {
    // api-types is declared at the root but nothing at the root opts in → no root-level output
    const result = generateAll('/proj/contract.yml', { loader: loader() })
    const rootTargets = result.targets.filter(t => t.source === '/proj/contract.yml')
    expect(rootTargets).toEqual([])
  })

  it('reports an error when an application references an undeclared generator', () => {
    const broken = SERVICE.replace('- api-dto', '- nonexistent')
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': ROOT, '/proj/svc/contract.yml': broken }),
    })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some(d => d.code === 'UNKNOWN_GENERATOR_DECL')).toBe(true)
  })

  it('reports an error for an alias with no project.aliases match', () => {
    const rootWithoutAlias = ROOT.replace('project:', 'ignored:').replace('  aliases:', '  aliasesX:').replace('    "#contracts/*": libs/contracts/src/*', '    x: y')
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': rootWithoutAlias, '/proj/svc/contract.yml': SERVICE }),
    })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some(d => d.code === 'UNKNOWN_ALIAS')).toBe(true)
  })

  it('lets an entry-level out override the declared template', () => {
    const overridden = SERVICE.replace(
      `    generators:
      - api-dto
      - api-types`,
      `    generators:
      - { generator: api-dto, out: "src/entries/{path}" }
      - api-types`
    )
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': ROOT, '/proj/svc/contract.yml': overridden }),
    })
    expect(result.ok).toBe(true)
    // {path} drops the `{model-id}` param segment
    const dto = result.targets.find(t => t.files.some(f => f.path.endsWith('api-dtos.ts')))
    expect(dto?.outDir).toBe('/proj/svc/src/entries/ai-models')
  })
})

describe('document-scoped declarations (data-connect ymls etc.)', () => {
  it('runs document-scoped generators declared in an imported schema yml', () => {
    const root = `
imports:
  - ./dc/schema.yml
`
    const schema = `
generators:
  - { generator: data-connect-graphql, out: src }
models:
  Shop:
    table: true
    fields:
      id: { type: id, id: true }
      name: string
`
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': root, '/proj/dc/schema.yml': schema }),
    })
    expect(result.ok).toBe(true)
    const target = result.targets.find(t => t.source === '/proj/dc/schema.yml')
    // out resolves relative to the declaring yml (the schema file), not the root
    expect(target?.outDir).toBe('/proj/dc/src')
    expect(target?.files.some(f => f.path.endsWith('.gql'))).toBe(true)
  })

  it('resolves #aliases from document-scoped declarations against the root yml', () => {
    const root = `
project:
  aliases:
    "#contracts/*": libs/contracts/src/*
imports:
  - ./dc/schema.yml
`
    const schema = `
generators:
  - { generator: typescript, out: "#contracts" }
models:
  Shop:
    fields:
      id: { type: id, id: true }
`
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': root, '/proj/dc/schema.yml': schema }),
    })
    expect(result.ok).toBe(true)
    const target = result.targets.find(t => t.source === '/proj/dc/schema.yml')
    expect(target?.outDir).toBe('/proj/libs/contracts/src')
  })
})

describe('parser: sections and declarations', () => {
  it('parses tasks/events into kind-implied apis and rejects duplicates', () => {
    const contract = parseContract(SERVICE, '/svc.yml')
    expect(contract.apis.updateAiModel?.kind).toBe('https')
    expect(contract.apis.updateAiModel?.path).toBe('/ai-models/{model-id}')
    expect(contract.apis.createUser?.kind).toBe('task')
    expect(contract.sectionDefaults?.tasks).toEqual([{ generator: 'task-payloads' }])
    expect(contract.generatorDecls).toEqual([
      { generator: 'api-dto', out: 'src/generated' },
      { generator: 'task-payloads', out: 'src/generated' },
    ])
  })

  it('requires operationId on path-keyed apis', () => {
    expect(() => parseContract('apis:\n  /x:\n    method: GET\n', '/c.yml')).toThrow(/operationId/)
  })

  it('rejects task/pubsub kinds inside the path-keyed apis section', () => {
    expect(() => parseContract('apis:\n  /x:\n    operationId: x\n    kind: task\n', '/c.yml')).toThrow(
      /https\|callable/
    )
  })

  it('rejects the same name declared across sections', () => {
    const yml = 'apis:\n  a:\n    kind: https\n    request: {}\n    response: {}\ntasks:\n  a:\n    request: {}\n'
    expect(() => parseContract(yml, '/c.yml')).toThrow(/more than once/)
  })
})
