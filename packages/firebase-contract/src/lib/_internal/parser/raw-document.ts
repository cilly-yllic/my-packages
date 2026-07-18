/**
 * The raw, still-YAML-shaped model produced by the parser. It mirrors the YAML
 * document one-to-one after shorthand normalization. Only the parser and import
 * resolver deal with these types; everything downstream works on the IR.
 */

export interface RawField {
  type: string
  optional?: boolean
  nullable?: boolean
  /** Render the description as a JSDoc block instead of line comments. */
  jsdoc?: boolean
  list?: boolean
  id?: boolean
  unique?: boolean
  relation?: boolean
  default?: unknown
  description?: string
  // Validation constraints.
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  nonempty?: boolean
  email?: boolean
  url?: boolean
  col?: string
  literal?: string
}

export interface RawEnum {
  description?: string
  values: string[]
  valueComments?: Record<string, string>
  /** Const-object key overrides, keyed by value (e.g. Q → QA). */
  valueKeys?: Record<string, string>
  gqlName?: string
  /** TypeScript-side rename used by Firestore projections (e.g. `Status` → `ReviewStatus`). */
  fsName?: string
  /** Firestore-side comment override (when it differs from the DC description). */
  fsDescription?: string
}

export interface RawIndex {
  fields: string[]
  name?: string
  unique?: boolean
  expand?: boolean
}

export interface RawSqlConstraints {
  checks?: string[]
  foreignKeys?: { columns: string[]; references: string; name?: string }[]
  indexes?: { columns: string[]; name?: string; unique?: boolean }[]
}

export interface RawModel {
  description?: string
  fields: Record<string, RawField>
  key?: string[]
  table?: string
  gqlName?: string
  directives?: string
  footer?: string
  /** TypeScript-side rename used by Firestore projections. */
  fsName?: string
  indexes?: RawIndex[]
  sql?: RawSqlConstraints
}

export interface RawOperation {
  description?: string
  type: string
  model: string
  action?: string
  auth?: string
  authReason?: string
  inputs?: { field: string; required?: boolean; description?: string; var?: string; flat?: boolean; literal?: string; quote?: boolean; inc?: boolean; asKey?: boolean }[]
  /** Normalized to `{ field, op, required? }` by the parser. */
  where?: { field: string; op: string; required?: boolean; description?: string; var?: string; literal?: string; flat?: boolean }[]
  select?: { field: string; select?: unknown[]; description?: string; alias?: string; args?: string }[]
  orderBy?: { field: string; dir: string }[]
  limit?: number | { var: string; default?: number; required?: boolean }
  single?: string
  keyArg?: string
  keyVars?: Record<string, string>
  aggregate?: { count?: boolean; sum?: string[] }
  exprs?: { field: string; expr: string }[]
  inc?: { field: string; var?: string }[]
  /** Connectors (output targets) this operation is emitted into. */
  connectors?: string[]
  entityDir?: string
  whereAnd?: boolean
  gqlName?: string
  footer?: string
  raw?: string
  directives?: string
  style?: { signature?: string; args?: string; data?: string; orderBy?: string; auth?: string; key?: string; and?: string; where?: string }
}

export interface RawApiPayload {
  model?: string
  fields?: Record<string, RawField>
  void?: boolean
}

export interface RawApi {
  description?: string
  kind: string
  method?: string
  request?: RawApiPayload
  response?: RawApiPayload
  envelope?: string
  maxAttempts?: number
  timeoutSeconds?: number
  topic?: string
}

export interface RawEnvelope {
  description?: string
  fields: Record<string, RawField>
}

export interface RawFirestoreDoc {
  description?: string
  from?: string
  collection?: string
  pick?: string[]
  omit?: string[]
  fields?: Record<string, RawField>
  meta?: boolean
  /** Embedded models to host in this projection file even when unreferenced. */
  include?: string[]
  /** Verbatim TypeScript helpers emitted into the projection file. */
  helpers?: string
}

export interface RawUnion {
  description?: string
  discriminant: string
  variants: string[]
}

export interface RawService {
  name: string
  database?: string
  location?: string
  connectors?: string[]
}

export interface RawProject {
  services?: RawService[]
  codebases?: Record<string, string>
  /** Sqids settings for the generated id-core (encode/decode primitives). */
  idCodec?: { minLength?: number; alphabet?: string }
}

/** A declared generation target: run `generators` into `out` (relative to the yml). */
export interface RawOutputTarget {
  out: string
  generators: string[]
}

export interface RawContract {
  /** Absolute path of the source file. */
  filePath: string
  /** Generation targets declared in this file's `generate:` section. */
  outputs?: RawOutputTarget[]
  version: number
  /** Raw header text prepended to generated files (`default` = built-in banner). */
  header?: string
  project?: RawProject
  /** Import specifiers exactly as written (relative paths or npm packages). */
  imports: string[]
  /** File-level default connectors applied to operations lacking their own. */
  defaultConnectors: string[]
  enums: Record<string, RawEnum>
  models: Record<string, RawModel>
  operations: Record<string, RawOperation>
  apis: Record<string, RawApi>
  firestore: Record<string, RawFirestoreDoc>
  unions: Record<string, RawUnion>
  envelopes: Record<string, RawEnvelope>
}
