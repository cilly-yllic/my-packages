import { findModel, Ir, IrField, IrModel, IrOperation, IrSelect, ScalarType } from '../../ir/ir.js'
import { camelCase, pluralize, snakeCase } from '../support/naming.js'
import { isRelation, relationFkName, relationFkType } from '../support/relations.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'

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

interface Variable {
  name: string
  field: IrField
  gqlType: string
  tsType: string
  required: boolean
  /** Comment lines rendered directly above the declaration. */
  comment?: string
}

const enumGqlName = (ir: Ir, name: string): string => ir.enums.find(e => e.name === name)?.gqlName ?? name

const fieldGqlType = (ir: Ir, field: IrField): string =>
  isRelation(field)
    ? SCALAR_GQL[relationFkType(ir, field)]
    : field.type.kind === 'enum'
      ? enumGqlName(ir, field.type.name)
      : field.type.kind === 'scalar'
        ? SCALAR_GQL[field.type.name]
        : 'Any'

const fieldTsType = (ir: Ir, field: IrField): string =>
  isRelation(field)
    ? SCALAR_TS[relationFkType(ir, field)]
    : field.type.kind === 'enum'
      ? field.type.name
      : field.type.kind === 'scalar'
        ? SCALAR_TS[field.type.name]
        : 'unknown'

const varName = (field: IrField): string => (isRelation(field) ? relationFkName(field) : field.name)

const toVariable = (ir: Ir, field: IrField, required: boolean, comment?: string): Variable => ({
  name: varName(field),
  field,
  gqlType: fieldGqlType(ir, field),
  tsType: fieldTsType(ir, field),
  required,
  ...(comment !== undefined ? { comment } : {}),
})

const idField = (model: IrModel): IrField | undefined => model.fields.find(field => field.isId)

/** Primary-key fields: the composite `key` list, else the single `id: true` field. */
const keyFields = (model: IrModel): IrField[] => {
  if (model.key.length > 0) {
    return model.key.flatMap(name => {
      const field = model.fields.find(f => f.name === name)
      return field ? [field] : []
    })
  }
  const id = idField(model)
  return id ? [id] : []
}

/** Effective variable name for an entry: explicit override, else field/FK name. */
const entryVarName = (field: IrField, override?: string): string => override ?? varName(field)

const collectVariables = (ir: Ir, op: IrOperation, model: IrModel): Variable[] => {
  const byName = new Map(model.fields.map(field => [field.name, field]))
  const vars: Variable[] = []
  const seen = new Set<string>()
  const push = (field: IrField, required: boolean, comment?: string, nameOverride?: string): void => {
    const name = entryVarName(field, nameOverride)
    if (seen.has(name)) return
    seen.add(name)
    vars.push({ ...toVariable(ir, field, required, comment), name })
  }
  if (op.operationType === 'mutation') {
    // update/delete need the primary key (single id or composite) as variables.
    if (op.action === 'update' || op.action === 'delete') {
      for (const field of keyFields(model)) push(field, true, undefined, op.keyVars?.[field.name])
    }
    for (const input of op.inputs) {
      if (input.literal !== undefined) continue // literal writes declare no variable
      if (input.inc && !input.var) continue // fixed +1 declares no variable
      const field = byName.get(input.field)
      if (!field) continue
      if (input.asKey && field.type.kind === 'model') {
        // Key-object variable: `$catalogVersion: CatalogVersion_Key!`
        const related = findModel(ir, field.type.name)
        const keyType = `${related?.gqlName ?? field.type.name}_Key`
        const name = input.var ?? field.name
        if (!seen.has(name)) {
          seen.add(name)
          vars.push({ name, field, gqlType: keyType, tsType: 'unknown', required: input.required ?? !field.optional })
        }
        continue
      }
      push(field, (input.inc ? true : input.required ?? !field.optional), input.description, input.var)
    }
    for (const entry of op.inc) {
      if (!entry.var) continue // fixed +1 declares no variable
      const field = byName.get(entry.field)
      if (field) push(field, true, undefined, entry.var)
    }
  } else {
    for (const where of op.where) {
      if (where.literal !== undefined) continue // literal comparisons declare no variable
      // Dotted paths (`provider.name`, `review.catalog.id`) type the variable from the
      // final segment's field on the (transitively) related model.
      if (where.field.includes('.')) {
        const segs = where.field.split('.')
        let m: IrModel | undefined = model
        let sub: IrField | undefined
        for (let i = 0; i < segs.length; i++) {
          sub = m?.fields.find(f => f.name === segs[i])
          if (!sub) break
          if (i < segs.length - 1) {
            m = sub.type.kind === 'model' ? findModel(ir, sub.type.name) : undefined
          }
        }
        if (sub) push(sub, where.required ?? true, where.description, where.var ?? sub.name)
        continue
      }
      const field = byName.get(where.field)
      if (field) push(field, where.required ?? true, where.description, where.var)
    }
    if (op.limit !== undefined && typeof op.limit !== 'number') {
      const lim = op.limit
      vars.push({
        name: lim.var,
        field: {
          name: lim.var,
          type: { kind: 'scalar', name: 'int' },
          constraints: {},
          optional: !(lim.required ?? false),
          list: false,
          isId: false,
          unique: false,
          relation: false,
        },
        gqlType: 'Int',
        tsType: 'number',
        required: lim.required ?? lim.default !== undefined,
      })
    }
  }
  return vars
}

const dataEntryFor = (
  field: IrField,
  input: { var?: string; flat?: boolean; literal?: string; quote?: boolean; inc?: boolean; asKey?: boolean }
): string => {
  if (input.asKey) {
    return `${field.name}: $${input.var ?? field.name}`
  }
  if (input.inc) {
    return `${field.name}_update: { inc: ${input.var ? `$${input.var}` : '1'} }`
  }
  if (input.literal !== undefined) {
    const value = input.quote ? `"${input.literal}"` : input.literal
    return `${field.name}: ${value}`
  }
  const v = input.var ?? varName(field)
  if (isRelation(field)) {
    return input.flat ? `${field.name}Id: $${v}` : `${field.name}: { id: $${v} }`
  }
  return `${field.name}: $${v}`
}

const authDirective = (op: IrOperation): string => {
  const reason = op.auth === 'PUBLIC' && op.authReason ? `, insecureReason: "${op.authReason}"` : ''
  return `@auth(level: ${op.auth}${reason})`
}

/**
 * The `@auth` segment between the signature and the opening `{`. Matches the
 * hand-written style: NO_ACCESS stays inline; PUBLIC with an insecureReason
 * becomes a multi-line block on its own line.
 */
const authSuffix = (op: IrOperation): string => {
  if (op.auth === 'PUBLIC' && op.authReason) {
    return `\n@auth(\n  level: PUBLIC\n  insecureReason: "${op.authReason}"\n) {`
  }
  if (op.style?.auth === 'newline') {
    return `\n${authDirective(op)} {`
  }
  return ` ${authDirective(op)} {`
}

/** Render selection entries recursively with real-file indentation. */
const renderSelectLines = (entries: IrSelect[], indent: string): string[] =>
  entries.flatMap(entry => {
    const comments = entry.description ? entry.description.split('\n').map(l => `${indent}# ${l}`.trimEnd()) : []
    const name = `${entry.alias ? `${entry.alias}: ` : ''}${entry.field}`
    // Multi-line args (block scalar with newlines) render one argument per line.
    const multiArgs = entry.args !== undefined && entry.args.includes('\n')
    const head = multiArgs ? `${name}(` : `${name}${entry.args ? `(${entry.args})` : ''}`
    const argLines = multiArgs
      ? [...(entry.args as string).split('\n').map(l => `${indent}  ${l}`), `${indent})`]
      : []
    if (entry.select && entry.select.length > 0) {
      const open = multiArgs
        ? [...argLines.slice(0, -1), `${indent}) {`]
        : []
      return multiArgs
        ? [...comments, `${indent}${head}`, ...open.slice(0, -1), `${indent}) {`, ...renderSelectLines(entry.select, `${indent}  `), `${indent}}`]
        : [...comments, `${indent}${head} {`, ...renderSelectLines(entry.select, `${indent}  `), `${indent}}`]
    }
    return [...comments, `${indent}${head}`, ...argLines]
  })

const scalarFieldNames = (model: IrModel): string[] =>
  model.fields.filter(field => !isRelation(field) && field.type.kind !== 'model').map(field => field.name)

const footerLines = (op: IrOperation): string =>
  op.footer ? '\n\n' + op.footer.split('\n').map(l => `# ${l}`.trimEnd()).join('\n') : ''

const renderOperationGql = (ir: Ir, op: IrOperation, model: IrModel): string => {
  // Verbatim escape hatch: description + raw body + footer, untouched.
  if (op.raw !== undefined) {
    const rawHeader = op.description ? op.description.split('\n').map(l => `# ${l}`.trimEnd()).join('\n') + '\n' : ''
    return `${rawHeader}${op.raw}${footerLines(op)}`
  }
  const vars = collectVariables(ir, op, model)
  // Multi-line signature (one variable per line) matching real connector files;
  // single-variable operations stay inline unless a variable carries a comment.
  const limitSpec = op.operationType === 'query' && op.limit !== undefined && typeof op.limit !== 'number' ? op.limit : undefined
  const varDecls = vars.map(v => {
    const suffix = limitSpec && v.name === limitSpec.var && limitSpec.default !== undefined ? ` = ${limitSpec.default}` : ''
    const decl = `$${v.name}: ${v.gqlType}${v.required ? '!' : ''}${suffix}`
    if (!v.comment) return decl
    const comments = v.comment.split('\n').map(l => `# ${l}`.trimEnd())
    return [...comments, decl].join('\n  ')
  })
  const hasComments = vars.some(v => v.comment)
  const sigStyle = op.style?.signature
  const inlineSig = sigStyle === 'inline' || (sigStyle !== 'multi' && varDecls.length === 1 && !hasComments)
  const signature =
    varDecls.length === 0
      ? ''
      : inlineSig && !hasComments
        ? `(${varDecls.join(', ')})`
        : `(\n  ${varDecls.join('\n  ')}\n)`
  // Multi-line description (e.g. the real files' header comment blocks).
  const header = op.description ? op.description.split('\n').map(l => `# ${l}`.trimEnd()).join('\n') + '\n' : ''
  const base = camelCase(model.gqlName ?? model.name)

  if (op.operationType === 'mutation') {
    const keys = keyFields(model)
    const keyNames = new Set(keys.map(f => f.name))
    const isKeyed = op.action === 'update' || op.action === 'delete'
    const entries = op.inputs
      .map(input => ({ input, field: model.fields.find(f => f.name === input.field) }))
      .filter((e): e is { input: (typeof op.inputs)[number]; field: IrField } => !!e.field)
      .filter(e => !(isKeyed && keyNames.has(e.field.name) && e.input.literal === undefined))
    const dataParts = [
      ...entries.map(e => dataEntryFor(e.field, e.input)),
      ...op.inc.map(entry => `${entry.field}_update: { inc: ${entry.var ? `$${entry.var}` : '1'} }`),
      ...op.exprs.map(e => `${e.field}_expr: "${e.expr}"`),
    ]
    const keyPairs = keys.map(f => {
      const v = op.keyVars?.[f.name] ?? varName(f)
      // Relation key fields use their FK column name in the key object (catalogId, not catalog).
      return { field: varName(f), v }
    })
    const inlineData = op.style?.data === 'inline'
    const compactData = op.style?.data === 'compact'
    const dataBlock =
      dataParts.length > 0
        ? inlineData || compactData
          ? `data: { ${dataParts.join(', ')} }`
          : `data: {\n      ${dataParts.join('\n      ')}\n    }`
        : ''
    const argLines: string[] = []
    if (isKeyed) {
      if (op.keyArg === 'id' && keyPairs.length === 1) {
        argLines.push(`${keyPairs[0].field}: $${keyPairs[0].v}`)
      } else if (op.style?.key === 'multi') {
        argLines.push(`key: {\n      ${keyPairs.map(k => `${k.field}: $${k.v}`).join('\n      ')}\n    }`)
      } else {
        argLines.push(`key: { ${keyPairs.map(k => `${k.field}: $${k.v}`).join(', ')} }`)
      }
    }
    if (op.action !== 'delete' && dataBlock) argLines.push(dataBlock)
    const verb = op.action ?? 'insert'
    const body = inlineData
      ? `${base}_${verb}(${argLines.join(', ')})`
      : `${base}_${verb}(\n    ${argLines.join('\n    ')}\n  )`
    return `${header}mutation ${op.gqlName ?? op.name}${signature}${authSuffix(op)}\n  ${body}\n}${footerLines(op)}`
  }

  const fieldByName = new Map(model.fields.map(f => [f.name, f]))

  // Selection lines (shared by list and single forms).
  let selection: string
  if (op.aggregate) {
    const aggFields = [...(op.aggregate.count ? ['_count'] : []), ...op.aggregate.sum.map(f => `${f}_sum`)]
    selection = aggFields.map(f => `    ${f}`).join('\n')
  } else {
    const lines =
      op.select.length > 0
        ? renderSelectLines(op.select, '    ')
        : scalarFieldNames(model).map(name => `    ${name}`)
    selection = lines.join('\n')
  }

  // Single-row primary-key lookup: `x(key: { id: $id })` or `x(id: $id)`.
  if (op.single) {
    const pairs = op.where.map(w => {
      const field = fieldByName.get(w.field)
      const v = w.var ?? (field ? varName(field) : w.field)
      return `${w.field}: $${v}`
    })
    const arg = op.single === 'key' ? `key: { ${pairs.join(', ')} }` : pairs.join(', ')
    return `${header}query ${op.gqlName ?? op.name}${signature}${authSuffix(op)}\n  ${base}(${arg}) {\n${selection}\n  }\n}${footerLines(op)}`
  }

  const plural = `${base}s`
  // Group where conditions per field; relations use the canonical id-nested form.
  const grouped = new Map<string, { conds: string[]; flat: boolean; sub: boolean }>()
  for (const w of op.where) {
    const dot = w.field.indexOf('.')
    const topKey = dot > 0 ? w.field.slice(0, dot) : w.field
    const field = fieldByName.get(topKey)
    if (!field) continue
    let value: string
    if (w.literal !== undefined) {
      value = w.literal
    } else if (dot > 0) {
      const related = field.type.kind === 'model' ? findModel(ir, field.type.name) : undefined
      const subField = related?.fields.find(f => f.name === w.field.slice(dot + 1))
      value = `$${w.var ?? (subField ? subField.name : w.field.slice(dot + 1))}`
    } else {
      value = `$${w.var ?? varName(field)}`
    }
    const group = grouped.get(topKey) ?? { conds: [], flat: false, sub: false }
    if (dot > 0) {
      // Nested relation condition; deeper paths nest recursively
      // (`review.catalog.id` → `catalog: { id: { eq: $x } }` inside `review: { … }`).
      const rest = w.field.slice(dot + 1).split('.')
      let inner = `{ ${w.op}: ${value} }`
      for (let i = rest.length - 1; i >= 0; i--) inner = `{ ${rest[i]}: ${inner} }`.replace(/^\{ /, '{ ').replace(/ \}$/, ' }')
      // strip outermost braces since group renderer adds them
      group.conds.push(inner.slice(2, -2))
      group.sub = true
    } else {
      group.conds.push(`${w.op}: ${value}`)
    }
    group.flat = group.flat || (w.flat ?? false)
    grouped.set(topKey, group)
  }
  const whereEntries = [...grouped.entries()].map(([name, group]) => {
    const field = fieldByName.get(name)
    const inner = `{ ${group.conds.join(', ')} }`
    if (field && isRelation(field)) {
      if (group.sub) return `${name}: ${inner}` // nested sub-field conditions
      return group.flat ? `${name}Id: ${inner}` : `${name}: { id: ${inner} }`
    }
    return `${name}: ${inner}`
  })
  const args: string[] = []
  const argCount = [whereEntries.length > 0, op.orderBy.length > 0, op.limit !== undefined].filter(Boolean).length
  const multiArgs = op.style?.args === 'inline' ? false : op.style?.args === 'multi' ? argCount > 0 : argCount > 1
  if (whereEntries.length > 0) {
    // `_and` renders as an expanded array (one condition per line) in multi-line
    // call form, matching the hand-written style.
    const inlineAnd = op.style?.and === 'inline'
    const andItems = whereEntries.map(e => `{ ${e} }`)
    const whereBody = op.whereAnd
      ? multiArgs
        ? inlineAnd
          ? `{\n      _and: [${andItems.join(', ')}]\n    }`
          : `{\n      _and: [\n        ${andItems.join('\n        ')}\n      ]\n    }`
        : `{ _and: [${andItems.join(', ')}] }`
      : op.style?.where === 'multi'
        ? `{\n      ${whereEntries.join('\n      ')}\n    }`
        : `{ ${whereEntries.join(', ')} }`
    args.push(`where: ${whereBody}`)
  }
  if (op.orderBy.length > 0) {
    const clauses = op.orderBy.map(o => `{ ${o.field}: ${o.dir} }`).join(', ')
    const bare = op.style?.orderBy === 'bare' && op.orderBy.length === 1
    args.push(bare ? `orderBy: ${clauses}` : `orderBy: [${clauses}]`)
  }
  if (op.limit !== undefined) {
    args.push(typeof op.limit === 'number' ? `limit: ${op.limit}` : `limit: $${op.limit.var}`)
  }

  // Multi-argument list calls wrap one argument per line, like the real files.
  const call = multiArgs
    ? `${plural}(\n    ${args.join('\n    ')}\n  ) {`
    : `${plural}(${args.join(', ')}) {`
  return `${header}query ${op.gqlName ?? op.name}${signature}${authSuffix(op)}\n  ${call}\n${selection}\n  }\n}${footerLines(op)}`
}

const renderVariablesType = (ir: Ir, op: IrOperation, model: IrModel): string => {
  const vars = collectVariables(ir, op, model)
  if (vars.length === 0) {
    return `export interface ${op.name}Variables {}`
  }
  const fields = vars.map(v => `  ${v.name}${v.required ? '' : '?'}: ${v.tsType}`).join('\n')
  return `export interface ${op.name}Variables {\n${fields}\n}`
}

const renderResultType = (op: IrOperation, model: IrModel): string => {
  const base = camelCase(model.name)
  if (op.operationType === 'mutation') {
    const id = idField(model)
    const idName = id?.name ?? 'id'
    const idTs = id && id.type.kind === 'scalar' ? SCALAR_TS[id.type.name] : 'string'
    return `export interface ${op.name}Result {\n  ${base}_${op.action ?? 'insert'}: { ${idName}: ${idTs} }\n}`
  }
  const plural = `${base}s`
  if (op.aggregate) {
    const parts = [
      ...(op.aggregate.count ? ['_count: number'] : []),
      ...op.aggregate.sum.map(f => `${f}_sum: number | null`),
    ]
    return `export interface ${op.name}Result {\n  ${plural}: { ${parts.join('; ')} }[]\n}`
  }
  const pickNames = op.select.map(entry => {
    const field = model.fields.find(f => f.name === entry.field)
    return field && isRelation(field) ? relationFkName(field) : entry.field
  })
  const element = op.select.length > 0 ? `Pick<${model.name}, ${pickNames.map(n => `'${n}'`).join(' | ')}>` : model.name
  return `export interface ${op.name}Result {\n  ${plural}: ${element}[]\n}`
}

interface ResolvedOp {
  op: IrOperation
  model: IrModel
}

/** Group operations by connector; ops with no connector go to the '' (root) group. */
const groupByConnector = (resolvable: ResolvedOp[]): Map<string, ResolvedOp[]> => {
  const groups = new Map<string, ResolvedOp[]>()
  for (const entry of resolvable) {
    const targets = entry.op.connectors.length > 0 ? entry.op.connectors : ['']
    for (const connector of targets) {
      const list = groups.get(connector) ?? []
      list.push(entry)
      groups.set(connector, list)
    }
  }
  return groups
}

const renderGqlFile = (ir: Ir, entries: ResolvedOp[], context?: GeneratorContext): string => {
  const blocks = [...headerBlocks(context, header => header.replace(/^\/\/ ?/gm, '# '))]
  for (const { op, model } of entries) {
    blocks.push(renderOperationGql(ir, op, model))
  }
  return `${blocks.join('\n\n')}\n`
}

const renderTsFile = (ir: Ir, entries: ResolvedOp[], typesImport: string, context?: GeneratorContext): string => {
  const usedTypes = new Set<string>()
  for (const { op, model } of entries) {
    if (op.operationType === 'query' && !op.aggregate) {
      usedTypes.add(model.name)
    }
    for (const variable of collectVariables(ir, op, model)) {
      if (variable.field.type.kind === 'enum') {
        usedTypes.add(variable.field.type.name)
      }
    }
  }
  const blocks = [...headerBlocks(context)]
  if (usedTypes.size > 0) {
    blocks.push(`import type { ${[...usedTypes].sort().join(', ')} } from '${typesImport}'`)
  }
  for (const { op, model } of entries) {
    blocks.push(renderVariablesType(ir, op, model))
    blocks.push(renderResultType(op, model))
  }
  return `${blocks.join('\n\n')}\n`
}

/**
 * Generates Data Connect operations: `.gql` files with `mutation`/`query`
 * definitions (over the auto-generated `<table>_insert/update/upsert/delete`
 * resolvers, with `@auth` directives) plus matching TS `Variables`/`Result`
 * types. Operations are routed per **connector** — an operation may target
 * several connectors (`connectors: [app, api]`) and is emitted into each, under
 * `<connector>/operations.gql`. Operations without a connector go to the root.
 */
export const createDataConnectOperationsGenerator = (): Generator => ({
  name: 'data-connect-operations',
  description: 'Data Connect query/mutation operations (.gql + TS types), routed per connector',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    if (ir.operations.length === 0) {
      return []
    }

    const resolvable: ResolvedOp[] = ir.operations
      .map(op => ({ op, model: findModel(ir, op.model) }))
      .filter((entry): entry is ResolvedOp => !!entry.model)

    const files: GeneratedFile[] = []
    for (const [connector, entries] of groupByConnector(resolvable)) {
      const dir = connector ? `${connector}/` : ''
      // types.ts lives at the output root; connector files sit one level deeper.
      const typesImport = connector ? '../types' : './types'
      files.push({ path: `${dir}operations.gql`, content: renderGqlFile(ir, entries, context) })
      files.push({ path: `${dir}operations-types.ts`, content: renderTsFile(ir, entries, typesImport, context) })
    }
    return files
  },
})

/** Entity directory name for a model: kebab-case of its table name. */
const entityDir = (model: IrModel): string =>
  (model.table ?? pluralize(snakeCase(model.name))).replace(/_/g, '-')

/**
 * Split variant matching the real connector layout:
 * `<connector>/operations/<entity>/{queries,mutations}.gql` (+ one
 * `operations-types.ts` per connector). Selectable alongside the single-file
 * `data-connect-operations` generator.
 */
export const createDataConnectOperationsSplitGenerator = (): Generator => ({
  name: 'data-connect-operations-split',
  description: 'Data Connect operations, one file per entity per connector',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    if (ir.operations.length === 0) {
      return []
    }
    const resolvable: ResolvedOp[] = ir.operations
      .map(op => ({ op, model: findModel(ir, op.model) }))
      .filter((entry): entry is ResolvedOp => !!entry.model)

    const files: GeneratedFile[] = []
    for (const [connector, entries] of groupByConnector(resolvable)) {
      const dir = connector ? `${connector}/` : ''
      const byEntity = new Map<string, ResolvedOp[]>()
      for (const entry of entries) {
        const key = entry.op.entityDir ?? entityDir(entry.model)
        byEntity.set(key, [...(byEntity.get(key) ?? []), entry])
      }
      for (const [entity, group] of byEntity) {
        const queries = group.filter(e => e.op.operationType === 'query')
        const mutations = group.filter(e => e.op.operationType === 'mutation')
        if (queries.length > 0) {
          files.push({ path: `${dir}operations/${entity}/queries.gql`, content: renderGqlFile(ir, queries, context) })
        }
        if (mutations.length > 0) {
          files.push({ path: `${dir}operations/${entity}/mutations.gql`, content: renderGqlFile(ir, mutations, context) })
        }
      }
      // No TS emitted here: Data Connect's own codegen generates the typed SDK
      // from these .gql files; shared types are distributed via libs-level
      // generators (typescript/zod/...), not into connector source dirs.
    }
    return files
  },
})
