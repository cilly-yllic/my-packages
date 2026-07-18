import { findModel, Ir, IrApi, IrApiPayload, IrEnvelope, IrField, ScalarType } from '../../ir/ir.js'
import { constantCase, pascalCase, singleQuote } from '../support/naming.js'
import { isRelation, relationFkName, relationFkType } from '../support/relations.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'

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

const isTask = (api: IrApi): boolean => api.kind === 'task' || api.kind === 'pubsub'

const fieldTs = (ir: Ir, field: IrField): string => {
  let base: string
  if (isRelation(field)) base = SCALAR_TS[relationFkType(ir, field)]
  else if (field.type.kind === 'scalar') base = SCALAR_TS[field.type.name]
  else if (field.type.kind === 'enum' || field.type.kind === 'model') base = field.type.name
  else base = 'unknown'
  return field.list ? `${base}[]` : base
}

const renderMember = (ir: Ir, field: IrField): string => {
  const name = isRelation(field) ? relationFkName(field) : field.name
  const doc = field.description ? `  /** ${field.description} */\n` : ''
  const nullable = field.nullable ? ' | null' : ''
  return `${doc}  ${name}${field.optional ? '?' : ''}: ${fieldTs(ir, field)}${nullable}`
}

const payloadFields = (ir: Ir, payload: IrApiPayload): IrField[] =>
  payload.model ? (findModel(ir, payload.model)?.fields ?? []) : payload.fields

const renderEnvelope = (env: IrEnvelope): string => {
  const doc = env.description ? `/** ${env.description} */\n` : ''
  const members = env.fields.map(field => `  ${field.name}${field.optional ? '?' : ''}: ${SCALAR_TS[field.type.kind === 'scalar' ? field.type.name : 'string']}`).join('\n')
  return `${doc}export type ${env.name}<T> = T & {\n${members}\n}`
}

const renderTask = (ir: Ir, api: IrApi): string => {
  const name = pascalCase(api.name)
  const fields = payloadFields(ir, api.request)
  const dataBody = fields.length > 0 ? fields.map(field => renderMember(ir, field)).join('\n') : ''
  const dataType = fields.length > 0 ? `export interface ${name}TaskData {\n${dataBody}\n}` : `export type ${name}TaskData = Record<string, never>`
  const envelope = api.task?.envelope
  const payloadType = envelope
    ? `export type ${name}TaskPayload = ${envelope}<${name}TaskData>`
    : `export type ${name}TaskPayload = ${name}TaskData`

  const constants: string[] = []
  const CONST = constantCase(api.name)
  if (api.task?.maxAttempts !== undefined) constants.push(`export const ${CONST}_MAX_ATTEMPTS = ${api.task.maxAttempts}`)
  if (api.task?.timeoutSeconds !== undefined) constants.push(`export const ${CONST}_TIMEOUT_SECONDS = ${api.task.timeoutSeconds}`)
  if (api.task?.topic !== undefined) constants.push(`export const ${CONST}_TOPIC = ${singleQuote(api.task.topic)}`)

  return [dataType, payloadType, ...constants].join('\n')
}

const collectImports = (ir: Ir, tasks: IrApi[]): string[] => {
  const names = new Set<string>()
  for (const api of tasks) {
    for (const field of payloadFields(ir, api.request)) {
      if (field.type.kind === 'enum' || (field.type.kind === 'model' && !isRelation(field))) {
        names.add(field.type.name)
      }
    }
  }
  return [...names].sort()
}

/**
 * Generates Cloud Task / Pub/Sub payload contracts: a generic envelope type per
 * declared envelope (`RetryTaskPayload<T> = T & { … }`), plus per-task
 * `<Name>TaskData` + `<Name>TaskPayload` and delivery constants (max attempts,
 * timeout, topic) — the shared payload contracts an app otherwise hand-writes.
 */
export const createTaskPayloadGenerator = (): Generator => ({
  name: 'task-payloads',
  description: 'Cloud Task/Pub-Sub payload envelopes, data/payload types, and constants',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    const tasks = ir.apis.filter(isTask)
    if (ir.envelopes.length === 0 && tasks.length === 0) {
      return []
    }
    const blocks: string[] = [...headerBlocks(context)]
    const imports = collectImports(ir, tasks)
    if (imports.length > 0) {
      blocks.push(`import type { ${imports.join(', ')} } from './types'`)
    }
    for (const env of ir.envelopes) {
      blocks.push(renderEnvelope(env))
    }
    for (const api of tasks) {
      blocks.push(renderTask(ir, api))
    }
    return [{ path: 'task-payloads.ts', content: `${blocks.join('\n\n')}\n` }]
  },
})
