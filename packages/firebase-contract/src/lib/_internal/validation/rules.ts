import { Diagnostic, error, warning } from '../diagnostics.js'
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
]
