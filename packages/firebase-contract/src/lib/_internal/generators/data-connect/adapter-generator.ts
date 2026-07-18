import { IrField, IrModel, IrTypeRef, Ir, ScalarType } from '../../ir/ir.js'
import { camelCase } from '../support/naming.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'
import { isRelation, relationFkName, relationFkType } from '../support/relations.js'

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

/**
 * Whether the field collapses to `Any` in Data Connect (json or *embedded*
 * model). Relations are FK id scalars, not `Any`, so they are excluded.
 */
const isAnyBacked = (field: IrField): boolean =>
  (field.type.kind === 'model' && !isRelation(field)) ||
  field.type.kind === 'unresolved' ||
  (field.type.kind === 'scalar' && field.type.name === 'json')

/** The property name of the field on both the row and the logical type. */
const fieldKey = (field: IrField): string => (isRelation(field) ? relationFkName(field) : field.name)

const logicalBase = (ref: IrTypeRef): string => {
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

const withList = (base: string, list: boolean): string => (list ? `${base}[]` : base)

const rowFieldType = (field: IrField, ir: Ir): string => {
  if (field.literal !== undefined) {
    return withList(`'${field.literal}'`, field.list)
  }
  if (isRelation(field)) {
    return withList(SCALAR_TS[relationFkType(ir, field)], field.list)
  }
  const base = isAnyBacked(field) ? 'Any' : logicalBase(field.type)
  return withList(base, field.list)
}

const optionalMark = (field: IrField): string => (field.optional ? '?' : '')

/** Expression that maps a Data Connect row field back to the logical value. */
const fromExpr = (field: IrField): string => {
  const access = `row.${fieldKey(field)}`
  if (!isAnyBacked(field)) {
    return access
  }
  const base = logicalBase(field.type)
  const one = (value: string): string => `fromAny<${base}>(${value})`
  if (field.list) {
    const mapped = `${access}${field.optional ? '?' : ''}.map(item => ${one('item')})`
    return mapped
  }
  if (field.optional) {
    return `${access} === undefined ? undefined : ${one(access)}`
  }
  return one(access)
}

/** Expression that maps a logical value to the Data Connect row field. */
const toExpr = (field: IrField): string => {
  const access = `value.${fieldKey(field)}`
  if (!isAnyBacked(field)) {
    return access
  }
  if (field.list) {
    return `${access}${field.optional ? '?' : ''}.map(item => toAny(item))`
  }
  if (field.optional) {
    return `${access} === undefined ? undefined : toAny(${access})`
  }
  return `toAny(${access})`
}

const renderRowInterface = (model: IrModel, ir: Ir): string => {
  const fields = model.fields
    .map(field => `  ${fieldKey(field)}${optionalMark(field)}: ${rowFieldType(field, ir)}`)
    .join('\n')
  return `export interface ${model.name}Row {\n${fields}\n}`
}

const renderAdapter = (model: IrModel): string => {
  const adapterName = `${camelCase(model.name)}Adapter`
  const fromFields = model.fields.map(field => `      ${fieldKey(field)}: ${fromExpr(field)},`).join('\n')
  const toFields = model.fields.map(field => `      ${fieldKey(field)}: ${toExpr(field)},`).join('\n')
  return [
    `export const ${adapterName} = {`,
    `  fromDataConnect(row: ${model.name}Row): ${model.name} {`,
    `    return {`,
    fromFields,
    `    }`,
    `  },`,
    `  toDataConnect(value: ${model.name}): ${model.name}Row {`,
    `    return {`,
    toFields,
    `    }`,
    `  },`,
    `}`,
  ].join('\n')
}

/** Collect the logical type names the adapter references, to import from types.ts. */
const collectTypeImports = (ir: Ir): string[] => {
  const names = new Set<string>()
  for (const model of ir.models) {
    names.add(model.name)
    for (const field of model.fields) {
      const ref = field.type
      // Relations become scalar FK ids, so the related model type is not imported.
      if (ref.kind === 'enum' || (ref.kind === 'model' && !isRelation(field))) {
        names.add(ref.name)
      }
      if (ref.kind === 'scalar' && ref.name === 'json') {
        names.add('Json')
      }
    }
  }
  return [...names].sort()
}

/**
 * Generates typed adapters that convert between a Data Connect row (json and
 * embedded-model fields typed as `Any`) and the logical TypeScript type,
 * restoring the logical type through the runtime `fromAny`/`toAny` helpers.
 */
export const createDataConnectAdapterGenerator = (): Generator => ({
  name: 'data-connect-adapter',
  description: 'Adapters between Data Connect Any rows and logical types',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    const typeImports = collectTypeImports(ir)
    const blocks: string[] = [...headerBlocks(context)]

    if (typeImports.length > 0) {
      blocks.push(`import type { ${typeImports.join(', ')} } from './types'`)
    }
    blocks.push("import { fromAny, toAny, type Any } from 'firebase-contract/runtime'")

    for (const model of ir.models) {
      blocks.push(renderRowInterface(model, ir))
      blocks.push(renderAdapter(model))
    }

    return [{ path: 'data-connect-adapters.ts', content: `${blocks.join('\n\n')}\n` }]
  },
})
