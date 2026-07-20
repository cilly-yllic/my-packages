import { findEnum, findModel, Ir, IrEnum, IrModel } from '../../ir/ir.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'
import { isRelation } from '../support/relations.js'
import { assignModuleNames, collectDeps, splitGroups } from '../support/split.js'
import { outputFile } from '../support/templates.js'
import { renderEnum, renderModel, schemaName } from './render.js'

/**
 * Split variant of the Zod generator: one file per table at
 * `schemas/<table-name>.ts` (kebab-case) with enums and embedded value objects
 * co-located at their first referencing table, leftovers in
 * `schemas/_shared.ts`, and a `schemas.ts` barrel.
 */
export const createZodSplitLayout = (): Generator => ({
  name: 'zod',
  description: 'Zod schemas, one file per table (schemas/<table>.ts + schemas.ts barrel)',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    const groups = splitGroups(ir)
    const moduleNames = assignModuleNames(groups.tables)
    const files: GeneratedFile[] = []
    const fileOf = new Map<string, string>()

    for (const name of groups.leftoverEnums) fileOf.set(name, '_shared')
    for (const name of groups.leftoverModels) fileOf.set(name, '_shared')
    for (const table of groups.tables) {
      const moduleName = moduleNames.get(table.name) ?? table.name
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
      emit(moduleName, enums, [...models, table])
    }

    const exports = files.map(file => `export * from './${file.path.replace(/\.ts$/, '')}'`)
    files.push({ path: outputFile(context, 'schemas.ts'), content: `${[...headerBlocks(context), exports.join('\n')].join('\n\n')}\n` })
    return files
  },
})
