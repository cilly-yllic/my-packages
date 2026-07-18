import { IrEnum, IrField, IrModel, IrTypeRef, Ir, ScalarType } from '../../ir/ir.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'
import { constantCase, pluralize, snakeCase } from '../support/naming.js'
import { isRelation } from '../support/relations.js'

// Data Connect built-in scalars. `json` and embedded model objects are stored
// as `Any` — the logical type is preserved in a comment and restored by the
// Data Connect adapter generator.
const SCALAR_GQL: Record<ScalarType, string> = {
  string: 'String',
  int: 'Int',
  int64: 'Int64',
  float: 'Float',
  boolean: 'Boolean',
  timestamp: 'Timestamp',
  date: 'Date',
  json: 'Any',
  id: 'UUID',
}

interface RenderedType {
  gql: string
  /** Logical type retained when the physical type collapses to `Any`. */
  logical?: string
}

/** GraphQL name lookup: model/enum name → gqlName override (or itself). */
type Rename = Map<string, string>
const gqlOf = (rename: Rename, name: string): string => rename.get(name) ?? name

const renderRef = (ref: IrTypeRef, rename: Rename): RenderedType => {
  switch (ref.kind) {
    case 'scalar':
      return { gql: SCALAR_GQL[ref.name] }
    case 'enum':
      return { gql: gqlOf(rename, ref.name) }
    case 'model':
      return { gql: 'Any', logical: ref.name }
    default:
      return { gql: 'Any', logical: ref.name }
  }
}

const defaultExpr = (value: unknown): string => {
  if (typeof value === 'number' || typeof value === 'boolean') return `"${value}"`
  return `"'${String(value)}'"`
}

/** Derive the Data Connect column dataType for a field, if any. */
const colDataType = (field: IrField): string | undefined => {
  if (field.col) return field.col
  // Int64 surrogate primary keys map to bigserial.
  if (field.isId && field.type.kind === 'scalar' && (field.type.name === 'int' || field.type.name === 'int64')) return 'bigserial'
  return undefined
}

const fieldDirectives = (field: IrField): string => {
  const parts: string[] = []
  const col = colDataType(field)
  if (col) parts.push(`@col(dataType: "${col}")`)
  if (field.unique) parts.push('@unique')
  if (field.default !== undefined) parts.push(`@default(expr: ${defaultExpr(field.default)})`)
  return parts.length > 0 ? ` ${parts.join(' ')}` : ''
}

/** Render a (possibly multi-line) description as comment lines at `indent`. */
const commentLines = (description: string | undefined, indent: string): string[] =>
  description ? description.split('\n').map(line => `${indent}# ${line}`.trimEnd()) : []

const renderField = (field: IrField, rename: Rename): string => {
  const nullable = field.optional ? '' : '!'
  const directives = fieldDirectives(field)
  // Descriptions render as full comment lines above the field (matching real
  // Data Connect schema files), so multi-line descriptions survive verbatim.
  const above = commentLines(field.description, '  ')
  // Relation: emit a Data Connect relation to the related table (DC auto-creates
  // the FK column). This is distinct from an embedded model, which becomes `Any`.
  if (isRelation(field) && field.type.kind === 'model') {
    const gqlName = gqlOf(rename, field.type.name)
    const inner = field.list ? `[${gqlName}!]` : gqlName
    return [...above, `  ${field.name}: ${inner}${nullable}${directives}`].join('\n')
  }
  const { gql, logical } = renderRef(field.type, rename)
  const inner = field.list ? `[${gql}!]` : gql
  const trailing = logical ? ` # logical: ${logical}${field.list ? '[]' : ''}` : ''
  return [...above, `  ${field.name}: ${inner}${nullable}${directives}${trailing}`].join('\n')
}

const tableName = (model: IrModel): string => model.table ?? pluralize(snakeCase(model.name))

/**
 * Whether a model is a real table (has a primary key) as opposed to an embedded
 * value object (jsonb shape, union variant, …) which must NOT get a `@table`.
 */
const buildRename = (ir: Ir): Rename => {
  const rename: Rename = new Map()
  for (const m of ir.models) if (m.gqlName) rename.set(m.name, m.gqlName)
  for (const e of ir.enums) if (e.gqlName) rename.set(e.name, e.gqlName)
  return rename
}

const isTable = (model: IrModel): boolean => model.key.length > 0 || model.fields.some(f => f.isId)

/** The `@table(...)` directive plus any type-level `@unique`/`@index` directives. */
const tableDirectiveList = (model: IrModel): string[] => {
  const keyFields = model.key.length > 0 ? model.key : model.fields.filter(f => f.isId).map(f => f.name)
  const name = tableName(model)
  const args = [`name: "${name}"`]
  if (keyFields.length > 0) {
    args.push(`key: [${keyFields.map(f => `"${f}"`).join(', ')}]`)
  }
  const directives = [`@table(${args.join(', ')})`]
  for (const index of model.indexes) {
    const fieldsArg = `fields: [${index.fields.map(f => `"${f}"`).join(', ')}]`
    const kind = index.unique ? '@unique' : '@index'
    const nameArg = index.unique ? 'indexName' : 'name'
    const idxName = index.name ?? `${name}_${index.fields.join('_')}_${index.unique ? 'uidx' : 'idx'}`
    if (index.expand) {
      // Expanded argument form (one per line), matching hand-written files.
      directives.push(`${kind}(\n    ${fieldsArg}\n    ${nameArg}: "${idxName}"\n  )`)
    } else {
      directives.push(`${kind}(${fieldsArg}, ${nameArg}: "${idxName}")`)
    }
  }
  return directives
}

/** `type X @table(...) {` — or the multi-line per-directive form when requested. */
const typeHeader = (model: IrModel, gqlName: string): string => {
  const directives = tableDirectiveList(model)
  if (model.directives === 'multi') {
    return `type ${gqlName}\n  ${directives.join('\n  ')} {`
  }
  return `type ${gqlName} ${directives.join(' ')} {`
}

const commentBanner = (header: string): string =>
  header
    .split('\n')
    .map(line => line.replace(/^\/\/ ?/, '# '))
    .join('\n')

/**
 * Generates a Data Connect GraphQL schema (`type ... @table`). JSON and embedded
 * model fields become the `Any` scalar while retaining their logical type as a
 * comment, matching the "JSON is Any, logical type preserved" rule.
 */
export const createDataConnectGraphqlGenerator = (): Generator => ({
  name: 'data-connect-graphql',
  description: 'Data Connect GraphQL schema',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    const blocks: string[] = [...headerBlocks(context, commentBanner)]

    const usesAny = ir.models.some(model =>
      model.fields.some(
        field =>
          (field.type.kind === 'model' && !isRelation(field)) ||
          (field.type.kind === 'scalar' && field.type.name === 'json')
      )
    )
    if (usesAny) {
      blocks.push('scalar Any')
    }

    const rename = buildRename(ir)
    for (const irEnum of ir.enums) {
      blocks.push(renderEnumGql(irEnum, rename))
    }

    for (const model of ir.models.filter(isTable)) {
      const fields = model.fields.map(field => renderField(field, rename)).join('\n')
      const doc = commentLines(model.description, '')
      blocks.push([...doc, `${typeHeader(model, gqlOf(rename, model.name))}\n${fields}\n}`].join('\n'))
      if (model.footer) blocks.push(commentLines(model.footer, '').join('\n'))
    }

    return [{ path: 'schema.gql', content: `${blocks.join('\n\n')}\n` }]
  },
})

const renderEnumGql = (irEnum: IrEnum, rename: Rename): string => {
  const lines: string[] = [...commentLines(irEnum.description, '')]
  lines.push(`enum ${gqlOf(rename, irEnum.name)} {`)
  for (const value of irEnum.values) {
    lines.push(...commentLines(irEnum.valueComments?.[value], '  '))
    lines.push(`  ${constantCase(value)}`)
  }
  lines.push('}')
  return lines.join('\n')
}

/**
 * Split variant matching the real Data Connect layout: one file per table at
 * `schema/<table_name>.gql`, with each enum co-located in the file of the first
 * model that references it (leftover enums go to `schema/_enums.gql`). The `Any`
 * scalar is not declared — Data Connect provides it built-in.
 */
export const createDataConnectGraphqlSplitGenerator = (): Generator => ({
  name: 'data-connect-graphql-split',
  description: 'Data Connect GraphQL schema, one file per table (schema/<table>.gql)',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    const banner = headerBlocks(context, commentBanner)
    const rename = buildRename(ir)
    const tables = ir.models.filter(isTable)
    // Assign each enum to the first *table* that references it (embedded value
    // objects do not get schema files, so they cannot host enums).
    const enumHome = new Map<string, string>()
    for (const model of tables) {
      for (const field of model.fields) {
        if (field.type.kind === 'enum' && !enumHome.has(field.type.name)) {
          enumHome.set(field.type.name, model.name)
        }
      }
    }
    const files: GeneratedFile[] = []
    for (const model of tables) {
      const blocks = [...banner]
      for (const irEnum of ir.enums) {
        if (enumHome.get(irEnum.name) === model.name) {
          blocks.push(renderEnumGql(irEnum, rename))
        }
      }
      const fields = model.fields.map(field => renderField(field, rename)).join('\n')
      const doc = commentLines(model.description, '')
      blocks.push([...doc, `${typeHeader(model, gqlOf(rename, model.name))}\n${fields}\n}`].join('\n'))
      if (model.footer) blocks.push(commentLines(model.footer, '').join('\n'))
      files.push({ path: `schema/${tableName(model)}.gql`, content: `${blocks.join('\n\n')}\n` })
    }
    // Enums referenced only by embedded value objects are TS/Zod-level types and
    // do not exist in the Data Connect schema — they are intentionally skipped.
    return files
  },
})
