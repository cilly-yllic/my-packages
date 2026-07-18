import { IrField, IrTypeRef, Ir, ScalarType } from '../../ir/ir.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'
import { singleQuote } from '../support/naming.js'
import { isRelation, relationFkName, relationFkType } from '../support/relations.js'
import { zodConstraints } from '../support/constraints.js'

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
      // Enums are declared before models, so a direct reference is safe.
      return schemaName(ref.name)
    case 'model':
      // Model references are wrapped in z.lazy so declaration order and cycles
      // never matter.
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
  if (field.optional) {
    schema = `${schema}.optional()`
  }
  return `  ${name}: ${schema},`
}

/**
 * Generates Zod schemas and the types inferred from them. Model references use
 * `z.lazy` so the output is order- and cycle-independent.
 */
export const createZodGenerator = (): Generator => ({
  name: 'zod',
  description: 'Zod validation schemas',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    const blocks: string[] = [...headerBlocks(context), "import { z } from 'zod'"]

    for (const irEnum of ir.enums) {
      const values = irEnum.values.map(singleQuote).join(', ')
      blocks.push(
        `export const ${schemaName(irEnum.name)} = z.enum([${values}])\n` +
          `export type ${irEnum.name} = z.infer<typeof ${schemaName(irEnum.name)}>`
      )
    }

    for (const model of ir.models) {
      const fields = model.fields.map(field => renderFieldSchema(field, ir)).join('\n')
      blocks.push(
        `export const ${schemaName(model.name)} = z.object({\n${fields}\n})\n` +
          `export type ${model.name} = z.infer<typeof ${schemaName(model.name)}>`
      )
    }

    return [{ path: 'schemas.ts', content: `${blocks.join('\n\n')}\n` }]
  },
})
