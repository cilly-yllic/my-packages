import { findModel, Ir, IrApi, IrApiPayload, IrField, ScalarType } from '../../ir/ir.js'
import { pascalCase, singleQuote } from '../support/naming.js'
import { isRelation, relationFkName } from '../support/relations.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'

const SCALAR_TS: Record<ScalarType, string> = {
  string: 'string',
  int: 'number',
  int64: 'number',
  float: 'number',
  boolean: 'boolean',
  timestamp: 'string',
  date: 'string',
  json: 'unknown',
  id: 'string',
}

const payloadFields = (ir: Ir, payload: IrApiPayload): IrField[] =>
  payload.model ? (findModel(ir, payload.model)?.fields ?? []) : payload.fields

const propType = (ir: Ir, field: IrField): string => {
  let base: string
  if (isRelation(field)) {
    base = 'string'
  } else if (field.type.kind === 'scalar') {
    base = SCALAR_TS[field.type.name]
  } else if (field.type.kind === 'enum') {
    const enumName = field.type.name
    const irEnum = ir.enums.find(e => e.name === enumName)
    base = irEnum ? irEnum.values.map(singleQuote).join(' | ') : 'string'
  } else {
    base = 'unknown'
  }
  return field.list ? `${base}[]` : base
}

/** Emit class-validator decorators for a field, tracking which need importing. */
const decoratorsFor = (ir: Ir, field: IrField, used: Set<string>): string[] => {
  const c = field.constraints
  const each = field.list ? '{ each: true }' : ''
  const add = (name: string, args = ''): string => {
    used.add(name)
    return `  @${name}(${args})`
  }
  const out: string[] = []
  if (field.optional) out.push(add('IsOptional'))
  if (field.list) out.push(add('IsArray'))

  if (isRelation(field) || (field.type.kind === 'scalar' && (field.type.name === 'string' || field.type.name === 'id'))) {
    out.push(add('IsString', each))
  } else if (field.type.kind === 'scalar' && (field.type.name === 'int' || field.type.name === 'int64')) {
    out.push(add('IsInt', each))
  } else if (field.type.kind === 'scalar' && field.type.name === 'float') {
    out.push(add('IsNumber', each ? `{}, ${each}` : ''))
  } else if (field.type.kind === 'scalar' && field.type.name === 'boolean') {
    out.push(add('IsBoolean', each))
  } else if (field.type.kind === 'scalar' && (field.type.name === 'timestamp' || field.type.name === 'date')) {
    out.push(add('IsDateString', each))
  } else if (field.type.kind === 'enum') {
    const enumName = field.type.name
    const irEnum = ir.enums.find(e => e.name === enumName)
    const values = irEnum ? `[${irEnum.values.map(singleQuote).join(', ')}]` : '[]'
    out.push(add('IsIn', each ? `${values}, ${each}` : values))
  }

  if (field.list) {
    if (c.nonempty) out.push(add('ArrayNotEmpty'))
    if (c.minLength !== undefined) out.push(add('ArrayMinSize', String(c.minLength)))
    if (c.maxLength !== undefined) out.push(add('ArrayMaxSize', String(c.maxLength)))
  } else {
    if (c.nonempty) out.push(add('IsNotEmpty'))
    if (c.minLength !== undefined) out.push(add('MinLength', String(c.minLength)))
    if (c.maxLength !== undefined) out.push(add('MaxLength', String(c.maxLength)))
    if (c.min !== undefined) out.push(add('Min', String(c.min)))
    if (c.max !== undefined) out.push(add('Max', String(c.max)))
    if (c.email) out.push(add('IsEmail'))
    if (c.url) out.push(add('IsUrl'))
    if (c.pattern) out.push(add('Matches', `/${c.pattern}/`))
  }
  return out
}

const renderDto = (ir: Ir, api: IrApi, used: Set<string>): string => {
  const fields = payloadFields(ir, api.request)
  const className = `${pascalCase(api.name)}Dto`
  if (api.request.isVoid || fields.length === 0) {
    return `export class ${className} {}`
  }
  const members = fields
    .map(field => {
      const name = isRelation(field) ? relationFkName(field) : field.name
      const decorators = decoratorsFor(ir, field, used).join('\n')
      const mark = field.optional ? '?' : '!'
      return `${decorators}\n  ${name}${mark}: ${propType(ir, field)}`
    })
    .join('\n\n')
  return `export class ${className} {\n${members}\n}`
}

/**
 * Generates class-validator DTO classes for API endpoint requests, mirroring the
 * hand-written NestJS DTOs (decorators derived from field type +
 * constraints). Complements the Zod request schemas for a NestJS ValidationPipe.
 */
export const createApiDtoGenerator = (): Generator => ({
  name: 'api-dto',
  description: 'class-validator DTO classes for API requests',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    if (ir.apis.length === 0) {
      return []
    }
    const used = new Set<string>()
    const dtoBlocks = ir.apis.map(api => renderDto(ir, api, used))
    const blocks: string[] = [...headerBlocks(context)]
    if (used.size > 0) {
      blocks.push(`import { ${[...used].sort().join(', ')} } from 'class-validator'`)
    }
    blocks.push(...dtoBlocks)
    return [{ path: 'api-dtos.ts', content: `${blocks.join('\n\n')}\n` }]
  },
})
