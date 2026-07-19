import { findEnum, findModel, Ir, IrEnum, IrField, IrFirestoreDoc, IrModel, ScalarType } from '../../ir/ir.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { zodConstraints } from '../support/constraints.js'
import { headerBlocks } from '../support/header.js'
import { camelCase, constantCase, pluralize, singleQuote } from '../support/naming.js'
import { isRelation, relationFkName } from '../support/relations.js'
import { collectDeps, kebabCase, tableNameOf } from '../support/split.js'
import { outputFile } from '../support/templates.js'

// Projection-level scalars: timestamps become dates, ids/relations become
// resolved (hashids-encoded) string ids.
const SCALAR_FS: Record<ScalarType, string> = {
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

// Embedded value objects keep the stricter Zod chains (`.int()` etc.).
const SCALAR_EMBEDDED: Record<ScalarType, string> = {
  ...SCALAR_FS,
  int: 'z.number().int()',
  int64: 'z.number().int()',
}

const META_FILE = `import { z } from 'zod'

/**
 * Cloud Task 整合性管理用の operation 識別子メタ。
 * 整合性回復 (reconciliation) 処理の最新世代を表す。
 */
export const _Meta_OperationSchema = z.object({
  /** opId (operation id) */
  id: z.string(),
  /** 整合性回復処理の識別子 */
  identifierId: z.string(),
  /** unixtime (最終更新) */
  updatedAt: z.number(),
})
export type _Meta_Operation = z.infer<typeof _Meta_OperationSchema>

/**
 * 全 Firestore document に付ける整合性管理メタ。
 *
 * - \`scope\`: app hosting 経由で set される unixtime
 * - \`sys\`:   cloud functions / cloud task 経由で set される unixtime
 * - \`op\`:    cloud task で set される operation メタ
 */
export const _Meta_Schema = z.object({
  scope: z.number().nullable(),
  sys: z.number().nullable(),
  op: _Meta_OperationSchema.nullable(),
})
export type _Meta_ = z.infer<typeof _Meta_Schema>
`

const lineComments = (description: string | undefined, indent: string): string[] =>
  description ? description.split('\n').map(line => `${indent}// ${line}`.trimEnd()) : []

const jsdoc = (description: string | undefined, indent: string): string[] => {
  if (!description) return []
  const lines = description.split('\n')
  if (lines.length === 1) return [`${indent}/** ${lines[0]} */`]
  return [`${indent}/**`, ...lines.map(line => `${indent} * ${line}`.trimEnd()), `${indent} */`]
}

const fsEnumName = (irEnum: IrEnum): string => irEnum.fsName ?? irEnum.name

const fsModelName = (ir: Ir, name: string): string => findModel(ir, name)?.fsName ?? name

/**
 * Frozen const object + Key/value types + Zod enum referencing the const —
 * the hand-maintained representation this generator standardizes on.
 */
const renderFsEnum = (irEnum: IrEnum): string => {
  const name = fsEnumName(irEnum)
  const constName = constantCase(name)
  const keyOf = (value: string): string => irEnum.valueKeys?.[value] ?? constantCase(value)
  const entries = irEnum.values.map(value => `  ${keyOf(value)}: ${singleQuote(value)},`)
  const schemaValues = irEnum.values.map(value => `  ${constName}.${keyOf(value)},`)
  return [
    ...lineComments(irEnum.fsDescription ?? irEnum.description, ''),
    `export const ${constName} = Object.freeze({`,
    ...entries,
    `} as const)`,
    `export type ${name}Key = keyof typeof ${constName}`,
    `export type ${name} = (typeof ${constName})[${name}Key]`,
    `export const ${name}Schema = z.enum([`,
    ...schemaValues,
    `])`,
  ].join('\n')
}

/** Zod chain for one field of an embedded value object. */
const embeddedFieldSchema = (ir: Ir, field: IrField): string => {
  let base: string
  if (field.type.kind === 'scalar') base = SCALAR_EMBEDDED[field.type.name]
  else if (field.type.kind === 'enum') {
    const irEnum = findEnum(ir, field.type.name)
    base = irEnum ? `${fsEnumName(irEnum)}Schema` : 'z.string()'
  } else if (field.type.kind === 'model') base = `${fsModelName(ir, field.type.name)}Schema`
  else base = 'z.unknown()'
  let schema = field.list ? `z.array(${base})${zodConstraints(field)}` : `${base}${zodConstraints(field)}`
  if (field.default !== undefined) schema = `${schema}.default(${JSON.stringify(field.default)})`
  if (field.nullable) schema = `${schema}.nullable()`
  if (field.optional) schema = `${schema}.optional()`
  return schema
}

const renderEmbeddedModel = (ir: Ir, model: IrModel): string => {
  const lines: string[] = []
  const desc = model.description ?? ''
  const name = model.fsName ?? model.name
  lines.push(...(desc.includes('\n') ? jsdoc(desc, '') : lineComments(desc || undefined, '')))
  lines.push(`export const ${name}Schema = z.object({`)
  for (const field of model.fields) {
    lines.push(...jsdoc(field.description, '  '))
    lines.push(`  ${field.name}: ${embeddedFieldSchema(ir, field)},`)
  }
  lines.push('})')
  lines.push(`export type ${name} = z.infer<typeof ${name}Schema>`)
  return lines.join('\n')
}

// zod-split と同じ DC 側チェーン。FS 側と文字列一致するフィールドは
// `.pick()` で DC スキーマから流用できる。
const SCALAR_DC: Record<ScalarType, string> = {
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

const dcFieldChain = (ir: Ir, field: IrField): string => {
  const base = isRelation(field)
    ? SCALAR_DC[
        (findModel(ir, field.type.kind === 'model' ? field.type.name : '')?.fields.find(f => f.isId)?.type as
          | { kind: 'scalar'; name: ScalarType }
          | undefined)?.name ?? 'string'
      ]
    : field.type.kind === 'scalar'
      ? SCALAR_DC[field.type.name]
      : field.type.kind === 'enum'
        ? `${field.type.name}Schema`
        : 'z.unknown()'
  let chain = field.list ? `z.array(${base})${zodConstraints(field)}` : `${base}${zodConstraints(field)}`
  if (field.nullable) chain = `${chain}.nullable()`
  if (field.optional) chain = `${chain}.optional()`
  return chain
}

/** Zod chain for a base (picked) Data Connect field in the projection. */
const baseFieldSchema = (ir: Ir, field: IrField): { name: string; schema: string } => {
  const name = isRelation(field) ? relationFkName(field) : field.name
  let base: string
  if (isRelation(field)) base = 'z.string()' // resolved, encoded foreign-key id
  else if (field.type.kind === 'enum') {
    const irEnum = findEnum(ir, field.type.name)
    base = irEnum ? `${fsEnumName(irEnum)}Schema` : 'z.string()'
  } else if (field.type.kind === 'scalar') base = SCALAR_FS[field.type.name]
  else if (field.type.kind === 'model') base = `${fsModelName(ir, field.type.name)}Schema`
  else base = 'z.unknown()'
  let schema = field.list ? `z.array(${base})` : base
  if (field.optional) schema = `${schema}.nullable()`
  return { name, schema }
}

/** Zod chain for a projection-specific (added/overriding) field. */
const overrideFieldSchema = (ir: Ir, field: IrField): { name: string; schema: string } => {
  const name = isRelation(field) ? relationFkName(field) : field.name
  let base: string
  if (field.type.kind === 'enum') {
    const irEnum = findEnum(ir, field.type.name)
    base = irEnum ? `${fsEnumName(irEnum)}Schema` : 'z.string()'
  } else if (field.type.kind === 'scalar') base = SCALAR_FS[field.type.name]
  else if (field.type.kind === 'model') base = `${fsModelName(ir, field.type.name)}Schema`
  else base = 'z.unknown()'
  let schema = field.list ? `z.array(${base})` : base
  if (field.default !== undefined) schema = `${schema}.default(${JSON.stringify(field.default)})`
  if (field.nullable) schema = `${schema}.nullable()`
  if (field.optional) schema = `${schema}.optional()`
  return { name, schema }
}

interface RenderedField {
  comments: string[]
  entry: string
  name: string
  /** DC 側と zod チェーンが一致し、`.pick()` で流用できる base フィールド。 */
  pickable: boolean
}

const effectiveFields = (ir: Ir, doc: IrFirestoreDoc): { rendered: RenderedField[]; roots: IrField[] } => {
  const base = doc.from ? findModel(ir, doc.from) : undefined
  let baseFields = base?.fields ?? []
  if (doc.pick.length > 0) {
    // Pick order is authoritative for the projected field order.
    baseFields = doc.pick
      .map(name => baseFields.find(field => field.name === name))
      .filter((field): field is IrField => Boolean(field))
  } else if (doc.omit.length > 0) {
    baseFields = baseFields.filter(field => !doc.omit.includes(field.name))
  }

  // Insertion order = base fields, then added/overriding fields (override keeps position).
  const entries = new Map<string, RenderedField>()
  const roots: IrField[] = []
  for (const field of baseFields) {
    const { name, schema } = baseFieldSchema(ir, field)
    const pickable = dcFieldChain(ir, field) === schema
    entries.set(name, { comments: [], entry: `  ${name}: ${schema},`, name, pickable })
    roots.push(field)
  }
  for (const field of doc.fields) {
    const { name, schema } = overrideFieldSchema(ir, field)
    const comments = field.jsdoc ? jsdoc(field.description, '  ') : lineComments(field.description, '  ')
    entries.set(name, { comments, entry: `  ${name}: ${schema},`, name, pickable: false })
    roots.push(field)
  }
  return { rendered: [...entries.values()], roots }
}

const docModuleName = (doc: IrFirestoreDoc): string => camelCase(pluralize(doc.name))

/**
 * Split variant of the Firestore projection generator, mirroring the
 * hand-maintained `libs/types/src/schema/firestore/*` layout: one file per
 * projection at `firestore/<collectionName>.ts`, FS-only enums (frozen consts)
 * and embedded value objects co-located at their first referencing projection,
 * the `_meta_` envelope under `firestore/_/`, and a `firestore.ts` barrel that
 * also carries the `FIRESTORE_DATABASES` constants.
 */
export const createFirestoreSplitLayout = (): Generator => ({
  name: 'firestore',
  description: 'Firestore projection Zod schemas, one file per collection (firestore/<name>.ts + firestore.ts barrel)',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    if (ir.firestore.length === 0) return []
    const files: GeneratedFile[] = []

    // Co-locate each referenced enum / embedded model at its first referencing doc.
    const enumHome = new Map<string, string>()
    const modelHome = new Map<string, string>()
    const docDeps = new Map<string, { enums: string[]; models: string[] }>()
    for (const doc of ir.firestore) {
      const { roots } = effectiveFields(ir, doc)
      const pseudo: IrModel = { name: `__${doc.name}`, fields: roots, key: [], indexes: [] }
      const collected = collectDeps(ir, [pseudo])
      const included = (doc.include ?? []).filter(name => !collected.models.includes(name))
      const deps = { enums: collected.enums, models: [...included, ...collected.models] }
      docDeps.set(doc.name, deps)
      const moduleName = docModuleName(doc)
      for (const name of deps.enums) if (!enumHome.has(name)) enumHome.set(name, moduleName)
      for (const name of deps.models) if (!modelHome.has(name)) modelHome.set(name, moduleName)
    }

    for (const doc of ir.firestore) {
      const moduleName = docModuleName(doc)
      const deps = docDeps.get(doc.name) ?? { enums: [], models: [] }
      const blocks: string[] = [...headerBlocks(context), "import { z } from 'zod'"]

      // Sibling imports: _meta_ plus enums/embedded schemas hosted elsewhere.
      const external = new Map<string, Set<string>>()
      for (const name of deps.enums) {
        const home = enumHome.get(name)
        if (home && home !== moduleName) {
          const irEnum = findEnum(ir, name)
          const set = external.get(home) ?? new Set<string>()
          set.add(`${irEnum ? fsEnumName(irEnum) : name}Schema`)
          external.set(home, set)
        }
      }
      for (const name of deps.models) {
        const home = modelHome.get(name)
        if (home && home !== moduleName) {
          const set = external.get(home) ?? new Set<string>()
          set.add(`${fsModelName(ir, name)}Schema`)
          external.set(home, set)
        }
      }
      const importLines = [...external.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([home, symbols]) => `import { ${[...symbols].sort().join(', ')} } from './${home}'`)
      if (doc.meta) importLines.unshift(`import { _Meta_Schema } from './_'`)
      // Fields whose Zod chain is identical to the Data Connect schema are
      // picked from it (single definition); only representation changes extend.
      const baseModel = doc.from ? findModel(ir, doc.from) : undefined
      const { rendered } = effectiveFields(ir, doc)
      const pickNames = baseModel ? rendered.filter(f => f.pickable).map(f => f.name) : []
      if (baseModel && pickNames.length > 0) {
        importLines.unshift(
          `import { ${baseModel.name}Schema as Dc${baseModel.name}Schema } from '../schemas/${kebabCase(tableNameOf(baseModel))}'`
        )
      }
      if (importLines.length > 0) blocks.push(importLines.join('\n'))

      for (const name of deps.enums) {
        if (enumHome.get(name) !== moduleName) continue
        const irEnum = findEnum(ir, name)
        if (irEnum) blocks.push(renderFsEnum(irEnum))
      }
      for (const name of deps.models) {
        if (modelHome.get(name) !== moduleName) continue
        const model = findModel(ir, name)
        if (model) blocks.push(renderEmbeddedModel(ir, model))
      }
      if (doc.helpers) blocks.push(doc.helpers)

      const lines: string[] = []
      if (doc.collection) lines.push(`// ${doc.collection}`)
      lines.push(...lineComments(doc.description, ''))
      if (baseModel && pickNames.length > 0) {
        // DC スキーマと同一表現のフィールドは pick で流用し、FS で表現が変わる
        // もの（timestamp→Date, optional→nullable, encode 済み id 等）だけ extend する。
        lines.push(`export const ${doc.name}Schema = Dc${baseModel.name}Schema.pick({`)
        for (const name of pickNames) lines.push(`  ${name}: true,`)
        lines.push(`}).extend({`)
        for (const field of rendered) {
          if (field.pickable) continue
          lines.push(...field.comments)
          lines.push(field.entry)
        }
        if (doc.meta) lines.push('  _meta_: _Meta_Schema,')
        lines.push('})')
      } else {
        lines.push(`export const ${doc.name}Schema = z.object({`)
        for (const field of rendered) {
          lines.push(...field.comments)
          lines.push(field.entry)
        }
        if (doc.meta) lines.push('  _meta_: _Meta_Schema,')
        lines.push('})')
      }
      lines.push(`export type ${doc.name} = z.infer<typeof ${doc.name}Schema>`)
      blocks.push(lines.join('\n'))

      files.push({ path: `firestore/${moduleName}.ts`, content: `${blocks.join('\n\n')}\n` })
    }

    if (ir.firestore.some(doc => doc.meta)) {
      files.push({ path: 'firestore/_/_meta_.ts', content: META_FILE })
      files.push({ path: 'firestore/_/index.ts', content: `export * from './_meta_'\n` })
    }

    // Barrel: database name constants (when the project defines services) + re-exports.
    const barrel: string[] = [...headerBlocks(context)]
    const services = ir.project?.services ?? []
    if (services.length > 0) {
      const entries = services.map(s => `  ${constantCase(s.name)}: ${singleQuote(s.database ?? s.name)},`)
      barrel.push(
        [
          '/** Firestore database 名定数 (firebase.json と同期させること) */',
          'export const FIRESTORE_DATABASES = Object.freeze({',
          ...entries,
          '} as const)',
          'export type FirestoreDatabaseKey = keyof typeof FIRESTORE_DATABASES',
          'export type FirestoreDatabaseId = (typeof FIRESTORE_DATABASES)[FirestoreDatabaseKey]',
        ].join('\n')
      )
    }
    const exportLines = ir.firestore.map(doc => `export * from './firestore/${docModuleName(doc)}'`)
    if (ir.firestore.some(doc => doc.meta)) exportLines.push(`export * from './firestore/_'`)
    barrel.push(['// Zod schema / TypeScript 型のエクスポート', ...exportLines].join('\n'))
    files.push({ path: outputFile(context, 'firestore.ts'), content: `${barrel.join('\n\n')}\n` })
    return files
  },
})
