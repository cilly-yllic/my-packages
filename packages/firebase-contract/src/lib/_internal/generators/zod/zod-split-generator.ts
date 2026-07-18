import { findEnum, findModel, Ir, IrEnum, IrField, IrModel, IrTypeRef, ScalarType } from '../../ir/ir.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { zodConstraints } from '../support/constraints.js'
import { headerBlocks } from '../support/header.js'
import { singleQuote } from '../support/naming.js'
import { isRelation, relationFkName, relationFkType } from '../support/relations.js'
import { collectDeps, kebabCase, splitGroups, tableNameOf } from '../support/split.js'

const SCALAR_ZOD: Record<ScalarType, string> = {
  string: 'z.string()',
  int: 'z.number().int()',
  int64: 'z.number().int()',
  float: 'z.number()',
  boolean: 'z.boolean()',
  timestamp: 'z.string().datetime()',
  date: 'z.string()',
  json: 'z.unknown()',
  id: 'z.string()',
}

const schemaName = (name: string): string => `${name}Schema`

const renderRef = (ref: IrTypeRef): string => {
  switch (ref.kind) {
    case 'scalar':
      return SCALAR_ZOD[ref.name]
    case 'enum':
      return schemaName(ref.name)
    case 'model':
      // Wrapped in z.lazy so declaration order and (cross-file) cycles never matter.
      return `z.lazy(() => ${schemaName(ref.name)})`
    default:
      return 'z.unknown()'
  }
}

const renderFieldSchema = (field: IrField, ir: Ir): string => {
  const isRel = isRelation(field)
  const name = isRel ? relationFkName(field) : field.name
  const base = field.literal !== undefined
    ? `z.literal(${singleQuote(field.literal)})`
    : isRel
      ? SCALAR_ZOD[relationFkType(ir, field)]
      : renderRef(field.type)
  const cons = zodConstraints(field)
  let schema = field.list ? `z.array(${base})${cons}` : `${base}${cons}`
  if (field.nullable) schema = `${schema}.nullable()`
  if (field.optional) schema = `${schema}.optional()`
  return `  ${name}: ${schema},`
}

const renderEnum = (irEnum: IrEnum): string => {
  const values = irEnum.values.map(singleQuote).join(', ')
  return (
    `export const ${schemaName(irEnum.name)} = z.enum([${values}])\n` +
    `export type ${irEnum.name} = z.infer<typeof ${schemaName(irEnum.name)}>`
  )
}

const renderModel = (model: IrModel, ir: Ir): string => {
  const fields = model.fields.map(field => renderFieldSchema(field, ir)).join('\n')
  return (
    `export const ${schemaName(model.name)} = z.object({\n${fields}\n})\n` +
    `export type ${model.name} = z.infer<typeof ${schemaName(model.name)}>`
  )
}

/**
 * Split variant of the Zod generator: one file per table at
 * `schemas/<table-name>.ts` (kebab-case) with enums and embedded value objects
 * co-located at their first referencing table, leftovers in
 * `schemas/_shared.ts`, and a `schemas.ts` barrel.
 */
export const createZodSplitGenerator = (): Generator => ({
  name: 'zod-split',
  description: 'Zod schemas, one file per table (schemas/<table>.ts + schemas.ts barrel)',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    const groups = splitGroups(ir)
    const files: GeneratedFile[] = []
    const fileOf = new Map<string, string>()

    for (const name of groups.leftoverEnums) fileOf.set(name, '_shared')
    for (const name of groups.leftoverModels) fileOf.set(name, '_shared')
    for (const table of groups.tables) {
      const moduleName = kebabCase(tableNameOf(table))
      fileOf.set(table.name, moduleName)
      for (const [name, home] of groups.enumHome) if (home === table.name) fileOf.set(name, moduleName)
      for (const [name, home] of groups.modelHome) if (home === table.name) fileOf.set(name, moduleName)
    }

    const emit = (moduleName: string, enums: IrEnum[], models: IrModel[]): void => {
      const blocks: string[] = [...headerBlocks(context), "import { z } from 'zod'"]
      const external = new Map<string, Set<string>>()
      for (const model of models) {
        for (const field of model.fields) {
          // Literal-pinned and relation fields render without referencing the schema.
          if (field.literal !== undefined || isRelation(field)) continue
          if (field.type.kind !== 'enum' && field.type.kind !== 'model') continue
          const home = fileOf.get(field.type.name)
          if (home && home !== moduleName) {
            const set = external.get(home) ?? new Set<string>()
            set.add(schemaName(field.type.name))
            external.set(home, set)
          }
        }
      }
      const imports = [...external.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([home, symbols]) => `import { ${[...symbols].sort().join(', ')} } from './${home}'`)
      if (imports.length > 0) blocks.push(imports.join('\n'))
      for (const irEnum of enums) blocks.push(renderEnum(irEnum))
      for (const model of models) blocks.push(renderModel(model, ir))
      files.push({ path: `schemas/${moduleName}.ts`, content: `${blocks.join('\n\n')}\n` })
    }

    if (groups.leftoverEnums.length > 0 || groups.leftoverModels.length > 0) {
      const enums = groups.leftoverEnums.map(name => findEnum(ir, name)).filter((e): e is IrEnum => Boolean(e))
      const models = groups.leftoverModels.map(name => findModel(ir, name)).filter((m): m is IrModel => Boolean(m))
      emit('_shared', enums, models)
    }

    for (const table of groups.tables) {
      const moduleName = kebabCase(tableNameOf(table))
      const deps = collectDeps(ir, [table])
      const enums = deps.enums
        .filter(name => groups.enumHome.get(name) === table.name)
        .map(name => findEnum(ir, name))
        .filter((e): e is IrEnum => Boolean(e))
      const models = deps.models
        .filter(name => groups.modelHome.get(name) === table.name)
        .map(name => findModel(ir, name))
        .filter((m): m is IrModel => Boolean(m))
      emit(moduleName, enums, [...models, table])
    }

    const exports = files.map(file => `export * from './${file.path.replace(/\.ts$/, '')}'`)
    files.push({ path: 'schemas.ts', content: `${[...headerBlocks(context), exports.join('\n')].join('\n\n')}\n` })
    return files
  },
})
