import { parse as parseYamlText } from 'yaml'

import { ContractError, error } from '../diagnostics.js'

import {
  RawApi,
  RawApiPayload,
  RawContract,
  RawEnum,
  RawEnvelope,
  RawField,
  RawFirestoreDoc,
  RawModel,
  RawOperation,
  RawProject,
  RawService,
  RawGeneratorDecl,
  RawGeneratorUse,
  RawSectionDefaults,
  RawUnion,
} from './raw-document.js'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const fail = (message: string, filePath: string, path?: string): never => {
  throw new ContractError(message, [error('PARSE_ERROR', message, { file: filePath, path })])
}

const normalizeField = (raw: unknown, filePath: string, path: string): RawField => {
  // Shorthand: `title: string` — the value is the type name.
  if (typeof raw === 'string') {
    return { type: raw }
  }
  if (!isObject(raw)) {
    return fail(`Field "${path}" must be a type name or an object`, filePath, path)
  }
  if (typeof raw.type !== 'string') {
    return fail(`Field "${path}" is missing a string "type"`, filePath, path)
  }
  const field: RawField = { type: raw.type }
  if (raw.optional !== undefined) field.optional = Boolean(raw.optional)
  if (raw.nullable !== undefined) field.nullable = Boolean(raw.nullable)
  if (raw.jsdoc !== undefined) field.jsdoc = Boolean(raw.jsdoc)
  if (raw.list !== undefined) field.list = Boolean(raw.list)
  if (raw.id !== undefined) field.id = Boolean(raw.id)
  if (raw.unique !== undefined) field.unique = Boolean(raw.unique)
  if (raw.relation !== undefined) field.relation = Boolean(raw.relation)
  if (raw.default !== undefined) field.default = raw.default
  if (raw.description !== undefined) field.description = String(raw.description)
  if (raw.min !== undefined) field.min = Number(raw.min)
  if (raw.max !== undefined) field.max = Number(raw.max)
  if (raw.minLength !== undefined) field.minLength = Number(raw.minLength)
  if (raw.maxLength !== undefined) field.maxLength = Number(raw.maxLength)
  if (raw.pattern !== undefined) field.pattern = String(raw.pattern)
  if (raw.nonempty !== undefined) field.nonempty = Boolean(raw.nonempty)
  if (raw.email !== undefined) field.email = Boolean(raw.email)
  if (raw.url !== undefined) field.url = Boolean(raw.url)
  if (raw.col !== undefined) field.col = String(raw.col)
  if (raw.literal !== undefined) field.literal = String(raw.literal)
  return field
}

const normalizeModel = (raw: unknown, filePath: string, name: string): RawModel => {
  if (!isObject(raw)) {
    return fail(`Model "${name}" must be an object`, filePath, `models.${name}`)
  }
  const fieldsRaw = raw.fields
  if (!isObject(fieldsRaw)) {
    return fail(`Model "${name}" is missing a "fields" object`, filePath, `models.${name}.fields`)
  }
  const fields: Record<string, RawField> = {}
  for (const [fieldName, fieldRaw] of Object.entries(fieldsRaw)) {
    fields[fieldName] = normalizeField(fieldRaw, filePath, `models.${name}.fields.${fieldName}`)
  }
  const model: RawModel = { fields }
  if (raw.description !== undefined) model.description = String(raw.description)
  if (raw.key !== undefined) model.key = asStringArray(raw.key, filePath, `models.${name}.key`)
  if (raw.table !== undefined) model.table = String(raw.table)
  if (raw.gqlName !== undefined) model.gqlName = String(raw.gqlName)
  if (raw.directives !== undefined) model.directives = String(raw.directives)
  if (raw.footer !== undefined) model.footer = String(raw.footer)
  if (raw.fsName !== undefined) model.fsName = String(raw.fsName)
  if (raw.indexes !== undefined) {
    if (!Array.isArray(raw.indexes)) {
      return fail(`Model "${name}" indexes must be an array`, filePath, `models.${name}.indexes`)
    }
    model.indexes = raw.indexes.map((entry, i) => {
      if (!isObject(entry)) {
        return fail(`Model "${name}" index #${i} must be an object`, filePath, `models.${name}.indexes`)
      }
      const index: { fields: string[]; name?: string; unique?: boolean; expand?: boolean } = {
        fields: asStringArray(entry.fields, filePath, `models.${name}.indexes[${i}].fields`),
      }
      if (entry.name !== undefined) index.name = String(entry.name)
      if (entry.unique !== undefined) index.unique = Boolean(entry.unique)
      if (entry.expand !== undefined) index.expand = Boolean(entry.expand)
      return index
    })
  }
  if (raw.sql !== undefined) {
    if (!isObject(raw.sql)) {
      return fail(`Model "${name}" sql must be an object`, filePath, `models.${name}.sql`)
    }
    const sqlRaw = raw.sql
    const sql: NonNullable<RawModel['sql']> = {}
    if (sqlRaw.checks !== undefined) sql.checks = asStringArray(sqlRaw.checks, filePath, `models.${name}.sql.checks`)
    if (sqlRaw.foreignKeys !== undefined) {
      if (!Array.isArray(sqlRaw.foreignKeys)) {
        return fail(`Model "${name}" sql.foreignKeys must be an array`, filePath, `models.${name}.sql.foreignKeys`)
      }
      sql.foreignKeys = sqlRaw.foreignKeys.map((entry, i) => {
        if (!isObject(entry) || typeof entry.references !== 'string') {
          return fail(`Model "${name}" sql.foreignKeys[${i}] needs columns + references`, filePath, `models.${name}.sql.foreignKeys`)
        }
        const fk: { columns: string[]; references: string; name?: string } = {
          columns: asStringArray(entry.columns, filePath, `models.${name}.sql.foreignKeys[${i}].columns`),
          references: entry.references,
        }
        if (entry.name !== undefined) fk.name = String(entry.name)
        return fk
      })
    }
    if (sqlRaw.indexes !== undefined) {
      if (!Array.isArray(sqlRaw.indexes)) {
        return fail(`Model "${name}" sql.indexes must be an array`, filePath, `models.${name}.sql.indexes`)
      }
      sql.indexes = sqlRaw.indexes.map((entry, i) => {
        if (!isObject(entry)) {
          return fail(`Model "${name}" sql.indexes[${i}] must be an object`, filePath, `models.${name}.sql.indexes`)
        }
        const idx: { columns: string[]; name?: string; unique?: boolean } = {
          columns: asStringArray(entry.columns, filePath, `models.${name}.sql.indexes[${i}].columns`),
        }
        if (entry.name !== undefined) idx.name = String(entry.name)
        if (entry.unique !== undefined) idx.unique = Boolean(entry.unique)
        return idx
      })
    }
    model.sql = sql
  }
  return model
}

const normalizeEnum = (raw: unknown, filePath: string, name: string): RawEnum => {
  if (!isObject(raw)) {
    return fail(`Enum "${name}" must be an object`, filePath, `enums.${name}`)
  }
  if (!Array.isArray(raw.values)) {
    return fail(`Enum "${name}" is missing a "values" array`, filePath, `enums.${name}.values`)
  }
  const values: string[] = []
  const valueComments: Record<string, string> = {}
  const valueKeys: Record<string, string> = {}
  for (const entry of raw.values) {
    if (isObject(entry) && typeof entry.value === 'string') {
      values.push(entry.value)
      if (entry.description !== undefined) valueComments[entry.value] = String(entry.description)
      if (entry.key !== undefined) valueKeys[entry.value] = String(entry.key)
    } else {
      values.push(String(entry))
    }
  }
  const result: RawEnum = { values }
  if (Object.keys(valueComments).length > 0) result.valueComments = valueComments
  if (Object.keys(valueKeys).length > 0) result.valueKeys = valueKeys
  if (raw.gqlName !== undefined) result.gqlName = String(raw.gqlName)
  if (raw.fsName !== undefined) result.fsName = String(raw.fsName)
  if (raw.fsDescription !== undefined) result.fsDescription = String(raw.fsDescription)
  if (raw.description !== undefined) result.description = String(raw.description)
  return result
}

const asStringArray = (value: unknown, filePath: string, path: string): string[] => {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    return fail(`"${path}" must be an array of strings`, filePath, path)
  }
  return value.map(entry => String(entry))
}

const normalizeOperation = (raw: unknown, filePath: string, name: string): RawOperation => {
  if (!isObject(raw)) {
    return fail(`Operation "${name}" must be an object`, filePath, `operations.${name}`)
  }
  if (typeof raw.type !== 'string') {
    return fail(`Operation "${name}" is missing a string "type" (query|mutation)`, filePath, `operations.${name}.type`)
  }
  if (typeof raw.model !== 'string') {
    return fail(`Operation "${name}" is missing a string "model"`, filePath, `operations.${name}.model`)
  }
  const op: RawOperation = { type: raw.type, model: raw.model }
  if (raw.action !== undefined) op.action = String(raw.action)
  if (raw.auth !== undefined) op.auth = String(raw.auth)
  if (raw.authReason !== undefined) op.authReason = String(raw.authReason)
  if (raw.inputs !== undefined) {
    if (!Array.isArray(raw.inputs)) {
      return fail(`Operation "${name}" inputs must be an array`, filePath, `operations.${name}.inputs`)
    }
    op.inputs = raw.inputs.map(entry => {
      if (typeof entry === 'string') return { field: entry }
      if (isObject(entry) && typeof entry.field === 'string') {
        return {
          field: entry.field,
          ...(entry.required !== undefined ? { required: Boolean(entry.required) } : {}),
          ...(entry.description !== undefined ? { description: String(entry.description) } : {}),
          ...(entry.var !== undefined ? { var: String(entry.var) } : {}),
          ...(entry.flat !== undefined ? { flat: Boolean(entry.flat) } : {}),
          ...(entry.literal !== undefined ? { literal: String(entry.literal) } : {}),
          ...(entry.quote !== undefined ? { quote: Boolean(entry.quote) } : {}),
          ...(entry.inc !== undefined ? { inc: Boolean(entry.inc) } : {}),
          ...(entry.asKey !== undefined ? { asKey: Boolean(entry.asKey) } : {}),
        }
      }
      return fail(`Operation "${name}" inputs entry must be a field or { field, ... }`, filePath, `operations.${name}.inputs`)
    })
  }
  if (raw.select !== undefined) {
    const normalizeSelect = (entries: unknown, path: string): { field: string; select?: unknown[]; description?: string }[] => {
      if (!Array.isArray(entries)) {
        return fail(`"${path}" must be an array`, filePath, path)
      }
      return entries.map(entry => {
        if (typeof entry === 'string') return { field: entry }
        if (isObject(entry) && typeof entry.field === 'string') {
          return {
            field: entry.field,
            ...(entry.select !== undefined ? { select: normalizeSelect(entry.select, `${path}.${entry.field}`) } : {}),
            ...(entry.description !== undefined ? { description: String(entry.description) } : {}),
            ...(entry.alias !== undefined ? { alias: String(entry.alias) } : {}),
            ...(entry.args !== undefined ? { args: String(entry.args) } : {}),
          }
        }
        return fail(`"${path}" entry must be a field or { field, select }`, filePath, path)
      })
    }
    op.select = normalizeSelect(raw.select, `operations.${name}.select`)
  }
  // where: array of "field" (eq) or { field, op }.
  if (raw.where !== undefined) {
    if (!Array.isArray(raw.where)) {
      return fail(`Operation "${name}" where must be an array`, filePath, `operations.${name}.where`)
    }
    op.where = raw.where.map(entry => {
      if (typeof entry === 'string') return { field: entry, op: 'eq' }
      if (isObject(entry) && typeof entry.field === 'string') {
        return {
          field: entry.field,
          op: entry.op !== undefined ? String(entry.op) : 'eq',
          ...(entry.required !== undefined ? { required: Boolean(entry.required) } : {}),
          ...(entry.description !== undefined ? { description: String(entry.description) } : {}),
          ...(entry.var !== undefined ? { var: String(entry.var) } : {}),
          ...(entry.literal !== undefined ? { literal: String(entry.literal) } : {}),
          ...(entry.flat !== undefined ? { flat: Boolean(entry.flat) } : {}),
        }
      }
      return fail(`Operation "${name}" where entry must be a field or { field, op }`, filePath, `operations.${name}.where`)
    })
  }
  // orderBy: array of { field, dir } (dir defaults to ASC).
  if (raw.orderBy !== undefined) {
    if (!Array.isArray(raw.orderBy)) {
      return fail(`Operation "${name}" orderBy must be an array`, filePath, `operations.${name}.orderBy`)
    }
    op.orderBy = raw.orderBy.map(entry => {
      if (!isObject(entry) || typeof entry.field !== 'string') {
        return fail(`Operation "${name}" orderBy entry needs a field`, filePath, `operations.${name}.orderBy`)
      }
      return { field: entry.field, dir: entry.dir !== undefined ? String(entry.dir).toUpperCase() : 'ASC' }
    })
  }
  if (raw.limit !== undefined) {
    if (isObject(raw.limit) && typeof raw.limit.var === 'string') {
      op.limit = {
        var: raw.limit.var,
        ...(raw.limit.default !== undefined ? { default: Number(raw.limit.default) } : {}),
        ...(raw.limit.required !== undefined ? { required: Boolean(raw.limit.required) } : {}),
      }
    } else {
      op.limit = Number(raw.limit)
    }
  }
  if (raw.single !== undefined) op.single = String(raw.single) as 'key' | 'id'
  if (raw.keyArg !== undefined) op.keyArg = String(raw.keyArg) as 'key' | 'id'
  if (raw.entityDir !== undefined) op.entityDir = String(raw.entityDir)
  if (raw.whereAnd !== undefined) op.whereAnd = Boolean(raw.whereAnd)
  if (raw.gqlName !== undefined) op.gqlName = String(raw.gqlName)
  if (raw.footer !== undefined) op.footer = String(raw.footer)
  if (raw.raw !== undefined) op.raw = String(raw.raw)
  if (raw.style !== undefined) {
    if (!isObject(raw.style)) {
      return fail(`Operation "${name}" style must be a mapping`, filePath, `operations.${name}.style`)
    }
    const style: { signature?: string; args?: string; data?: string; orderBy?: string; auth?: string; key?: string; and?: string; where?: string } = {}
    for (const k of ['signature', 'args', 'data', 'orderBy', 'auth', 'key', 'and', 'where'] as const) {
      if (raw.style[k] !== undefined) style[k] = String(raw.style[k])
    }
    op.style = style
  }
  if (raw.keyVars !== undefined && isObject(raw.keyVars)) {
    const keyVars: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw.keyVars)) keyVars[k] = String(v)
    op.keyVars = keyVars
  }
  if (raw.aggregate !== undefined) {
    if (!isObject(raw.aggregate)) {
      return fail(`Operation "${name}" aggregate must be an object`, filePath, `operations.${name}.aggregate`)
    }
    op.aggregate = {
      count: raw.aggregate.count !== undefined ? Boolean(raw.aggregate.count) : false,
      sum: asStringArray(raw.aggregate.sum, filePath, `operations.${name}.aggregate.sum`),
    }
  }
  if (raw.exprs !== undefined) {
    if (!isObject(raw.exprs)) {
      return fail(`Operation "${name}" exprs must be a mapping`, filePath, `operations.${name}.exprs`)
    }
    op.exprs = Object.entries(raw.exprs).map(([field, expr]) => ({ field, expr: String(expr) }))
  }
  if (raw.inc !== undefined) {
    if (!Array.isArray(raw.inc)) {
      return fail(`Operation "${name}" inc must be an array`, filePath, `operations.${name}.inc`)
    }
    op.inc = raw.inc.map(entry => {
      if (typeof entry === 'string') return { field: entry }
      if (isObject(entry) && typeof entry.field === 'string') {
        return { field: entry.field, ...(entry.var !== undefined ? { var: String(entry.var) } : {}) }
      }
      return fail(`Operation "${name}" inc entry must be a field or { field, var }`, filePath, `operations.${name}.inc`)
    })
  }
  // `connector: app` (single) or `connectors: [app, api]` (multiple).
  if (raw.connector !== undefined) {
    op.connectors = [String(raw.connector)]
  } else if (raw.connectors !== undefined) {
    op.connectors = asStringArray(raw.connectors, filePath, `operations.${name}.connectors`)
  }
  if (raw.description !== undefined) op.description = String(raw.description)
  return op
}

const normalizeApiPayload = (raw: unknown, filePath: string, path: string): RawApiPayload => {
  if (raw === undefined) return {}
  if (!isObject(raw)) {
    return fail(`"${path}" must be an object`, filePath, path)
  }
  const payload: RawApiPayload = {}
  if (raw.model !== undefined) payload.model = String(raw.model)
  if (raw.void !== undefined) payload.void = Boolean(raw.void)
  if (raw.fields !== undefined) {
    if (!isObject(raw.fields)) {
      return fail(`"${path}.fields" must be a mapping`, filePath, `${path}.fields`)
    }
    const fields: Record<string, RawField> = {}
    for (const [fieldName, fieldRaw] of Object.entries(raw.fields)) {
      fields[fieldName] = normalizeField(fieldRaw, filePath, `${path}.fields.${fieldName}`)
    }
    payload.fields = fields
  }
  return payload
}

const normalizeGeneratorUse = (raw: unknown, filePath: string, path: string): RawGeneratorUse => {
  if (typeof raw === 'string') return { generator: raw }
  if (!isObject(raw) || typeof raw.generator !== 'string') {
    return fail(`"${path}" must be a generator name or { generator, out? }`, filePath, path)
  }
  const use: RawGeneratorUse = { generator: raw.generator }
  if (raw.out !== undefined) use.out = String(raw.out)
  return use
}

const normalizeGeneratorUses = (raw: unknown, filePath: string, path: string): RawGeneratorUse[] => {
  if (!Array.isArray(raw)) {
    return fail(`"${path}" must be an array of generator applications`, filePath, path)
  }
  return raw.map((entry, i) => normalizeGeneratorUse(entry, filePath, `${path}[${i}]`))
}

/** Reserved key inside `apis:/tasks:/events:` holding section-level defaults. */
const SECTION_DEFAULTS_KEY = 'defaults'

const normalizeSectionDefaults = (raw: unknown, filePath: string, section: string): RawGeneratorUse[] => {
  if (!isObject(raw)) {
    return fail(`"${section}.${SECTION_DEFAULTS_KEY}" must be an object`, filePath, `${section}.${SECTION_DEFAULTS_KEY}`)
  }
  if (raw.generators === undefined) return []
  return normalizeGeneratorUses(raw.generators, filePath, `${section}.${SECTION_DEFAULTS_KEY}.generators`)
}

/**
 * Path-keyed api entry (`apis:` section, key starts with `/`): kind defaults to
 * `https` (or `callable` when declared), `operationId` names the generated types.
 */
const normalizePathApi = (raw: unknown, filePath: string, pathKey: string): { name: string; api: RawApi } => {
  if (!isObject(raw)) {
    return fail(`Api "${pathKey}" must be an object`, filePath, `apis.${pathKey}`)
  }
  if (typeof raw.operationId !== 'string' || raw.operationId.length === 0) {
    return fail(`Api "${pathKey}" is missing a string "operationId" (used as the generated name)`, filePath, `apis.${pathKey}.operationId`)
  }
  const kind = raw.kind === undefined ? 'https' : String(raw.kind)
  if (kind !== 'https' && kind !== 'callable') {
    return fail(`Api "${pathKey}" kind must be https|callable (tasks/events have their own sections)`, filePath, `apis.${pathKey}.kind`)
  }
  const api: RawApi = { kind, path: pathKey }
  if (raw.method !== undefined) api.method = String(raw.method)
  if (raw.description !== undefined) api.description = String(raw.description)
  api.request = normalizeApiPayload(raw.request, filePath, `apis.${pathKey}.request`)
  api.response = normalizeApiPayload(raw.response, filePath, `apis.${pathKey}.response`)
  if (raw.generators !== undefined) {
    api.generators = normalizeGeneratorUses(raw.generators, filePath, `apis.${pathKey}.generators`)
  }
  return { name: raw.operationId, api }
}

/** `tasks:` section entry — a Cloud Task api (kind is implied, key is the name). */
const normalizeTask = (raw: unknown, filePath: string, name: string): RawApi => {
  if (!isObject(raw)) {
    return fail(`Task "${name}" must be an object`, filePath, `tasks.${name}`)
  }
  const api: RawApi = { kind: 'task' }
  if (raw.description !== undefined) api.description = String(raw.description)
  if (raw.envelope !== undefined) api.envelope = String(raw.envelope)
  if (raw.maxAttempts !== undefined) api.maxAttempts = Number(raw.maxAttempts)
  if (raw.timeoutSeconds !== undefined) api.timeoutSeconds = Number(raw.timeoutSeconds)
  api.request = normalizeApiPayload(raw.request, filePath, `tasks.${name}.request`)
  api.response = normalizeApiPayload(raw.response, filePath, `tasks.${name}.response`)
  if (raw.generators !== undefined) {
    api.generators = normalizeGeneratorUses(raw.generators, filePath, `tasks.${name}.generators`)
  }
  return api
}

/** `events:` section entry — a Pub/Sub api (kind is implied, key is the name). */
const normalizeEvent = (raw: unknown, filePath: string, name: string): RawApi => {
  if (!isObject(raw)) {
    return fail(`Event "${name}" must be an object`, filePath, `events.${name}`)
  }
  const api: RawApi = { kind: 'pubsub' }
  if (raw.description !== undefined) api.description = String(raw.description)
  if (raw.envelope !== undefined) api.envelope = String(raw.envelope)
  if (raw.maxAttempts !== undefined) api.maxAttempts = Number(raw.maxAttempts)
  if (raw.timeoutSeconds !== undefined) api.timeoutSeconds = Number(raw.timeoutSeconds)
  if (raw.topic !== undefined) api.topic = String(raw.topic)
  api.request = normalizeApiPayload(raw.request, filePath, `events.${name}.request`)
  api.response = normalizeApiPayload(raw.response, filePath, `events.${name}.response`)
  if (raw.generators !== undefined) {
    api.generators = normalizeGeneratorUses(raw.generators, filePath, `events.${name}.generators`)
  }
  return api
}

const normalizeEnvelope = (raw: unknown, filePath: string, name: string): RawEnvelope => {
  if (!isObject(raw)) {
    return fail(`Envelope "${name}" must be an object`, filePath, `envelopes.${name}`)
  }
  if (!isObject(raw.fields)) {
    return fail(`Envelope "${name}" is missing a "fields" object`, filePath, `envelopes.${name}.fields`)
  }
  const fields: Record<string, RawField> = {}
  for (const [fieldName, fieldRaw] of Object.entries(raw.fields)) {
    fields[fieldName] = normalizeField(fieldRaw, filePath, `envelopes.${name}.fields.${fieldName}`)
  }
  const envelope: RawEnvelope = { fields }
  if (raw.description !== undefined) envelope.description = String(raw.description)
  return envelope
}

const normalizeFirestoreDoc = (raw: unknown, filePath: string, name: string): RawFirestoreDoc => {
  if (!isObject(raw)) {
    return fail(`Firestore doc "${name}" must be an object`, filePath, `firestore.${name}`)
  }
  const doc: RawFirestoreDoc = {}
  if (raw.from !== undefined) doc.from = String(raw.from)
  if (raw.collection !== undefined) doc.collection = String(raw.collection)
  if (raw.description !== undefined) doc.description = String(raw.description)
  if (raw.meta !== undefined) doc.meta = Boolean(raw.meta)
  if (raw.helpers !== undefined) doc.helpers = String(raw.helpers)
  if (raw.include !== undefined) doc.include = asStringArray(raw.include, filePath, `firestore.${name}.include`)
  doc.pick = asStringArray(raw.pick, filePath, `firestore.${name}.pick`)
  doc.omit = asStringArray(raw.omit, filePath, `firestore.${name}.omit`)
  if (raw.fields !== undefined) {
    if (!isObject(raw.fields)) {
      return fail(`Firestore doc "${name}" fields must be a mapping`, filePath, `firestore.${name}.fields`)
    }
    const fields: Record<string, RawField> = {}
    for (const [fieldName, fieldRaw] of Object.entries(raw.fields)) {
      fields[fieldName] = normalizeField(fieldRaw, filePath, `firestore.${name}.fields.${fieldName}`)
    }
    doc.fields = fields
  }
  return doc
}

const normalizeUnion = (raw: unknown, filePath: string, name: string): RawUnion => {
  if (!isObject(raw)) {
    return fail(`Union "${name}" must be an object`, filePath, `unions.${name}`)
  }
  if (typeof raw.discriminant !== 'string') {
    return fail(`Union "${name}" is missing a string "discriminant"`, filePath, `unions.${name}.discriminant`)
  }
  const union: RawUnion = {
    discriminant: raw.discriminant,
    variants: asStringArray(raw.variants, filePath, `unions.${name}.variants`),
  }
  if (raw.description !== undefined) union.description = String(raw.description)
  return union
}

const normalizeProject = (raw: unknown, filePath: string): RawProject => {
  if (!isObject(raw)) {
    return fail('"project" must be an object', filePath, 'project')
  }
  const project: RawProject = {}
  if (raw.services !== undefined) {
    if (!Array.isArray(raw.services)) {
      return fail('"project.services" must be an array', filePath, 'project.services')
    }
    project.services = raw.services.map((entry, i) => {
      if (!isObject(entry) || typeof entry.name !== 'string') {
        return fail(`project.services[${i}] needs a name`, filePath, 'project.services')
      }
      const service: RawService = { name: entry.name }
      if (entry.database !== undefined) service.database = String(entry.database)
      if (entry.location !== undefined) service.location = String(entry.location)
      if (entry.connectors !== undefined) service.connectors = asStringArray(entry.connectors, filePath, `project.services[${i}].connectors`)
      return service
    })
  }
  if (raw.codebases !== undefined) {
    if (!isObject(raw.codebases)) {
      return fail('"project.codebases" must be a mapping', filePath, 'project.codebases')
    }
    const codebases: Record<string, string> = {}
    for (const [codebase, service] of Object.entries(raw.codebases)) {
      codebases[codebase] = String(service)
    }
    project.codebases = codebases
  }
  if (isObject(raw.idCodec)) {
    const idCodec: { minLength?: number; alphabet?: string } = {}
    if (raw.idCodec.minLength !== undefined) idCodec.minLength = Number(raw.idCodec.minLength)
    if (raw.idCodec.alphabet !== undefined) idCodec.alphabet = String(raw.idCodec.alphabet)
    project.idCodec = idCodec
  }
  if (raw.aliases !== undefined) {
    if (!isObject(raw.aliases)) {
      return fail('"project.aliases" must be a mapping of alias → path', filePath, 'project.aliases')
    }
    const aliases: Record<string, string> = {}
    for (const [alias, target] of Object.entries(raw.aliases)) {
      aliases[alias] = String(target)
    }
    project.aliases = aliases
  }
  return project
}

/**
 * Parse a single YAML contract file into a {@link RawContract}. Shorthand forms
 * are normalized here so downstream code sees one canonical shape. Syntax and
 * structural problems throw a {@link ContractError}; semantic problems are left
 * for validation.
 */
export const parseContract = (content: string, filePath: string): RawContract => {
  let doc: unknown
  try {
    doc = parseYamlText(content)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return fail(`Failed to parse YAML: ${message}`, filePath)
  }

  if (doc === null || doc === undefined) {
    // An empty file is a valid, contribution-free contract.
    return {
      filePath,
      version: 1,
      imports: [],
      defaultConnectors: [],
      enums: {},
      models: {},
      operations: {},
      apis: {},
      firestore: {},
      unions: {},
      envelopes: {},
    }
  }
  if (!isObject(doc)) {
    return fail('Contract root must be a mapping', filePath)
  }

  const imports: string[] = []
  if (doc.imports !== undefined) {
    if (!Array.isArray(doc.imports)) {
      return fail('"imports" must be an array of paths', filePath, 'imports')
    }
    for (const entry of doc.imports) {
      if (typeof entry !== 'string') {
        return fail('Every "imports" entry must be a string', filePath, 'imports')
      }
      imports.push(entry)
    }
  }

  const enums: Record<string, RawEnum> = {}
  if (doc.enums !== undefined) {
    if (!isObject(doc.enums)) {
      return fail('"enums" must be a mapping', filePath, 'enums')
    }
    for (const [name, raw] of Object.entries(doc.enums)) {
      enums[name] = normalizeEnum(raw, filePath, name)
    }
  }

  const models: Record<string, RawModel> = {}
  if (doc.models !== undefined) {
    if (!isObject(doc.models)) {
      return fail('"models" must be a mapping', filePath, 'models')
    }
    for (const [name, raw] of Object.entries(doc.models)) {
      models[name] = normalizeModel(raw, filePath, name)
    }
  }

  // File-level defaults, e.g. `defaults: { connectors: [app, api] }`.
  let defaultConnectors: string[] = []
  if (doc.defaults !== undefined) {
    if (!isObject(doc.defaults)) {
      return fail('"defaults" must be a mapping', filePath, 'defaults')
    }
    defaultConnectors = asStringArray(doc.defaults.connectors, filePath, 'defaults.connectors')
  }

  const operations: Record<string, RawOperation> = {}
  if (doc.operations !== undefined) {
    if (!isObject(doc.operations)) {
      return fail('"operations" must be a mapping', filePath, 'operations')
    }
    for (const [name, raw] of Object.entries(doc.operations)) {
      const op = normalizeOperation(raw, filePath, name)
      // Inherit the file default when the operation declares no connector.
      if ((!op.connectors || op.connectors.length === 0) && defaultConnectors.length > 0) {
        op.connectors = [...defaultConnectors]
      }
      operations[name] = op
    }
  }

  const apis: Record<string, RawApi> = {}
  const sectionDefaults: RawSectionDefaults = {}
  const addApi = (name: string, api: RawApi, section: string): void => {
    if (apis[name] !== undefined) {
      fail(`Api "${name}" is declared more than once across apis/tasks/events`, filePath, `${section}.${name}`)
    }
    apis[name] = api
  }
  if (doc.apis !== undefined) {
    if (!isObject(doc.apis)) {
      return fail('"apis" must be a mapping', filePath, 'apis')
    }
    for (const [key, raw] of Object.entries(doc.apis)) {
      if (key === SECTION_DEFAULTS_KEY) {
        sectionDefaults.apis = normalizeSectionDefaults(raw, filePath, 'apis')
      } else if (key.startsWith('/')) {
        // Path-keyed REST form: the key is the route, `operationId` names the api.
        const { name, api } = normalizePathApi(raw, filePath, key)
        addApi(name, api, 'apis')
      } else {
        fail(`"apis" keys must be REST paths starting with "/" (tasks/events have their own sections): "${key}"`, filePath, `apis.${key}`)
      }
    }
  }
  if (doc.tasks !== undefined) {
    if (!isObject(doc.tasks)) {
      return fail('"tasks" must be a mapping', filePath, 'tasks')
    }
    for (const [name, raw] of Object.entries(doc.tasks)) {
      if (name === SECTION_DEFAULTS_KEY) {
        sectionDefaults.tasks = normalizeSectionDefaults(raw, filePath, 'tasks')
      } else {
        addApi(name, normalizeTask(raw, filePath, name), 'tasks')
      }
    }
  }
  if (doc.events !== undefined) {
    if (!isObject(doc.events)) {
      return fail('"events" must be a mapping', filePath, 'events')
    }
    for (const [name, raw] of Object.entries(doc.events)) {
      if (name === SECTION_DEFAULTS_KEY) {
        sectionDefaults.events = normalizeSectionDefaults(raw, filePath, 'events')
      } else {
        addApi(name, normalizeEvent(raw, filePath, name), 'events')
      }
    }
  }

  const firestore: Record<string, RawFirestoreDoc> = {}
  if (doc.firestore !== undefined) {
    if (!isObject(doc.firestore)) {
      return fail('"firestore" must be a mapping', filePath, 'firestore')
    }
    for (const [name, raw] of Object.entries(doc.firestore)) {
      firestore[name] = normalizeFirestoreDoc(raw, filePath, name)
    }
  }

  const unions: Record<string, RawUnion> = {}
  if (doc.unions !== undefined) {
    if (!isObject(doc.unions)) {
      return fail('"unions" must be a mapping', filePath, 'unions')
    }
    for (const [name, raw] of Object.entries(doc.unions)) {
      unions[name] = normalizeUnion(raw, filePath, name)
    }
  }

  const envelopes: Record<string, RawEnvelope> = {}
  if (doc.envelopes !== undefined) {
    if (!isObject(doc.envelopes)) {
      return fail('"envelopes" must be a mapping', filePath, 'envelopes')
    }
    for (const [name, raw] of Object.entries(doc.envelopes)) {
      envelopes[name] = normalizeEnvelope(raw, filePath, name)
    }
  }

  const version = typeof doc.version === 'number' ? doc.version : 1

  const contract: RawContract = {
    filePath,
    version,
    imports,
    defaultConnectors,
    enums,
    models,
    operations,
    apis,
    firestore,
    unions,
    envelopes,
  }
  if (doc.project !== undefined) {
    contract.project = normalizeProject(doc.project, filePath)
  }
  if (typeof doc.header === 'string') {
    contract.header = doc.header
  }
  if (doc.generators !== undefined) {
    if (!Array.isArray(doc.generators)) {
      return fail('"generators" must be an array of { generator, out } declarations', filePath, 'generators')
    }
    contract.generatorDecls = doc.generators.map((entry, i): RawGeneratorDecl => {
      if (!isObject(entry) || typeof entry.generator !== 'string') {
        return fail(`generators[${i}] needs a string "generator"`, filePath, `generators[${i}]`)
      }
      if (typeof entry.out !== 'string') {
        return fail(`generators[${i}] needs a string "out"`, filePath, `generators[${i}].out`)
      }
      return { generator: entry.generator, out: entry.out }
    })
  }
  if (Object.keys(sectionDefaults).length > 0) {
    contract.sectionDefaults = sectionDefaults
  }
  return contract
}
