import { findModel, Ir, IrField, IrFirestoreDoc, ScalarType } from '../../ir/ir.js'
import { singleQuote } from '../support/naming.js'
import { isRelation, relationFkName } from '../support/relations.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'
import { outputFile } from '../support/templates.js'

// Firestore stores timestamps as dates and represents relations as resolved
// (hashids-encoded) string ids, regardless of the Data Connect id's type.
const SCALAR_ZOD: Record<ScalarType, string> = {
  string: 'z.string()',
  int: 'z.number()',
  int64: 'z.number()',
  float: 'z.number()',
  boolean: 'z.boolean()',
  timestamp: 'z.date()',
  date: 'z.date()',
  json: 'z.unknown()',
  id: 'z.string()',
}

const META_BLOCK = [
  'export const _Meta_OperationSchema = z.object({',
  '  id: z.string(),',
  '  identifierId: z.string(),',
  '  updatedAt: z.number(),',
  '})',
  'export const _Meta_Schema = z.object({',
  '  scope: z.number().nullable(),',
  '  sys: z.number().nullable(),',
  '  op: _Meta_OperationSchema.nullable(),',
  '})',
  'export type _Meta_ = z.infer<typeof _Meta_Schema>',
].join('\n')

interface FsField {
  name: string
  schema: string
}

const fsField = (ir: Ir, field: IrField): FsField => {
  const name = isRelation(field) ? relationFkName(field) : field.name
  let schema: string
  if (isRelation(field)) {
    schema = 'z.string()' // resolved, encoded foreign-key id
  } else if (field.type.kind === 'enum') {
    const irEnum = ir.enums.find(e => e.name === field.type.name)
    schema = irEnum ? `z.enum([${irEnum.values.map(singleQuote).join(', ')}])` : 'z.string()'
  } else if (field.type.kind === 'scalar') {
    schema = SCALAR_ZOD[field.type.name]
  } else {
    // embedded model or unresolved: kept opaque in the projection.
    schema = 'z.unknown()'
  }
  if (field.list) schema = `z.array(${schema})`
  if (field.optional) schema = `${schema}.nullable()`
  return { name, schema }
}

const effectiveFields = (ir: Ir, doc: IrFirestoreDoc): FsField[] => {
  const base = doc.from ? findModel(ir, doc.from) : undefined
  let baseFields = base?.fields ?? []
  if (doc.pick.length > 0) {
    baseFields = baseFields.filter(field => doc.pick.includes(field.name))
  } else if (doc.omit.length > 0) {
    baseFields = baseFields.filter(field => !doc.omit.includes(field.name))
  }
  // Insertion order = base fields, then added/overriding fields (override keeps position).
  const entries = new Map<string, string>()
  for (const field of baseFields) {
    const { name, schema } = fsField(ir, field)
    entries.set(name, schema)
  }
  for (const field of doc.fields) {
    const { name, schema } = fsField(ir, field)
    entries.set(name, schema)
  }
  return [...entries].map(([name, schema]) => ({ name, schema }))
}

const renderDoc = (ir: Ir, doc: IrFirestoreDoc): string => {
  const lines: string[] = []
  if (doc.collection) lines.push(`// ${doc.collection}`)
  else if (doc.description) lines.push(`// ${doc.description}`)
  const fields = effectiveFields(ir, doc).map(field => `  ${field.name}: ${field.schema},`)
  if (doc.meta) fields.push('  _meta_: _Meta_Schema,')
  lines.push(`export const ${doc.name}Schema = z.object({\n${fields.join('\n')}\n})`)
  lines.push(`export type ${doc.name} = z.infer<typeof ${doc.name}Schema>`)
  return lines.join('\n')
}

/**
 * Generates Firestore projection Zod schemas. Each projection derives from a
 * Data Connect model (`from`) and applies the projection reality: relations
 * become resolved string ids, timestamps become `z.date()`, optional fields use
 * `.nullable()`, a `_meta_` consistency envelope is attached, and inline fields
 * add denormalized data (e.g. flattened graph edges) — mirroring a
 * hand-written Firestore schema library.
 */
export const createFirestoreProjectionGenerator = (): Generator => ({
  name: 'firestore',
  description: 'Firestore projection Zod schemas (derived from Data Connect models)',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    if (ir.firestore.length === 0) {
      return []
    }
    const blocks: string[] = [...headerBlocks(context), "import { z } from 'zod'"]
    if (ir.firestore.some(doc => doc.meta)) {
      blocks.push(META_BLOCK)
    }
    for (const doc of ir.firestore) {
      blocks.push(renderDoc(ir, doc))
    }
    return [{ path: outputFile(context, 'firestore.ts'), content: `${blocks.join('\n\n')}\n` }]
  },
})
