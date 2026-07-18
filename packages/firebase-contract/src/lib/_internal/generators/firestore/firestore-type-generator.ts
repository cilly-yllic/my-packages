import { IrField, IrTypeRef, Ir, ScalarType } from '../../ir/ir.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'
import { isRelation, relationFkName, relationFkType } from '../support/relations.js'

export interface FirestoreGeneratorOptions {
  /** Module to import `Timestamp` from. Defaults to `firebase/firestore`. */
  timestampImport?: string
}

const scalarMap = (): Record<ScalarType, string> => ({
  string: 'string',
  int: 'number',
  int64: 'number',
  float: 'number',
  boolean: 'boolean',
  timestamp: 'Timestamp',
  date: 'Timestamp',
  json: 'Json',
  id: 'string',
})

const JSON_TYPE = [
  'export type Json =',
  '  | string',
  '  | number',
  '  | boolean',
  '  | null',
  '  | Json[]',
  '  | { [key: string]: Json }',
].join('\n')

const renderRef = (ref: IrTypeRef, scalars: Record<ScalarType, string>): string => {
  switch (ref.kind) {
    case 'scalar':
      return scalars[ref.name]
    case 'enum':
    case 'model':
      return ref.name
    default:
      return 'unknown'
  }
}

const renderField = (field: IrField, scalars: Record<ScalarType, string>, ir: Ir): string => {
  const optional = field.optional ? '?' : ''
  const doc = field.description ? `  /** ${field.description} */\n` : ''
  // Firestore projections store relations as resolved foreign-key ids.
  if (isRelation(field)) {
    const base = scalars[relationFkType(ir, field)]
    const type = field.list ? `${base}[]` : base
    return `${doc}  ${relationFkName(field)}${optional}: ${type}`
  }
  const base = renderRef(field.type, scalars)
  const type = field.list ? `${base}[]` : base
  return `${doc}  ${field.name}${optional}: ${type}`
}

const usesTimestamp = (ir: Ir): boolean =>
  ir.models.some(model =>
    model.fields.some(field => field.type.kind === 'scalar' && (field.type.name === 'timestamp' || field.type.name === 'date'))
  )

const usesJson = (ir: Ir): boolean =>
  ir.models.some(model => model.fields.some(field => field.type.kind === 'scalar' && field.type.name === 'json'))

/**
 * Generates Firestore-oriented TypeScript document types: `timestamp`/`date`
 * map to the Firestore `Timestamp` class and each model gets a `WithId` helper
 * for reading documents that carry their id.
 */
export const createFirestoreTypeGenerator = (options: FirestoreGeneratorOptions = {}): Generator => {
  const timestampImport = options.timestampImport ?? 'firebase/firestore'
  const scalars = scalarMap()

  return {
    name: 'firestore-types',
    description: 'Firestore document TypeScript types',
    generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
      const blocks: string[] = [...headerBlocks(context)]

      if (usesTimestamp(ir)) {
        blocks.push(`import { Timestamp } from '${timestampImport}'`)
      }
      if (usesJson(ir)) {
        blocks.push(JSON_TYPE)
      }

      blocks.push('export type WithId<T> = T & { id: string }')

      for (const irEnum of ir.enums) {
        const union = irEnum.values.map(value => `'${value}'`).join(' | ') || 'never'
        blocks.push(`export type ${irEnum.name} = ${union}`)
      }

      for (const model of ir.models) {
        const doc = model.description ? `/** ${model.description} */\n` : ''
        const fields = model.fields.map(field => renderField(field, scalars, ir)).join('\n')
        blocks.push(`${doc}export interface ${model.name} {\n${fields}\n}`)
      }

      return [{ path: 'firestore-types.ts', content: `${blocks.join('\n\n')}\n` }]
    },
  }
}
