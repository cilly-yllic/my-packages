import { findModel, Ir, IrApi, IrApiPayload, IrField, ScalarType } from '../../ir/ir.js'
import { pascalCase, singleQuote } from '../support/naming.js'
import { isRelation, relationFkName, relationFkType } from '../support/relations.js'
import { zodConstraints } from '../support/constraints.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'

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

/** Resolve a payload to its concrete field list (inline fields or a referenced model). */
const payloadFields = (ir: Ir, payload: IrApiPayload): IrField[] => {
  if (payload.model) {
    return findModel(ir, payload.model)?.fields ?? []
  }
  return payload.fields
}

const fieldSchema = (ir: Ir, field: IrField): string => {
  const name = isRelation(field) ? relationFkName(field) : field.name
  let schema: string
  if (isRelation(field)) {
    schema = SCALAR_ZOD[relationFkType(ir, field)]
  } else if (field.type.kind === 'scalar') {
    schema = SCALAR_ZOD[field.type.name]
  } else if (field.type.kind === 'enum') {
    const enumName = field.type.name
    const irEnum = ir.enums.find(e => e.name === enumName)
    schema = irEnum ? `z.enum([${irEnum.values.map(singleQuote).join(', ')}])` : 'z.string()'
  } else {
    schema = 'z.unknown()'
  }
  const cons = zodConstraints(field)
  schema = field.list ? `z.array(${schema})${cons}` : `${schema}${cons}`
  if (field.nullable) schema = `${schema}.nullable()`
  if (field.optional) schema = `${schema}.optional()`
  return `  ${name}: ${schema},`
}

const renderRequestSchema = (ir: Ir, api: IrApi): string => {
  const name = `${pascalCase(api.name)}RequestSchema`
  const fields = payloadFields(ir, api.request)
  if (api.request.isVoid || fields.length === 0) {
    return `export const ${name} = z.object({})`
  }
  const body = fields.map(field => fieldSchema(ir, field)).join('\n')
  return `export const ${name} = z.object({\n${body}\n})`
}

/**
 * Generates Zod schemas that validate each endpoint's *request*. Model-backed
 * requests are expanded to the model's fields so the schema is self-contained.
 */
export const createApiValidationGenerator = (): Generator => ({
  name: 'api-validation',
  description: 'API request-validation Zod schemas',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    if (ir.apis.length === 0) {
      return []
    }
    const blocks: string[] = [...headerBlocks(context), "import { z } from 'zod'"]
    for (const api of ir.apis) {
      blocks.push(renderRequestSchema(ir, api))
    }
    return [{ path: 'api-validation.ts', content: `${blocks.join('\n\n')}\n` }]
  },
})
