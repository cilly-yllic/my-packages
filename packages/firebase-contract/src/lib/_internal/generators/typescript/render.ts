import { Ir, IrEnum, IrField, IrModel, IrTypeRef, ScalarType } from '../../ir/ir.js'
import { constantCase, singleQuote } from '../support/naming.js'
import { isRelation, relationFkName, relationFkType } from '../support/relations.js'

/**
 * Rendering shared by the bundled and split TypeScript layouts. Both layouts
 * MUST go through these helpers so a contract setting (valueKeys, nullable,
 * multi-line descriptions, …) means the same thing regardless of layout.
 */

export const SCALAR_TS: Record<ScalarType, string> = {
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

export const JSON_TYPE = [
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

export const docLines = (description: string | undefined, indent: string): string[] => {
  if (!description) return []
  const lines = description.split('\n')
  if (lines.length === 1) return [`${indent}/** ${lines[0]} */`]
  return [`${indent}/**`, ...lines.map(line => `${indent} * ${line}`.trimEnd()), `${indent} */`]
}

export const renderField = (field: IrField, ir: Ir): string => {
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

export const renderEnumConst = (irEnum: IrEnum): string => {
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

export const renderEnumUnion = (irEnum: IrEnum): string => {
  const doc = docLines(irEnum.description, '')
  const union = irEnum.values.map(value => singleQuote(value)).join(' | ') || 'never'
  return [...doc, `export type ${irEnum.name} = ${union}`].join('\n')
}

export const renderModel = (model: IrModel, ir: Ir): string => {
  const doc = docLines(model.description, '')
  const fields = model.fields.map(field => renderField(field, ir)).join('\n')
  return [...doc, `export interface ${model.name} {`, fields, '}'].join('\n')
}

export const usesJson = (models: IrModel[]): boolean =>
  models.some(model => model.fields.some(field => field.type.kind === 'scalar' && field.type.name === 'json'))
