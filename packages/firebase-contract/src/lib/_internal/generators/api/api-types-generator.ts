import { Ir, IrApi, IrApiPayload, IrField, ScalarType } from '../../ir/ir.js'
import { pascalCase } from '../support/naming.js'
import { isRelation, relationFkName, relationFkType } from '../support/relations.js'
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
  json: 'Json',
  id: 'string',
}

const renderFieldTsType = (ir: Ir, field: IrField): string => {
  let base: string
  if (isRelation(field)) {
    base = SCALAR_TS[relationFkType(ir, field)]
  } else if (field.type.kind === 'scalar') {
    base = SCALAR_TS[field.type.name]
  } else if (field.type.kind === 'enum' || field.type.kind === 'model') {
    base = field.type.name
  } else {
    base = 'unknown'
  }
  return field.list ? `${base}[]` : base
}

const renderField = (ir: Ir, field: IrField): string => {
  const name = isRelation(field) ? relationFkName(field) : field.name
  const optional = field.optional ? '?' : ''
  const doc = field.description ? `  /** ${field.description} */\n` : ''
  return `${doc}  ${name}${optional}: ${renderFieldTsType(ir, field)}`
}

const renderPayloadType = (ir: Ir, payload: IrApiPayload, typeName: string): string => {
  if (payload.isVoid) {
    return `export type ${typeName} = void`
  }
  if (payload.model) {
    return `export type ${typeName} = ${payload.model}`
  }
  if (payload.fields.length === 0) {
    return `export type ${typeName} = Record<string, never>`
  }
  const fields = payload.fields.map(field => renderField(ir, field)).join('\n')
  return `export interface ${typeName} {\n${fields}\n}`
}

const collectImports = (ir: Ir): string[] => {
  const names = new Set<string>()
  const add = (payload: IrApiPayload): void => {
    if (payload.model) names.add(payload.model)
    for (const field of payload.fields) {
      if (field.type.kind === 'enum' || (field.type.kind === 'model' && !isRelation(field))) {
        names.add(field.type.name)
      }
      if (field.type.kind === 'scalar' && field.type.name === 'json') {
        names.add('Json')
      }
    }
  }
  for (const api of ir.apis) {
    add(api.request)
    add(api.response)
  }
  return [...names].sort()
}

const apiComment = (api: IrApi): string => {
  const bits = [`kind: ${api.kind}`]
  if (api.method) bits.push(`method: ${api.method}`)
  if (api.description) bits.unshift(api.description)
  return `// ${api.name} — ${bits.join(' | ')}`
}

/**
 * Generates request/response TypeScript types for each API endpoint. A payload
 * can reference an existing model or declare inline fields; a void response maps
 * to `void`. This mirrors the shared producer/consumer contract pattern.
 */
export const createApiTypesGenerator = (): Generator => ({
  name: 'api-types',
  description: 'API request/response TypeScript types',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    if (ir.apis.length === 0) {
      return []
    }
    const blocks: string[] = [...headerBlocks(context)]
    const imports = collectImports(ir)
    if (imports.length > 0) {
      blocks.push(`import type { ${imports.join(', ')} } from './types.js'`)
    }
    for (const api of ir.apis) {
      const pascal = pascalCase(api.name)
      blocks.push(
        [
          apiComment(api),
          renderPayloadType(ir, api.request, `${pascal}Request`),
          renderPayloadType(ir, api.response, `${pascal}Response`),
        ].join('\n')
      )
    }
    return [{ path: 'api-types.ts', content: `${blocks.join('\n\n')}\n` }]
  },
})
