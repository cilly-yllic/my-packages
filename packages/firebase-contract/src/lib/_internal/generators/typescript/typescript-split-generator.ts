import { findEnum, findModel, Ir, IrEnum, IrField, IrModel, IrTypeRef, ScalarType } from '../../ir/ir.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'
import { constantCase, singleQuote } from '../support/naming.js'
import { isRelation, relationFkName, relationFkType } from '../support/relations.js'
import { assignModuleNames, collectDeps, splitGroups } from '../support/split.js'
import { outputFile } from '../support/templates.js'

const SCALAR_TS: Record<ScalarType, string> = {
  string: 'string',
  int: 'number',
  int64: 'number',
  float: 'number',
  boolean: 'boolean',
  timestamp: 'string',
  date: 'string',
  json: 'Json',
  id: 'string',
}

const JSON_TYPE = [
  'export type Json =',
  '  | string',
  '  | number',
  '  | boolean',
  '  | null',
  '  | Json[]',
  '  | { [key: string]: Json }',
].join('\n')

const renderRef = (ref: IrTypeRef): string => {
  switch (ref.kind) {
    case 'scalar':
      return SCALAR_TS[ref.name]
    case 'enum':
    case 'model':
      return ref.name
    default:
      return 'unknown'
  }
}

const docLines = (description: string | undefined, indent: string): string[] => {
  if (!description) return []
  const lines = description.split('\n')
  if (lines.length === 1) return [`${indent}/** ${lines[0]} */`]
  return [`${indent}/**`, ...lines.map(line => `${indent} * ${line}`.trimEnd()), `${indent} */`]
}

const renderField = (field: IrField, ir: Ir): string => {
  const optional = field.optional ? '?' : ''
  const doc = docLines(field.description, '  ')
  let entry: string
  if (field.literal !== undefined) {
    const type = field.list ? `${singleQuote(field.literal)}[]` : singleQuote(field.literal)
    entry = `  ${field.name}${optional}: ${type}`
  } else if (isRelation(field)) {
    const base = SCALAR_TS[relationFkType(ir, field)]
    entry = `  ${relationFkName(field)}${optional}: ${field.list ? `${base}[]` : base}`
  } else {
    const base = renderRef(field.type)
    const type = field.list ? `${base}[]` : base
    const nullable = field.nullable ? ' | null' : ''
    entry = `  ${field.name}${optional}: ${type}${nullable}`
  }
  return [...doc, entry].join('\n')
}

const renderEnumConst = (irEnum: IrEnum): string => {
  const doc = docLines(irEnum.description, '')
  const constName = constantCase(irEnum.name)
  const entries = irEnum.values
    .map(value => `  ${irEnum.valueKeys?.[value] ?? constantCase(value)}: ${singleQuote(value)},`)
    .join('\n')
  return [
    ...doc,
    `export const ${constName} = Object.freeze({`,
    entries,
    `} as const)`,
    `export type ${irEnum.name}Key = keyof typeof ${constName}`,
    `export type ${irEnum.name} = (typeof ${constName})[${irEnum.name}Key]`,
  ].join('\n')
}

const renderModel = (model: IrModel, ir: Ir): string => {
  const doc = docLines(model.description, '')
  const fields = model.fields.map(field => renderField(field, ir)).join('\n')
  return [...doc, `export interface ${model.name} {`, fields, '}'].join('\n')
}

const usesJson = (models: IrModel[]): boolean =>
  models.some(model => model.fields.some(field => field.type.kind === 'scalar' && field.type.name === 'json'))

/**
 * Split variant of the TypeScript generator: one file per table at
 * `types/<table-name>.ts` (kebab-case), with enums and embedded value objects
 * co-located in the file of the first table that references them. Shared
 * leftovers (and the `Json` type) live in `types/_shared.ts`, and `types.ts`
 * is a barrel re-exporting every file.
 */
export const createTypeScriptSplitLayout = (): Generator => ({
  name: 'typescript',
  description: 'TypeScript interfaces, one file per table (types/<table>.ts + types.ts barrel)',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    const groups = splitGroups(ir)
    const moduleNames = assignModuleNames(groups.tables)
    const files: GeneratedFile[] = []
    const fileOf = new Map<string, string>() // symbol -> module basename (no ext)

    const sharedNeeded = usesJson(ir.models) || groups.leftoverEnums.length > 0 || groups.leftoverModels.length > 0
    if (usesJson(ir.models)) fileOf.set('Json', '_shared')
    for (const name of groups.leftoverEnums) fileOf.set(name, '_shared')
    for (const name of groups.leftoverModels) fileOf.set(name, '_shared')
    for (const table of groups.tables) {
      const moduleName = moduleNames.get(table.name) ?? table.name
      fileOf.set(table.name, moduleName)
      for (const [name, home] of groups.enumHome) if (home === table.name) fileOf.set(name, moduleName)
      for (const [name, home] of groups.modelHome) if (home === table.name) fileOf.set(name, moduleName)
    }

    const emit = (moduleName: string, enums: IrEnum[], models: IrModel[], includeJson: boolean): void => {
      const blocks: string[] = [...headerBlocks(context)]
      // Imports for symbols declared in sibling files.
      const external = new Map<string, Set<string>>()
      const need = (symbol: string): void => {
        const home = fileOf.get(symbol)
        if (home && home !== moduleName) {
          const set = external.get(home) ?? new Set<string>()
          set.add(symbol)
          external.set(home, set)
        }
      }
      for (const model of models) {
        for (const field of model.fields) {
          if (field.type.kind === 'scalar' && field.type.name === 'json') need('Json')
          // Literal-pinned and relation fields render without referencing the type.
          if (field.literal !== undefined || isRelation(field)) continue
          if (field.type.kind === 'enum' || field.type.kind === 'model') need(field.type.name)
        }
      }
      const imports = [...external.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([home, symbols]) => `import type { ${[...symbols].sort().join(', ')} } from './${home}'`)
      if (imports.length > 0) blocks.push(imports.join('\n'))
      if (includeJson) blocks.push(JSON_TYPE)
      for (const irEnum of enums) blocks.push(renderEnumConst(irEnum))
      for (const model of models) blocks.push(renderModel(model, ir))
      files.push({ path: `types/${moduleName}.ts`, content: `${blocks.join('\n\n')}\n` })
    }

    if (sharedNeeded) {
      const enums = groups.leftoverEnums.map(name => findEnum(ir, name)).filter((e): e is IrEnum => Boolean(e))
      const models = groups.leftoverModels.map(name => findModel(ir, name)).filter((m): m is IrModel => Boolean(m))
      emit('_shared', enums, models, usesJson(ir.models))
    }

    for (const table of groups.tables) {
      const moduleName = moduleNames.get(table.name) ?? table.name
      const deps = collectDeps(ir, [table])
      const enums = deps.enums
        .filter(name => groups.enumHome.get(name) === table.name)
        .map(name => findEnum(ir, name))
        .filter((e): e is IrEnum => Boolean(e))
      const models = deps.models
        .filter(name => groups.modelHome.get(name) === table.name)
        .map(name => findModel(ir, name))
        .filter((m): m is IrModel => Boolean(m))
      emit(moduleName, enums, [...models, table], false)
    }

    const exports = files.map(file => `export * from './${file.path.replace(/^types\//, 'types/').replace(/\.ts$/, '')}'`)
    files.push({ path: outputFile(context, 'types.ts'), content: `${[...headerBlocks(context), exports.join('\n')].join('\n\n')}\n` })
    return files
  },
})
