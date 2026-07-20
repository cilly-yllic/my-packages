import { Diagnostic, error, warning } from '../diagnostics.js'
import { constantCase } from '../generators/support/naming.js'
import { isTable } from '../generators/support/split.js'
import { findModel, Ir, IrApiPayload } from '../ir/ir.js'

/**
 * A validation rule inspects the IR and returns any problems it finds. Rules are
 * independent and side-effect free so new checks can be added (open/closed)
 * without touching existing ones or the runner.
 */
export type ValidationRule = (ir: Ir) => Diagnostic[]

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Every field type must resolve to a known scalar, enum, or model. */
export const unresolvedTypes: ValidationRule = ir =>
  ir.models.flatMap(model =>
    model.fields
      .filter(field => field.type.kind === 'unresolved')
      .map(field =>
        error('UNRESOLVED_TYPE', `Unknown type "${field.type.name}" on ${model.name}.${field.name}`, {
          file: model.sourceFile,
          path: `models.${model.name}.fields.${field.name}`,
        })
      )
  )

/** Enums must declare at least one value. */
export const emptyEnums: ValidationRule = ir =>
  ir.enums
    .filter(irEnum => irEnum.values.length === 0)
    .map(irEnum =>
      error('EMPTY_ENUM', `Enum "${irEnum.name}" has no values`, {
        file: irEnum.sourceFile,
        path: `enums.${irEnum.name}`,
      })
    )

/** Enum values should be unique. */
export const duplicateEnumValues: ValidationRule = ir =>
  ir.enums.flatMap(irEnum => {
    const seen = new Set<string>()
    const diagnostics: Diagnostic[] = []
    for (const value of irEnum.values) {
      if (seen.has(value)) {
        diagnostics.push(
          warning('DUPLICATE_ENUM_VALUE', `Enum "${irEnum.name}" repeats value "${value}"`, {
            file: irEnum.sourceFile,
            path: `enums.${irEnum.name}`,
          })
        )
      }
      seen.add(value)
    }
    return diagnostics
  })

/** Model and enum names must be valid identifiers so generators can emit them. */
export const validNames: ValidationRule = ir => {
  const diagnostics: Diagnostic[] = []
  for (const irEnum of ir.enums) {
    if (!IDENTIFIER.test(irEnum.name)) {
      diagnostics.push(
        error('INVALID_NAME', `Enum name "${irEnum.name}" is not a valid identifier`, {
          file: irEnum.sourceFile,
          path: `enums.${irEnum.name}`,
        })
      )
    }
  }
  for (const model of ir.models) {
    if (!IDENTIFIER.test(model.name)) {
      diagnostics.push(
        error('INVALID_NAME', `Model name "${model.name}" is not a valid identifier`, {
          file: model.sourceFile,
          path: `models.${model.name}`,
        })
      )
    }
    for (const field of model.fields) {
      if (!IDENTIFIER.test(field.name)) {
        diagnostics.push(
          error('INVALID_NAME', `Field name "${field.name}" on ${model.name} is not a valid identifier`, {
            file: model.sourceFile,
            path: `models.${model.name}.fields.${field.name}`,
          })
        )
      }
    }
  }
  return diagnostics
}

/** Primary-identifier constraints: at most one, not a list, ideally required. */
export const idFields: ValidationRule = ir =>
  ir.models.flatMap(model => {
    const diagnostics: Diagnostic[] = []
    const ids = model.fields.filter(field => field.isId)
    if (ids.length > 1) {
      diagnostics.push(
        error('MULTIPLE_IDS', `Model "${model.name}" declares ${ids.length} id fields; only one is allowed`, {
          file: model.sourceFile,
          path: `models.${model.name}`,
        })
      )
    }
    for (const field of ids) {
      if (field.list) {
        diagnostics.push(
          error('INVALID_ID', `Id field "${model.name}.${field.name}" cannot be a list`, {
            file: model.sourceFile,
            path: `models.${model.name}.fields.${field.name}`,
          })
        )
      }
      if (field.optional) {
        diagnostics.push(
          warning('OPTIONAL_ID', `Id field "${model.name}.${field.name}" is optional`, {
            file: model.sourceFile,
            path: `models.${model.name}.fields.${field.name}`,
          })
        )
      }
    }
    return diagnostics
  })

/** Composite key and index field names must exist on the model. */
export const modelKeysAndIndexes: ValidationRule = ir =>
  ir.models.flatMap(model => {
    const diagnostics: Diagnostic[] = []
    const fieldNames = new Set(model.fields.map(field => field.name))
    // Index/unique fields may also reference a relation's FK *column* name
    // (`ownerId` for relation field `owner`), matching real DC schemas.
    for (const field of model.fields) {
      if (field.relation && field.type.kind === 'model') {
        fieldNames.add(`${field.name}Id`)
      }
    }
    for (const name of model.key) {
      if (!fieldNames.has(name)) {
        diagnostics.push(
          error('UNKNOWN_KEY_FIELD', `Model "${model.name}" key references unknown field "${name}"`, {
            file: model.sourceFile,
            path: `models.${model.name}.key`,
          })
        )
      }
    }
    for (const index of model.indexes) {
      for (const name of index.fields) {
        if (!fieldNames.has(name)) {
          diagnostics.push(
            error('UNKNOWN_INDEX_FIELD', `Model "${model.name}" index references unknown field "${name}"`, {
              file: model.sourceFile,
              path: `models.${model.name}.indexes`,
            })
          )
        }
      }
    }
    return diagnostics
  })

/** A `relation` flag is only meaningful on a model-typed field. */
export const relationFields: ValidationRule = ir =>
  ir.models.flatMap(model =>
    model.fields
      .filter(field => field.relation && field.type.kind !== 'model')
      .map(field =>
        error('INVALID_RELATION', `Field "${model.name}.${field.name}" is marked relation but its type is not a model`, {
          file: model.sourceFile,
          path: `models.${model.name}.fields.${field.name}`,
        })
      )
  )

/** Operations must target a known model, use valid field names, and pair type/action correctly. */
export const operations: ValidationRule = ir =>
  ir.operations.flatMap(op => {
    const diagnostics: Diagnostic[] = []
    const model = findModel(ir, op.model)
    const loc = { file: op.sourceFile, path: `operations.${op.name}` }
    if (!model) {
      diagnostics.push(error('UNKNOWN_OPERATION_MODEL', `Operation "${op.name}" targets unknown model "${op.model}"`, loc))
      return diagnostics
    }
    // Raw operations are emitted verbatim; their body is not described by
    // inputs/where/select, so field-level checks do not apply.
    if (op.raw !== undefined) return diagnostics
    const fieldNames = new Set(model.fields.map(field => field.name))
    const checkField = (kind: string, name: string): void => {
      if (!fieldNames.has(name)) {
        diagnostics.push(
          error('UNKNOWN_OPERATION_FIELD', `Operation "${op.name}" ${kind} references unknown field "${name}" on ${op.model}`, loc)
        )
      }
    }
    for (const input of op.inputs) checkField('inputs', input.field)
    const relFkNames = new Set(
      model.fields.filter(f => f.relation && f.type.kind === 'model').map(f => `${f.name}Id`)
    )
    const checkWherePath = (path: string): void => {
      const dot = path.indexOf('.')
      if (dot <= 0) {
        checkField('where', path)
        return
      }
      const rel = model.fields.find(f => f.name === path.slice(0, dot))
      if (!rel || rel.type.kind !== 'model') {
        checkField('where', path.slice(0, dot))
        return
      }
      const related = findModel(ir, rel.type.name)
      if (related && !related.fields.some(f => f.name === path.slice(dot + 1))) {
        diagnostics.push(
          error('UNKNOWN_OPERATION_FIELD', `Operation "${op.name}" where references unknown field "${path}" on ${op.model}`, loc)
        )
      }
    }
    const checkSelect = (entries: typeof op.select, m: typeof model): void => {
      for (const entry of entries) {
        // Reverse-join selections (x_on_y) reference the related table's side;
        // they are rendered verbatim and not validated against this model.
        if (entry.field.includes('_on_')) continue
        const field = m.fields.find(f => f.name === entry.field)
        if (!field) {
          diagnostics.push(
            error('UNKNOWN_OPERATION_FIELD', `Operation "${op.name}" select references unknown field "${entry.field}" on ${m.name}`, loc)
          )
          continue
        }
        if (entry.select && entry.select.length > 0) {
          if (field.type.kind === 'model') {
            const related = findModel(ir, field.type.name)
            if (related) checkSelect(entry.select, related)
          }
        }
      }
    }
    checkSelect(op.select, model)
    for (const where of op.where) checkWherePath(where.field)
    for (const order of op.orderBy) {
      if (!relFkNames.has(order.field)) checkField('orderBy', order.field)
    }
    for (const expr of op.exprs) checkField('exprs', expr.field)
    for (const entry of op.inc) checkField('inc', entry.field)
    if (op.operationType === 'mutation' && !op.action) {
      diagnostics.push(error('MISSING_MUTATION_ACTION', `Mutation "${op.name}" needs an "action" (insert|update|upsert|delete)`, loc))
    }
    if (op.operationType === 'query' && op.action) {
      diagnostics.push(warning('UNUSED_ACTION', `Query "${op.name}" ignores its "action"`, loc))
    }
    if (op.auth === 'PUBLIC' && !op.authReason) {
      diagnostics.push(warning('MISSING_AUTH_REASON', `Operation "${op.name}" is PUBLIC without an "authReason"`, loc))
    }
    return diagnostics
  })

/** API request/response payloads that reference a model must reference a known one. */
export const apis: ValidationRule = ir =>
  ir.apis.flatMap(api => {
    const diagnostics: Diagnostic[] = []
    const loc = { file: api.sourceFile, path: `apis.${api.name}` }
    const checkPayload = (payload: IrApiPayload, which: string): void => {
      if (payload.model && !findModel(ir, payload.model)) {
        diagnostics.push(error('UNKNOWN_API_MODEL', `Api "${api.name}" ${which} references unknown model "${payload.model}"`, loc))
      }
    }
    checkPayload(api.request, 'request')
    checkPayload(api.response, 'response')
    return diagnostics
  })

/** Firestore projections must derive from a known model with valid pick/omit fields. */
export const firestore: ValidationRule = ir =>
  ir.firestore.flatMap(doc => {
    const diagnostics: Diagnostic[] = []
    const loc = { file: doc.sourceFile, path: `firestore.${doc.name}` }
    if (doc.pick.length > 0 && doc.omit.length > 0) {
      diagnostics.push(warning('PICK_AND_OMIT', `Firestore doc "${doc.name}" sets both pick and omit; omit is ignored`, loc))
    }
    if (!doc.from) {
      // A projection with no base model must declare its own fields.
      if (doc.fields.length === 0) {
        diagnostics.push(error('EMPTY_FIRESTORE_DOC', `Firestore doc "${doc.name}" has no "from" and no fields`, loc))
      }
      return diagnostics
    }
    const model = findModel(ir, doc.from)
    if (!model) {
      diagnostics.push(error('UNKNOWN_FIRESTORE_MODEL', `Firestore doc "${doc.name}" derives from unknown model "${doc.from}"`, loc))
      return diagnostics
    }
    const fieldNames = new Set(model.fields.map(field => field.name))
    for (const [kind, names] of [
      ['pick', doc.pick],
      ['omit', doc.omit],
    ] as const) {
      for (const name of names) {
        if (!fieldNames.has(name)) {
          diagnostics.push(error('UNKNOWN_FIRESTORE_FIELD', `Firestore doc "${doc.name}" ${kind} references unknown field "${name}" on ${doc.from}`, loc))
        }
      }
    }
    return diagnostics
  })

/** Union variants must be known models, each carrying the discriminant field. */
export const unions: ValidationRule = ir =>
  ir.unions.flatMap(union => {
    const diagnostics: Diagnostic[] = []
    const loc = { file: union.sourceFile, path: `unions.${union.name}` }
    if (union.variants.length === 0) {
      diagnostics.push(error('EMPTY_UNION', `Union "${union.name}" has no variants`, loc))
    }
    for (const variant of union.variants) {
      const model = findModel(ir, variant)
      if (!model) {
        diagnostics.push(error('UNKNOWN_UNION_VARIANT', `Union "${union.name}" references unknown model "${variant}"`, loc))
        continue
      }
      if (!model.fields.some(field => field.name === union.discriminant)) {
        diagnostics.push(
          error('MISSING_DISCRIMINANT', `Union "${union.name}" variant "${variant}" lacks discriminant field "${union.discriminant}"`, loc)
        )
      }
    }
    return diagnostics
  })

/** A single generated identifier claimed by a definition within one output namespace. */
interface NameClaim {
  /** Human-readable owner, e.g. `model "Task"` — claims by the same owner never collide. */
  owner: string
  identifier: string
  file?: string
  path: string
}

const RESERVED_OWNER = 'the generated runtime'

/**
 * Type names must be unique within every output namespace — the export surface
 * where generated identifiers converge (a split layout still merges into one
 * barrel, so physical files are irrelevant). Renames (`gqlName` / `fsName`)
 * deliberately move a type between namespaces, so each namespace is checked
 * independently against its *effective* names:
 *
 * - TypeScript types module: model/enum/union logical names, enum const
 *   (`CONSTANT_CASE`) and `…Key` companions, plus the reserved `Json` type
 * - zod schemas module: logical names and their `…Schema` companions
 * - unions module: union names/schemas plus the variant schemas it imports
 * - firestore module: doc names, co-located enums/embedded models under
 *   `fsName ?? name`, plus the `_Meta_…` / `FIRESTORE_DATABASES` runtime
 *
 * GraphQL names are checked separately ({@link graphqlNameCollisions}) because
 * that namespace is scoped per data-connect-graphql declaration, not global.
 *
 * Same-kind duplicates are already DUPLICATE_DEFINITION at merge time; this
 * rule closes every cross-kind and derived-identifier hole. Each colliding
 * definition pair is reported once (the first namespace that trips).
 */
export const nameCollisions: ValidationRule = ir => {
  const diagnostics: Diagnostic[] = []
  const reportedPairs = new Set<string>()

  const check = (space: string, claims: NameClaim[]): void => {
    const first = new Map<string, NameClaim>()
    for (const claim of claims) {
      const prev = first.get(claim.identifier)
      if (!prev) {
        first.set(claim.identifier, claim)
        continue
      }
      if (prev.owner === claim.owner) continue
      const pair = [prev.owner, claim.owner].sort().join(' vs ')
      if (reportedPairs.has(pair)) continue
      reportedPairs.add(pair)
      diagnostics.push(
        error('NAME_COLLISION', `${prev.owner} and ${claim.owner} both emit "${claim.identifier}" in the ${space} output`, {
          file: claim.file ?? prev.file,
          path: claim.path,
        })
      )
    }
  }

  const claim = (owner: string, file: string | undefined, path: string, identifiers: string[]): NameClaim[] =>
    identifiers.map(identifier => ({ owner, identifier, file, path }))

  // TypeScript types module: the logical namespace every other output derives from.
  check('TypeScript types', [
    { owner: RESERVED_OWNER, identifier: 'Json', path: '(generated)' },
    ...ir.models.flatMap(m => claim(`model "${m.name}"`, m.sourceFile, `models.${m.name}`, [m.name])),
    ...ir.enums.flatMap(e =>
      claim(`enum "${e.name}"`, e.sourceFile, `enums.${e.name}`, [e.name, `${e.name}Key`, constantCase(e.name)])
    ),
    ...ir.unions.flatMap(u => claim(`union "${u.name}"`, u.sourceFile, `unions.${u.name}`, [u.name])),
  ])

  // zod schemas module: logical names plus their `…Schema` consts.
  check('zod schemas', [
    ...ir.models.flatMap(m => claim(`model "${m.name}"`, m.sourceFile, `models.${m.name}`, [m.name, `${m.name}Schema`])),
    ...ir.enums.flatMap(e => claim(`enum "${e.name}"`, e.sourceFile, `enums.${e.name}`, [e.name, `${e.name}Schema`])),
  ])

  // unions module: union declarations plus the variant schemas imported into it.
  const variantOwners = new Map<string, string>()
  for (const union of ir.unions) for (const variant of union.variants) variantOwners.set(variant, `model "${variant}"`)
  check('unions', [
    ...ir.unions.flatMap(u =>
      claim(`union "${u.name}"`, u.sourceFile, `unions.${u.name}`, [u.name, `${u.name}Schema`])
    ),
    ...[...variantOwners.entries()].map(([variant, owner]) => {
      const model = findModel(ir, variant)
      return { owner, identifier: `${variant}Schema`, file: model?.sourceFile, path: `models.${variant}` }
    }),
  ])

  // firestore module: doc schemas + co-located enums/embedded models under fsName-effective names.
  // Tables are imported as `Dc…Schema` aliases, so they don't claim names here.
  check('firestore', [
    ...['_Meta_', '_Meta_Schema', '_Meta_Operation', '_Meta_OperationSchema', 'FIRESTORE_DATABASES', 'FirestoreDatabaseKey', 'FirestoreDatabaseId'].map(
      identifier => ({ owner: RESERVED_OWNER, identifier, path: '(generated)' })
    ),
    ...ir.firestore.flatMap(d =>
      claim(`firestore doc "${d.name}"`, d.sourceFile, `firestore.${d.name}`, [d.name, `${d.name}Schema`])
    ),
    ...ir.enums.flatMap(e => {
      const fs = e.fsName ?? e.name
      return claim(`enum "${e.name}"`, e.sourceFile, `enums.${e.name}`, [fs, `${fs}Key`, constantCase(fs), `${fs}Schema`])
    }),
    ...ir.models
      .filter(m => !isTable(m))
      .flatMap(m => {
        const fs = m.fsName ?? m.name
        return claim(`model "${m.name}"`, m.sourceFile, `models.${m.name}`, [fs, `${fs}Schema`])
      }),
  ])

  return diagnostics
}

/**
 * GraphQL name uniqueness under `gqlName ?? name`. Unlike {@link nameCollisions}
 * this is NOT a default rule: a GraphQL schema exists per `data-connect-graphql`
 * declaration, scoped to the declaring yml's import subtree — distinct services
 * may intentionally reuse a gqlName (e.g. a `T2…` logical name mapped back to
 * the plain name inside its own service). The compiler runs this check only
 * when the entry document itself declares a GraphQL-emitting generator, i.e.
 * exactly at the scope the schema is generated from.
 */
export const graphqlNameCollisions: ValidationRule = ir => {
  const diagnostics: Diagnostic[] = []
  const first = new Map<string, { owner: string; file?: string; path: string }>()
  const claims = [
    ...ir.models.map(m => ({ owner: `model "${m.name}"`, name: m.gqlName ?? m.name, file: m.sourceFile, path: `models.${m.name}` })),
    ...ir.enums.map(e => ({ owner: `enum "${e.name}"`, name: e.gqlName ?? e.name, file: e.sourceFile, path: `enums.${e.name}` })),
  ]
  for (const { owner, name, file, path } of claims) {
    const prev = first.get(name)
    if (!prev) {
      first.set(name, { owner, file, path })
      continue
    }
    if (prev.owner === owner) continue
    diagnostics.push(
      error('NAME_COLLISION', `${prev.owner} and ${owner} both emit "${name}" in the GraphQL schema output`, { file: file ?? prev.file, path })
    )
  }
  return diagnostics
}

export const DEFAULT_RULES: ValidationRule[] = [
  unresolvedTypes,
  emptyEnums,
  duplicateEnumValues,
  validNames,
  idFields,
  modelKeysAndIndexes,
  relationFields,
  operations,
  apis,
  firestore,
  unions,
  nameCollisions,
]
