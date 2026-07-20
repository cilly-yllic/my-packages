import { Diagnostic, error, warning } from '../diagnostics.js'
import {
  RawApi,
  RawApiPayload,
  RawContract,
  RawField,
  RawFirestoreDoc,
  RawOperation,
} from '../parser/raw-document.js'

import {
  ApiKind,
  AuthLevel,
  Ir,
  IrApi,
  IrApiPayload,
  IrEnum,
  IrEnvelope,
  IrField,
  IrFirestoreDoc,
  IrModel,
  IrOperation,
  IrProject,
  IrSelect,
  IrTypeRef,
  IrUnion,
  MutationAction,
  OperationType,
  isScalarType,
} from './ir.js'

export interface BuildIrResult {
  ir: Ir
  diagnostics: Diagnostic[]
}

const resolveTypeRef = (typeName: string, enumNames: Set<string>, modelNames: Set<string>): IrTypeRef => {
  if (isScalarType(typeName)) {
    return { kind: 'scalar', name: typeName }
  }
  if (enumNames.has(typeName)) {
    return { kind: 'enum', name: typeName }
  }
  if (modelNames.has(typeName)) {
    return { kind: 'model', name: typeName }
  }
  return { kind: 'unresolved', name: typeName }
}

const buildField = (
  name: string,
  raw: RawField,
  enumNames: Set<string>,
  modelNames: Set<string>
): IrField => {
  const constraints: IrField['constraints'] = {}
  if (raw.min !== undefined) constraints.min = raw.min
  if (raw.max !== undefined) constraints.max = raw.max
  if (raw.minLength !== undefined) constraints.minLength = raw.minLength
  if (raw.maxLength !== undefined) constraints.maxLength = raw.maxLength
  if (raw.pattern !== undefined) constraints.pattern = raw.pattern
  if (raw.nonempty !== undefined) constraints.nonempty = raw.nonempty
  if (raw.email !== undefined) constraints.email = raw.email
  if (raw.url !== undefined) constraints.url = raw.url

  const field: IrField = {
    name,
    type: resolveTypeRef(raw.type, enumNames, modelNames),
    constraints,
    optional: raw.optional ?? false,
    list: raw.list ?? false,
    isId: raw.id ?? false,
    unique: raw.unique ?? false,
    relation: raw.relation ?? false,
  }
  if (raw.description !== undefined) field.description = raw.description
  if (raw.nullable !== undefined) field.nullable = raw.nullable
  if (raw.jsdoc !== undefined) field.jsdoc = raw.jsdoc
  if (raw.default !== undefined) field.default = raw.default
  if (raw.col !== undefined) field.col = raw.col
  if (raw.literal !== undefined) field.literal = raw.literal
  return field
}

const OPERATION_TYPES = new Set<string>(['query', 'mutation'])
const MUTATION_ACTIONS = new Set<string>(['insert', 'update', 'upsert', 'delete'])
const AUTH_LEVELS = new Set<string>(['NO_ACCESS', 'PUBLIC', 'USER'])
const API_KINDS = new Set<string>(['callable', 'https', 'task', 'pubsub'])
const ORDER_DIRS = new Set<string>(['ASC', 'DESC'])
const SINGLE_KINDS = new Set<string>(['key', 'id'])
/** Per-key valid values for an operation's `style:` block. */
const STYLE_VALUES: Record<string, Set<string>> = {
  signature: new Set(['inline', 'multi']),
  args: new Set(['inline', 'multi']),
  data: new Set(['inline', 'multi', 'compact']),
  orderBy: new Set(['bare', 'array']),
  auth: new Set(['inline', 'newline']),
  key: new Set(['inline', 'multi']),
  and: new Set(['inline', 'multi']),
  where: new Set(['inline', 'multi']),
}
/**
 * Data Connect scalar/list filter operators. A `where.op` outside this set is
 * warned (not errored): the value is emitted verbatim into GraphQL, so a typo
 * ships broken schema, but the list may lag DC additions — a warning surfaces
 * typos without rejecting a valid-but-unlisted operator.
 */
const WHERE_OPS = new Set<string>([
  'eq', 'ne', 'gt', 'ge', 'lt', 'le', 'in', 'nin', 'isNull',
  'contains', 'startsWith', 'endsWith',
  'includes', 'excludes', 'includesAll', 'includesAny', 'excludesAll', 'excludesAny',
])

/**
 * The contract is the single source of truth, so an out-of-vocabulary *value* is
 * as much a defect as an unknown key: it is silently coerced to a default or
 * dropped, and the generated output no longer reflects what was written. These
 * checks turn that silent coercion into a diagnostic at the coercion site (the
 * raw value is still in hand here; it is lost once the IR is built).
 */
const checkValue = (
  diagnostics: Diagnostic[],
  file: string,
  path: string,
  key: string,
  value: string | undefined,
  valid: Set<string>
): void => {
  if (value !== undefined && !valid.has(value)) {
    diagnostics.push(
      error('INVALID_VALUE', `Invalid ${key} "${value}" — expected one of ${[...valid].join(' | ')}`, { file, path })
    )
  }
}

type RawSelectEntry = { field: string; select?: unknown[]; description?: string; alias?: string; args?: string }

const buildSelect = (entries: RawSelectEntry[]): IrSelect[] =>
  entries.map(entry => ({
    field: entry.field,
    ...(entry.select !== undefined ? { select: buildSelect(entry.select as RawSelectEntry[]) } : {}),
    ...(entry.description !== undefined ? { description: entry.description } : {}),
    ...(entry.alias !== undefined ? { alias: entry.alias } : {}),
    ...(entry.args !== undefined ? { args: entry.args } : {}),
  }))

const buildOperation = (name: string, raw: RawOperation, sourceFile: string, diagnostics: Diagnostic[]): IrOperation => {
  const path = `operations.${name}`
  checkValue(diagnostics, sourceFile, `${path}.type`, 'type', raw.type, OPERATION_TYPES)
  checkValue(diagnostics, sourceFile, `${path}.auth`, 'auth', raw.auth, AUTH_LEVELS)
  checkValue(diagnostics, sourceFile, `${path}.action`, 'action', raw.action, MUTATION_ACTIONS)
  checkValue(diagnostics, sourceFile, `${path}.single`, 'single', raw.single, SINGLE_KINDS)
  checkValue(diagnostics, sourceFile, `${path}.keyArg`, 'keyArg', raw.keyArg, SINGLE_KINDS)
  for (const o of raw.orderBy ?? []) checkValue(diagnostics, sourceFile, `${path}.orderBy`, 'orderBy dir', o.dir, ORDER_DIRS)
  for (const [k, v] of Object.entries(raw.style ?? {})) {
    if (STYLE_VALUES[k]) checkValue(diagnostics, sourceFile, `${path}.style.${k}`, `style.${k}`, v as string, STYLE_VALUES[k])
  }
  for (const w of raw.where ?? []) {
    if (w.op !== undefined && !WHERE_OPS.has(w.op)) {
      diagnostics.push(
        warning('UNKNOWN_WHERE_OP', `Unknown where operator "${w.op}" on ${path} — emitted verbatim into GraphQL; verify it is a valid Data Connect operator`, {
          file: sourceFile,
          path: `${path}.where`,
        })
      )
    }
  }
  const op: IrOperation = {
    name,
    operationType: (OPERATION_TYPES.has(raw.type) ? raw.type : 'query') as OperationType,
    model: raw.model,
    auth: (raw.auth && AUTH_LEVELS.has(raw.auth) ? raw.auth : 'NO_ACCESS') as AuthLevel,
    inputs: raw.inputs ?? [],
    where: raw.where ?? [],
    select: buildSelect(raw.select ?? []),
    orderBy: (raw.orderBy ?? []).map(o => ({ field: o.field, dir: o.dir === 'DESC' ? 'DESC' : 'ASC' })),
    exprs: raw.exprs ?? [],
    inc: raw.inc ?? [],
    connectors: raw.connectors ?? [],
    sourceFile,
  }
  if (raw.action !== undefined && MUTATION_ACTIONS.has(raw.action)) op.action = raw.action as MutationAction
  if (raw.authReason !== undefined) op.authReason = raw.authReason
  if (raw.description !== undefined) op.description = raw.description
  if (raw.limit !== undefined) op.limit = raw.limit
  if (raw.single !== undefined && (raw.single === 'key' || raw.single === 'id')) op.single = raw.single
  if (raw.keyArg !== undefined && (raw.keyArg === 'key' || raw.keyArg === 'id')) op.keyArg = raw.keyArg
  if (raw.keyVars !== undefined) op.keyVars = { ...raw.keyVars }
  if (raw.entityDir !== undefined) op.entityDir = raw.entityDir
  if (raw.whereAnd !== undefined) op.whereAnd = raw.whereAnd
  if (raw.gqlName !== undefined) op.gqlName = raw.gqlName
  if (raw.footer !== undefined) op.footer = raw.footer
  if (raw.raw !== undefined) op.raw = raw.raw
  if (raw.style !== undefined) {
    op.style = {
      ...(raw.style.signature === 'inline' || raw.style.signature === 'multi' ? { signature: raw.style.signature } : {}),
      ...(raw.style.args === 'inline' || raw.style.args === 'multi' ? { args: raw.style.args } : {}),
      ...(raw.style.data === 'inline' || raw.style.data === 'multi' || raw.style.data === 'compact' ? { data: raw.style.data } : {}),
      ...(raw.style.orderBy === 'bare' || raw.style.orderBy === 'array' ? { orderBy: raw.style.orderBy } : {}),
      ...(raw.style.auth === 'inline' || raw.style.auth === 'newline' ? { auth: raw.style.auth } : {}),
      ...(raw.style.key === 'inline' || raw.style.key === 'multi' ? { key: raw.style.key } : {}),
      ...(raw.style.and === 'inline' || raw.style.and === 'multi' ? { and: raw.style.and } : {}),
      ...(raw.style.where === 'inline' || raw.style.where === 'multi' ? { where: raw.style.where } : {}),
    }
  }
  if (raw.aggregate !== undefined) op.aggregate = { count: raw.aggregate.count ?? false, sum: raw.aggregate.sum ?? [] }
  return op
}

const buildApiPayload = (
  raw: RawApiPayload | undefined,
  enumNames: Set<string>,
  modelNames: Set<string>
): IrApiPayload => {
  const fields = raw?.fields
    ? Object.entries(raw.fields).map(([fieldName, rawField]) => buildField(fieldName, rawField, enumNames, modelNames))
    : []
  const payload: IrApiPayload = { fields, isVoid: raw?.void ?? false }
  if (raw?.model !== undefined) payload.model = raw.model
  return payload
}

const buildApi = (
  name: string,
  raw: RawApi,
  sourceFile: string,
  enumNames: Set<string>,
  modelNames: Set<string>,
  diagnostics: Diagnostic[]
): IrApi => {
  checkValue(diagnostics, sourceFile, `apis.${name}.kind`, 'kind', raw.kind, API_KINDS)
  const api: IrApi = {
    name,
    kind: (API_KINDS.has(raw.kind) ? raw.kind : 'callable') as ApiKind,
    request: buildApiPayload(raw.request, enumNames, modelNames),
    response: buildApiPayload(raw.response, enumNames, modelNames),
    sourceFile,
  }
  if (raw.method !== undefined) api.method = raw.method
  if (raw.path !== undefined) api.path = raw.path
  if (raw.description !== undefined) api.description = raw.description
  if (
    raw.envelope !== undefined ||
    raw.maxAttempts !== undefined ||
    raw.timeoutSeconds !== undefined ||
    raw.topic !== undefined
  ) {
    api.task = {
      ...(raw.envelope !== undefined ? { envelope: raw.envelope } : {}),
      ...(raw.maxAttempts !== undefined ? { maxAttempts: raw.maxAttempts } : {}),
      ...(raw.timeoutSeconds !== undefined ? { timeoutSeconds: raw.timeoutSeconds } : {}),
      ...(raw.topic !== undefined ? { topic: raw.topic } : {}),
    }
  }
  return api
}

const buildFirestoreDoc = (
  name: string,
  raw: RawFirestoreDoc,
  sourceFile: string,
  enumNames: Set<string>,
  modelNames: Set<string>
): IrFirestoreDoc => {
  const fields = raw.fields
    ? Object.entries(raw.fields).map(([fieldName, rawField]) => buildField(fieldName, rawField, enumNames, modelNames))
    : []
  const doc: IrFirestoreDoc = {
    name,
    pick: raw.pick ?? [],
    omit: raw.omit ?? [],
    fields,
    meta: raw.meta ?? true,
    sourceFile,
  }
  if (raw.from !== undefined) doc.from = raw.from
  if (raw.collection !== undefined) doc.collection = raw.collection
  if (raw.description !== undefined) doc.description = raw.description
  if (raw.helpers !== undefined) doc.helpers = raw.helpers
  if (raw.include !== undefined) doc.include = [...raw.include]
  return doc
}

/**
 * Merge every resolved document into one normalized {@link Ir}.
 *
 * Type names on fields are resolved against the full set of enums and models
 * gathered from all documents, so imports work transparently. Names defined in
 * more than one place are reported as `DUPLICATE_DEFINITION` and the first
 * definition wins. Unknown type names are left as `unresolved` refs for the
 * validation step to flag.
 */
export const buildIr = (documents: RawContract[]): BuildIrResult => {
  const diagnostics: Diagnostic[] = []

  const enumSources = new Map<string, RawContract>()
  const modelSources = new Map<string, RawContract>()

  // First pass: collect names (needed to resolve refs regardless of order).
  for (const doc of documents) {
    for (const name of Object.keys(doc.enums)) {
      if (enumSources.has(name)) {
        diagnostics.push(
          error('DUPLICATE_DEFINITION', `Enum "${name}" is defined more than once`, {
            file: doc.filePath,
            path: `enums.${name}`,
          })
        )
        continue
      }
      enumSources.set(name, doc)
    }
    for (const name of Object.keys(doc.models)) {
      if (modelSources.has(name)) {
        diagnostics.push(
          error('DUPLICATE_DEFINITION', `Model "${name}" is defined more than once`, {
            file: doc.filePath,
            path: `models.${name}`,
          })
        )
        continue
      }
      modelSources.set(name, doc)
    }
  }

  const enumNames = new Set(enumSources.keys())
  const modelNames = new Set(modelSources.keys())

  const enums: IrEnum[] = []
  for (const [name, doc] of enumSources) {
    const raw = doc.enums[name]
    const irEnum: IrEnum = { name, values: [...raw.values], sourceFile: doc.filePath }
    if (raw.description !== undefined) irEnum.description = raw.description
    if (raw.valueComments !== undefined) irEnum.valueComments = { ...raw.valueComments }
    if (raw.valueKeys !== undefined) irEnum.valueKeys = { ...raw.valueKeys }
    if (raw.gqlName !== undefined) irEnum.gqlName = raw.gqlName
    if (raw.fsName !== undefined) irEnum.fsName = raw.fsName
    if (raw.fsDescription !== undefined) irEnum.fsDescription = raw.fsDescription
    enums.push(irEnum)
  }

  const models: IrModel[] = []
  for (const [name, doc] of modelSources) {
    const raw = doc.models[name]
    const fields = Object.entries(raw.fields).map(([fieldName, rawField]) =>
      buildField(fieldName, rawField, enumNames, modelNames)
    )
    const model: IrModel = {
      name,
      fields,
      key: raw.key ?? [],
      indexes: (raw.indexes ?? []).map(index => ({
        fields: index.fields,
        ...(index.name !== undefined ? { name: index.name } : {}),
        unique: index.unique ?? false,
        ...(index.expand !== undefined ? { expand: index.expand } : {}),
      })),
      sourceFile: doc.filePath,
    }
    if (raw.description !== undefined) model.description = raw.description
    if (raw.table !== undefined) model.table = raw.table
    if (raw.gqlName !== undefined) model.gqlName = raw.gqlName
    if (raw.directives === 'inline' || raw.directives === 'multi') model.directives = raw.directives
    if (raw.footer !== undefined) model.footer = raw.footer
    if (raw.fsName !== undefined) model.fsName = raw.fsName
    if (raw.sql !== undefined) {
      model.sql = {
        checks: raw.sql.checks ?? [],
        foreignKeys: (raw.sql.foreignKeys ?? []).map(fk => ({
          columns: fk.columns,
          references: fk.references,
          ...(fk.name !== undefined ? { name: fk.name } : {}),
        })),
        indexes: (raw.sql.indexes ?? []).map(idx => ({
          columns: idx.columns,
          ...(idx.name !== undefined ? { name: idx.name } : {}),
          unique: idx.unique ?? false,
        })),
      }
    }
    models.push(model)
  }

  // Operation names are namespaced per connector (a real Data Connect layout has
  // e.g. GetUserById in every connector, with different shapes). A duplicate is
  // only an error when the same name targets an overlapping connector set.
  const operationEntries: { name: string; doc: RawContract }[] = []
  const connectorsOf = (doc: RawContract, name: string): string[] => {
    const cs = doc.operations[name].connectors ?? []
    return cs.length > 0 ? cs : ['']
  }
  const apiSources = new Map<string, RawContract>()
  for (const doc of documents) {
    for (const name of Object.keys(doc.operations)) {
      const incoming = connectorsOf(doc, name)
      const clash = operationEntries.find(
        entry => entry.name === name && connectorsOf(entry.doc, name).some(c => incoming.includes(c))
      )
      if (clash) {
        diagnostics.push(
          error('DUPLICATE_DEFINITION', `Operation "${name}" is defined more than once for the same connector`, {
            file: doc.filePath,
            path: `operations.${name}`,
          })
        )
        continue
      }
      operationEntries.push({ name, doc })
    }
    for (const name of Object.keys(doc.apis)) {
      if (apiSources.has(name)) {
        diagnostics.push(
          error('DUPLICATE_DEFINITION', `Api "${name}" is defined more than once`, {
            file: doc.filePath,
            path: `apis.${name}`,
          })
        )
        continue
      }
      apiSources.set(name, doc)
    }
  }

  const operations: IrOperation[] = []
  for (const { name, doc } of operationEntries) {
    operations.push(buildOperation(name, doc.operations[name], doc.filePath, diagnostics))
  }

  const apis: IrApi[] = []
  for (const [name, doc] of apiSources) {
    apis.push(buildApi(name, doc.apis[name], doc.filePath, enumNames, modelNames, diagnostics))
  }

  const unionSources = new Map<string, RawContract>()
  for (const doc of documents) {
    for (const name of Object.keys(doc.unions)) {
      if (unionSources.has(name)) {
        diagnostics.push(
          error('DUPLICATE_DEFINITION', `Union "${name}" is defined more than once`, {
            file: doc.filePath,
            path: `unions.${name}`,
          })
        )
        continue
      }
      unionSources.set(name, doc)
    }
  }
  const unions: IrUnion[] = []
  for (const [name, doc] of unionSources) {
    const raw = doc.unions[name]
    const union: IrUnion = {
      name,
      discriminant: raw.discriminant,
      variants: raw.variants,
      sourceFile: doc.filePath,
    }
    if (raw.description !== undefined) union.description = raw.description
    unions.push(union)
  }

  const firestoreSources = new Map<string, RawContract>()
  for (const doc of documents) {
    for (const name of Object.keys(doc.firestore)) {
      if (firestoreSources.has(name)) {
        diagnostics.push(
          error('DUPLICATE_DEFINITION', `Firestore doc "${name}" is defined more than once`, {
            file: doc.filePath,
            path: `firestore.${name}`,
          })
        )
        continue
      }
      firestoreSources.set(name, doc)
    }
  }
  const firestore: IrFirestoreDoc[] = []
  for (const [name, doc] of firestoreSources) {
    firestore.push(buildFirestoreDoc(name, doc.firestore[name], doc.filePath, enumNames, modelNames))
  }

  const envelopeSources = new Map<string, RawContract>()
  for (const doc of documents) {
    for (const name of Object.keys(doc.envelopes)) {
      if (envelopeSources.has(name)) {
        diagnostics.push(
          error('DUPLICATE_DEFINITION', `Envelope "${name}" is defined more than once`, {
            file: doc.filePath,
            path: `envelopes.${name}`,
          })
        )
        continue
      }
      envelopeSources.set(name, doc)
    }
  }
  const envelopes: IrEnvelope[] = []
  for (const [name, doc] of envelopeSources) {
    const raw = doc.envelopes[name]
    const envelope: IrEnvelope = {
      name,
      fields: Object.entries(raw.fields).map(([fieldName, rawField]) =>
        buildField(fieldName, rawField, enumNames, modelNames)
      ),
      sourceFile: doc.filePath,
    }
    if (raw.description !== undefined) envelope.description = raw.description
    envelopes.push(envelope)
  }

  let header: string | undefined
  for (const doc of documents) {
    if (doc.header !== undefined) {
      header = doc.header
      break
    }
  }

  let project: IrProject | undefined
  for (const doc of documents) {
    if (doc.project) {
      project = {
        services: (doc.project.services ?? []).map(service => ({
          name: service.name,
          ...(service.database !== undefined ? { database: service.database } : {}),
          ...(service.location !== undefined ? { location: service.location } : {}),
          connectors: service.connectors ?? [],
        })),
        codebases: Object.entries(doc.project.codebases ?? {}).map(([codebase, service]) => ({ codebase, service })),
        ...(doc.project.idCodec ? { idCodec: { ...doc.project.idCodec } } : {}),
      }
      break
    }
  }

  return {
    ir: {
      enums,
      models,
      operations,
      apis,
      firestore,
      unions,
      envelopes,
      ...(project ? { project } : {}),
      ...(header !== undefined ? { header } : {}),
    },
    diagnostics,
  }
}
