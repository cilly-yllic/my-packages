import { IrEnum, IrField, IrTypeRef, Ir, ScalarType } from '../../ir/ir.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'
import { withSplitVariant } from '../support/split-variant.js'
import { createTypeScriptSplitLayout } from './typescript-split-generator.js'
import { constantCase, singleQuote } from '../support/naming.js'
import { isRelation, relationFkName, relationFkType } from '../support/relations.js'
import { outputFile } from '../support/templates.js'

export interface TypeScriptGeneratorOptions {
  /**
   * How enums are emitted. `const` (default) produces a frozen const object plus
   * a `Key` type and a value type — giving runtime values and types from one
   * source. `union` produces a plain
   * string-literal union.
   */
  enumStyle?: 'const' | 'union'
}

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

const renderFieldType = (field: IrField): string => {
  const base = renderRef(field.type)
  return field.list ? `${base}[]` : base
}

const renderField = (field: IrField, ir: Ir): string => {
  const optional = field.optional ? '?' : ''
  const doc = field.description ? `  /** ${field.description} */\n` : ''
  if (field.literal !== undefined) {
    const type = field.list ? `${singleQuote(field.literal)}[]` : singleQuote(field.literal)
    return `${doc}  ${field.name}${optional}: ${type}`
  }
  // Relation: expose the foreign-key id (matching the persisted/projected shape).
  if (isRelation(field)) {
    const base = SCALAR_TS[relationFkType(ir, field)]
    const type = field.list ? `${base}[]` : base
    return `${doc}  ${relationFkName(field)}${optional}: ${type}`
  }
  return `${doc}  ${field.name}${optional}: ${renderFieldType(field)}`
}

const usesJson = (ir: Ir): boolean =>
  ir.models.some(model => model.fields.some(field => field.type.kind === 'scalar' && field.type.name === 'json'))

const renderEnumUnion = (irEnum: IrEnum): string => {
  const doc = irEnum.description ? `/** ${irEnum.description} */\n` : ''
  const union = irEnum.values.map(value => singleQuote(value)).join(' | ') || 'never'
  return `${doc}export type ${irEnum.name} = ${union}`
}

const renderEnumConst = (irEnum: IrEnum): string => {
  const doc = irEnum.description ? `/** ${irEnum.description} */\n` : ''
  const constName = constantCase(irEnum.name)
  const entries = irEnum.values.map(value => `  ${constantCase(value)}: ${singleQuote(value)},`).join('\n')
  return [
    `${doc}export const ${constName} = Object.freeze({`,
    entries,
    `} as const)`,
    `export type ${irEnum.name}Key = keyof typeof ${constName}`,
    `export type ${irEnum.name} = (typeof ${constName})[${irEnum.name}Key]`,
  ].join('\n')
}

/**
 * Generates TypeScript types: an interface per model and, per enum, either a
 * frozen const object (default — runtime values + `Key`/value types) or a
 * plain string-literal union. This is the highest-priority
 * generator and the shape other TS-facing generators reference.
 */
export const createTypeScriptGenerator = (options: TypeScriptGeneratorOptions = {}): Generator => {
  const enumStyle = options.enumStyle ?? 'const'
  return withSplitVariant(
    {
  name: 'typescript',
  description: 'TypeScript interfaces and enum const/union types',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    const blocks: string[] = [...headerBlocks(context)]

    if (usesJson(ir)) {
      blocks.push(JSON_TYPE)
    }

    for (const irEnum of ir.enums) {
      blocks.push(enumStyle === 'const' ? renderEnumConst(irEnum) : renderEnumUnion(irEnum))
    }

    for (const model of ir.models) {
      const doc = model.description ? `/** ${model.description} */\n` : ''
      const fields = model.fields.map(field => renderField(field, ir)).join('\n')
      blocks.push(`${doc}export interface ${model.name} {\n${fields}\n}`)
    }

    return [{ path: outputFile(context, 'types.ts'), content: `${blocks.join('\n\n')}\n` }]
  },
    },
    createTypeScriptSplitLayout()
  )
}
