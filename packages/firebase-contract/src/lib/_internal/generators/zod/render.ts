import { Ir, IrEnum, IrField, IrModel, IrTypeRef, ScalarType } from '../../ir/ir.js'
import { zodConstraints } from '../support/constraints.js'
import { singleQuote } from '../support/naming.js'
import { isRelation, relationFkName, relationFkType } from '../support/relations.js'

/**
 * Rendering shared by the bundled and split Zod layouts. Both layouts MUST go
 * through these helpers so a contract setting (nullable, constraints, …) means
 * the same thing regardless of layout.
 */

export const SCALAR_ZOD: Record<ScalarType, string> = {
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

export const schemaName = (name: string): string => `${name}Schema`

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

export const renderFieldSchema = (field: IrField, ir: Ir): string => {
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

export const renderEnum = (irEnum: IrEnum): string => {
  const values = irEnum.values.map(singleQuote).join(', ')
  return (
    `export const ${schemaName(irEnum.name)} = z.enum([${values}])\n` +
    `export type ${irEnum.name} = z.infer<typeof ${schemaName(irEnum.name)}>`
  )
}

export const renderModel = (model: IrModel, ir: Ir): string => {
  const fields = model.fields.map(field => renderFieldSchema(field, ir)).join('\n')
  return (
    `export const ${schemaName(model.name)} = z.object({\n${fields}\n})\n` +
    `export type ${model.name} = z.infer<typeof ${schemaName(model.name)}>`
  )
}
