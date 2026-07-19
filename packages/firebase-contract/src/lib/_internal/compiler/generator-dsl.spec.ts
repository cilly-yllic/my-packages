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
    const dto = result.targets.find(t => t.files.some(f => f.path.endsWith('.dto.ts')))
    expect(dto?.outDir).toBe('/proj/svc/src/generated')
    // 1 api = 1 file, named after the operation (NestJS convention)
    expect(dto?.files.map(f => f.path)).toEqual(['/proj/svc/src/generated/update-ai-model.dto.ts'])
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
    const dto = result.targets.find(t => t.files.some(f => f.path.endsWith('.dto.ts')))
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

  it('runs operation generators declared in a connectors-style yml', () => {
    const root = `
imports:
  - ./dc/connectors.yml
`
    const connectors = `
generators:
  - { generator: data-connect-operations, out: src/connectors }
models:
  Product:
    fields:
      id: { type: int, id: true }
      title: string
operations:
  SearchProducts:
    type: query
    model: Product
    where:
      - { field: title, op: contains }
`
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': root, '/proj/dc/connectors.yml': connectors }),
    })
    expect(result.ok).toBe(true)
    const target = result.targets.find(t => t.source === '/proj/dc/connectors.yml')
    expect(target?.outDir).toBe('/proj/dc/src/connectors')
    expect(target?.files.length).toBeGreaterThan(0)
    expect(target?.files.some(f => f.content.includes('SearchProducts'))).toBe(true)
  })

  it('runs firestore generators declared in a rules-style yml', () => {
    const root = `
imports:
  - ./rules/contract.yml
`
    const rules = `
generators:
  - { generator: firestore, out: src/generated }
models:
  Product:
    fields:
      id: { type: int, id: true }
      title: string
firestore:
  Product:
    from: Product
    collection: shops/{shopId}/products/{productId}
    omit: [id]
`
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': root, '/proj/rules/contract.yml': rules }),
    })
    expect(result.ok).toBe(true)
    const target = result.targets.find(t => t.source === '/proj/rules/contract.yml')
    expect(target?.outDir).toBe('/proj/rules/src/generated')
    expect(target?.files.some(f => f.content.includes('Product'))).toBe(true)
  })

  it('runs document-scoped generators declared at the root over the merged graph', () => {
    const root = `
generators:
  - { generator: zod, out: libs/contracts/src }
imports:
  - ./shared.yml
`
    const shared = `
models:
  Product:
    fields:
      id: { type: int, id: true }
      title: string
`
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': root, '/proj/shared.yml': shared }),
    })
    expect(result.ok).toBe(true)
    const target = result.targets.find(t => t.source === '/proj/contract.yml')
    expect(target?.outDir).toBe('/proj/libs/contracts/src')
    // the root subtree includes the imported shared models
    expect(target?.files.some(f => f.content.includes('ProductSchema'))).toBe(true)
  })

  it('runs model generators declared in a shared-models yml relative to that yml', () => {
    const root = `
imports:
  - ./contracts/shared.yml
`
    const shared = `
generators:
  - { generator: typescript, out: generated }
models:
  SharedEnvelopeMeta:
    fields:
      requestId: string
`
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': root, '/proj/contracts/shared.yml': shared }),
    })
    expect(result.ok).toBe(true)
    const target = result.targets.find(t => t.source === '/proj/contracts/shared.yml')
    expect(target?.outDir).toBe('/proj/contracts/generated')
    expect(target?.files.some(f => f.content.includes('SharedEnvelopeMeta'))).toBe(true)
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

  it('allows the same route once per verb via METHOD-prefixed keys', () => {
    const yml = [
      'apis:',
      '  PUT /ai-models/{model-id}:',
      '    operationId: updateAiModel',
      '    request: {}',
      '    response: {}',
      '  DELETE /ai-models/{model-id}:',
      '    operationId: deleteAiModel',
      '    request: {}',
      '    response: {}',
      '',
    ].join('\n')
    const contract = parseContract(yml, '/c.yml')
    expect(contract.apis.updateAiModel?.method).toBe('PUT')
    expect(contract.apis.updateAiModel?.path).toBe('/ai-models/{model-id}')
    expect(contract.apis.deleteAiModel?.method).toBe('DELETE')
  })

  it('rejects a method field conflicting with the METHOD-prefixed key', () => {
    const yml = 'apis:\n  PUT /x:\n    operationId: x\n    method: POST\n'
    expect(() => parseContract(yml, '/c.yml')).toThrow(/the key says "PUT"/)
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
    const yml = 'apis:\n  /a:\n    operationId: a\n    request: {}\n    response: {}\ntasks:\n  a:\n    request: {}\n'
    expect(() => parseContract(yml, '/c.yml')).toThrow(/more than once/)
  })

  it('rejects non-path keys in the apis section', () => {
    expect(() => parseContract('apis:\n  createNote:\n    method: POST\n', '/c.yml')).toThrow(/REST paths/)
  })
})

describe('declarative output settings (file / split / options)', () => {
  it('splits an api-scoped generator into per-api files via file template', () => {
    const root = ROOT.replace(
      `  - generator: api-types
    out: "#contracts/api-types/{api-name}"`,
      `  - generator: api-types
    out: "#contracts/api-types"
    file: "{api-name}.types.ts"
    split: true`
    )
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': root, '/proj/svc/contract.yml': SERVICE }),
    })
    expect(result.ok).toBe(true)
    const paths = result.targets.flatMap(t => t.files.map(f => f.path))
    expect(paths).toContain('/proj/libs/contracts/src/api-types/update-ai-model.types.ts')
  })

  it('bundles a split-by-default generator when split is false with a plain file name', () => {
    const overridden = SERVICE.replace(
      '      - api-dto',
      '      - { generator: api-dto, split: false, file: dtos.ts }'
    )
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': ROOT, '/proj/svc/contract.yml': overridden }),
    })
    expect(result.ok).toBe(true)
    const dto = result.targets.find(t => t.files.some(f => f.path.endsWith('dtos.ts')))
    expect(dto?.files.map(f => f.path)).toEqual(['/proj/svc/src/generated/dtos.ts'])
    expect(dto?.files[0]?.content).toContain('UpdateAiModelDto')
  })

  it('honors options.typesImport for the api-types import path', () => {
    const root = ROOT.replace(
      `  - generator: api-types
    out: "#contracts/api-types/{api-name}"`,
      `  - generator: api-types
    out: "#contracts/api-types/{api-name}"
    options:
      typesImport: "../../types"`
    )
    const service = SERVICE.replace(
      `    request:
      fields:
        displayName: string`,
      `    request:
      model: AiModel`
    ) + `
models:
  AiModel:
    fields:
      displayName: string
`
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': root, '/proj/svc/contract.yml': service }),
    })
    expect(result.ok).toBe(true)
    const types = result.targets
      .flatMap(t => t.files)
      .find(f => f.path === '/proj/libs/contracts/src/api-types/update-ai-model/api-types.ts')
    expect(types?.content).toContain("from '../../types'")
  })

  it('rejects split without an api placeholder in the file name', () => {
    const overridden = SERVICE.replace('      - api-types', '      - { generator: api-types, split: true }')
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': ROOT, '/proj/svc/contract.yml': overridden }),
    })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some(d => d.code === 'INVALID_OUT_TEMPLATE')).toBe(true)
  })

  it('rejects a bundled output whose file name still has api placeholders', () => {
    const overridden = SERVICE.replace('      - api-dto', '      - { generator: api-dto, split: false }')
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': ROOT, '/proj/svc/contract.yml': overridden }),
    })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some(d => d.code === 'INVALID_OUT_TEMPLATE')).toBe(true)
  })

  it('renames a document-scoped single-file output via file', () => {
    const root = `
generators:
  - { generator: typescript, out: libs/contracts/src, file: models.ts }
imports:
  - ./shared.yml
`
    const shared = `
models:
  Product:
    fields:
      id: { type: int, id: true }
      title: string
`
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': root, '/proj/shared.yml': shared }),
    })
    expect(result.ok).toBe(true)
    const paths = result.targets.flatMap(t => t.files.map(f => f.path))
    expect(paths).toContain('/proj/libs/contracts/src/models.ts')
    expect(paths).not.toContain('/proj/libs/contracts/src/types.ts')
  })

  it('switches a document-scoped generator to its -split variant via split', () => {
    const root = `
generators:
  - { generator: typescript, out: src, split: true, file: index.ts }
models:
  Product:
    fields:
      id: { type: int, id: true }
      title: string
`
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': root }),
    })
    expect(result.ok).toBe(true)
    const paths = result.targets.flatMap(t => t.files.map(f => f.path))
    // per-model file from typescript-split + the barrel renamed via file
    expect(paths).toContain('/proj/src/types/products.ts')
    expect(paths).toContain('/proj/src/index.ts')
  })

  it('rejects split for a document-scoped generator without a -split variant', () => {
    const root = `
generators:
  - { generator: unions, out: src, split: true }
models:
  Product:
    fields:
      id: { type: int, id: true }
`
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': root }),
    })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some(d => d.code === 'UNSUPPORTED_SPLIT')).toBe(true)
  })

  it('applies a per-generator header (declaration) and lets an entry override disable it', () => {
    const root = ROOT.replace(
      `  - generator: api-types
    out: "#contracts/api-types/{api-name}"`,
      `  - generator: api-types
    out: "#contracts/api-types/{api-name}"
    header: default`
    )
    const service = SERVICE.replace(
      '  - generator: api-dto\n    out: src/generated',
      '  - generator: api-dto\n    out: src/generated\n    header: "Managed by fbc — do not edit"'
    )
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': root, '/proj/svc/contract.yml': service }),
    })
    expect(result.ok).toBe(true)
    const files = result.targets.flatMap(t => t.files)
    const types = files.find(f => f.path === '/proj/libs/contracts/src/api-types/update-ai-model/api-types.ts')
    expect(types?.content).toContain('AUTO-GENERATED by firebase-contract')
    const dto = files.find(f => f.path.endsWith('update-ai-model.dto.ts'))
    expect(dto?.content).toContain('// Managed by fbc — do not edit')
    // task-payloads declared without header → no banner
    const payloads = files.find(f => f.path.endsWith('task-payloads.ts'))
    expect(payloads?.content).not.toContain('AUTO-GENERATED')
  })

  it('per-generator header wins over the run-level header, and an empty header disables it', () => {
    const service = SERVICE.replace(
      '      - api-dto',
      '      - { generator: api-dto, header: "" }'
    )
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': ROOT, '/proj/svc/contract.yml': service }),
      context: { header: '// GLOBAL' },
    })
    expect(result.ok).toBe(true)
    const files = result.targets.flatMap(t => t.files)
    const dto = files.find(f => f.path.endsWith('update-ai-model.dto.ts'))
    expect(dto?.content).not.toContain('GLOBAL')
    // generators without their own header keep the run-level one
    const payloads = files.find(f => f.path.endsWith('task-payloads.ts'))
    expect(payloads?.content).toContain('// GLOBAL')
  })

  it('lets an entry-level file/split override the declaration', () => {
    const root = ROOT.replace(
      `  - generator: api-types
    out: "#contracts/api-types/{api-name}"`,
      `  - generator: api-types
    out: "#contracts/api-types"
    file: bundled.ts`
    )
    const overridden = SERVICE.replace(
      '      - api-types',
      '      - { generator: api-types, split: true, file: "{api-name}.types.ts" }'
    )
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({ '/proj/contract.yml': root, '/proj/svc/contract.yml': overridden }),
    })
    expect(result.ok).toBe(true)
    const paths = result.targets.flatMap(t => t.files.map(f => f.path))
    expect(paths).toContain('/proj/libs/contracts/src/api-types/update-ai-model.types.ts')
    expect(paths).not.toContain('/proj/libs/contracts/src/api-types/bundled.ts')
  })
})
