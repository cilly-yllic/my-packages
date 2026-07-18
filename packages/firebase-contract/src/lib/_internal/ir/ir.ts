/**
 * The Intermediate Representation (IR).
 *
 * This is the single input every generator consumes. Generators MUST NOT parse
 * YAML or touch raw documents — they only read the IR defined here. Keeping the
 * IR the sole contract between the front end (parser/resolver) and the back end
 * (generators) is what lets generators stay independent and lets new front-end
 * features land without rewriting generators.
 */

export const SCALAR_TYPES = ['string', 'int', 'int64', 'float', 'boolean', 'timestamp', 'date', 'json', 'id'] as const

export type ScalarType = (typeof SCALAR_TYPES)[number]

export const isScalarType = (name: string): name is ScalarType =>
  (SCALAR_TYPES as readonly string[]).includes(name)

/** A reference from a field to the type that describes its value. */
export type IrTypeRef =
  | { kind: 'scalar'; name: ScalarType }
  | { kind: 'enum'; name: string }
  | { kind: 'model'; name: string }
  /** Emitted when a type name could not be matched; surfaced by validation. */
  | { kind: 'unresolved'; name: string }

/** Validation constraints on a field, applied by the validation generators. */
export interface IrConstraints {
  /** Minimum numeric value (numbers). */
  min?: number
  /** Maximum numeric value (numbers). */
  max?: number
  /** Minimum string/array length. */
  minLength?: number
  /** Maximum string/array length. */
  maxLength?: number
  /** Regex source the value must match (strings). */
  pattern?: string
  /** Non-empty string/array. */
  nonempty?: boolean
  /** Must be a valid email (strings). */
  email?: boolean
  /** Must be a valid URL (strings). */
  url?: boolean
}

export interface IrField {
  name: string
  description?: string
  type: IrTypeRef
  constraints: IrConstraints
  /** The value may be absent (`field?`). */
  optional: boolean
  /** The value may be `null` (rendered `.nullable()` in Zod-facing generators). */
  nullable?: boolean
  /** Render the description as a JSDoc block instead of line comments. */
  jsdoc?: boolean
  /** The value is an array of `type`. */
  list: boolean
  /** Marks the primary identifier of the model. */
  isId: boolean
  unique: boolean
  /**
   * A model-typed field that is a foreign-key *relation* to another table
   * (Data Connect emits a relation field + FK column), as opposed to an
   * *embedded* value object (stored as `Any`/jsonb). Only meaningful when
   * `type.kind === 'model'`.
   */
  relation: boolean
  /** Data Connect column dataType override (e.g. `bigserial`); derived for Int64 PKs. */
  col?: string
  /** Pin the field to a single literal value (e.g. a discriminated-union tag). */
  literal?: string
  default?: unknown
}

/** A composite index or unique constraint on a table. */
export interface IrIndex {
  fields: string[]
  /** Explicit index name; generators derive one when absent. */
  name?: string
  unique: boolean
  /** Render the directive with one argument per line. */
  expand?: boolean
}

/**
 * Raw SQL constraints that Data Connect's schema directives cannot express
 * (composite foreign keys, CHECK constraints, extra indexes). The SQL migration
 * generator turns these into executable `ALTER TABLE`/`CREATE INDEX` statements.
 */
export interface IrSqlConstraints {
  checks: string[]
  foreignKeys: { columns: string[]; references: string; name?: string }[]
  indexes: { columns: string[]; name?: string; unique: boolean }[]
}

export interface IrModel {
  name: string
  description?: string
  fields: IrField[]
  /** Composite primary key field names. Empty means "use the `id: true` field". */
  key: string[]
  /** Raw SQL constraints (composite FK / CHECK / index) not expressible in DC. */
  sql?: IrSqlConstraints
  /** Table name override; defaults to the snake_case pluralization of the model name. */
  table?: string
  /** GraphQL type name override (defaults to `name`). */
  gqlName?: string
  /** `multi` = each type-level directive on its own line (real-file style). */
  directives?: 'inline' | 'multi'
  /** Trailing comment block rendered after the closing `}` in the schema file. */
  footer?: string
  /** TypeScript-side rename used by Firestore projections. */
  fsName?: string
  /** Composite unique/index constraints (Data Connect `@unique`/`@index`). */
  indexes: IrIndex[]
  /** Absolute path of the file this model was defined in. */
  sourceFile?: string
}

export interface IrEnum {
  name: string
  description?: string
  values: string[]
  /** Per-value comments, keyed by value. */
  valueComments?: Record<string, string>
  /** Const-object key overrides, keyed by value (e.g. Q → QA). */
  valueKeys?: Record<string, string>
  /** GraphQL type name override (defaults to `name`). */
  gqlName?: string
  /** TypeScript-side rename used by Firestore projections (e.g. `Status` → `ReviewStatus`). */
  fsName?: string
  /** Firestore-side comment override (when it differs from the DC description). */
  fsDescription?: string
  sourceFile?: string
}

export type OperationType = 'query' | 'mutation'
export type MutationAction = 'insert' | 'update' | 'upsert' | 'delete'
export type AuthLevel = 'NO_ACCESS' | 'PUBLIC' | 'USER'

/** A single `where` filter: a field compared with an operator (eq, contains, lt, …). */
export interface IrWhere {
  field: string
  op: string
  /** Variable requiredness override (defaults to required). */
  required?: boolean
  /** Comment rendered directly above the variable declaration. */
  description?: string
  /** Variable name override. */
  var?: string
  /** Fixed literal comparison value (no variable), e.g. `ACTIVE` / `true`. */
  literal?: string
  /** Filter on the flat FK column (`fieldId: { eq }`) instead of the relation form. */
  flat?: boolean
}

/** A mutation input: a field, with optional variable-requiredness override. */
export interface IrInput {
  field: string
  /** Overrides schema-derived nullability (the operation's own contract). */
  required?: boolean
  /** Comment rendered directly above the variable declaration. */
  description?: string
  /** Variable name override (defaults to the field name / relation FK name). */
  var?: string
  /** Write a relation as its flat FK column (`fieldId: $var`) instead of `field: { id: $var }`. */
  flat?: boolean
  /** Fixed literal written directly into data (no variable), e.g. `PROCESSING` / `false`. */
  literal?: string
  /** Render as an increment write (`field_update: { inc: $var | 1 }`) at this position. */
  inc?: boolean
  /** Pass the relation as a `Model_Key` object variable (`$catalogVersion: CatalogVersion_Key!`). */
  asKey?: boolean
  /** Quote the literal as a GraphQL string. */
  quote?: boolean
}

/** A selection entry: a field, optionally with a nested selection (relations). */
export interface IrSelect {
  field: string
  select?: IrSelect[]
  /** Comment rendered directly above the selection line. */
  description?: string
  /** GraphQL alias (`members: shopMembers_on_user`). */
  alias?: string
  /** Raw argument string rendered verbatim (`orderBy: [{ joinedAt: DESC }]`, join where/limit). */
  args?: string
}

/** A single `orderBy` clause. */
export interface IrOrderBy {
  field: string
  dir: 'ASC' | 'DESC'
}

/** Aggregate selections for a query. */
export interface IrAggregate {
  count: boolean
  /** Field names to `_sum`. */
  sum: string[]
}

/** A field set to a raw expression on mutation (e.g. `updatedAt: "request.time"`). */
export interface IrExpr {
  field: string
  expr: string
}

/** A Data Connect query/mutation operation over a model's table. */
export interface IrOperation {
  name: string
  description?: string
  operationType: OperationType
  /** Target model (table) name. */
  model: string
  /** For mutations: which auto-generated resolver to use. */
  action?: MutationAction
  auth: AuthLevel
  /** Mandatory rationale when auth is PUBLIC. */
  authReason?: string
  /** Mutation inputs (fields + optional requiredness overrides). */
  inputs: IrInput[]
  /** `where` filters (queries). */
  where: IrWhere[]
  /** Selection entries; empty means all scalar fields. */
  select: IrSelect[]
  /** `orderBy` clauses (queries). */
  orderBy: IrOrderBy[]
  /** Row limit (queries): a literal, or a variable spec. */
  limit?: number | { var: string; default?: number; required?: boolean }
  /** Single-row primary-key lookup form: `key` → `x(key: {…})`, `id` → `x(id: $var)`. */
  single?: 'key' | 'id'
  /** Update/delete key argument style: nested `key: {…}` (default) or positional `id: $var`. */
  keyArg?: 'key' | 'id'
  /** Key variable name overrides, keyed by key field name. */
  keyVars?: Record<string, string>
  /** Aggregate selections (queries). */
  aggregate?: IrAggregate
  /** Fields set to raw expressions on mutation (e.g. `updatedAt: request.time`). */
  exprs: IrExpr[]
  /** Increment writes: `field_update: { inc: 1 }`, or `{ inc: $var }` when `var` is set. */
  inc: { field: string; var?: string }[]
  /** Output targets (connectors). Empty means the default/root output. */
  connectors: string[]
  /** Entity directory override for split output (defaults to the table's kebab name). */
  entityDir?: string
  /** Wrap where conditions in an explicit `_and: [ … ]` array (matches hand-written form). */
  whereAnd?: boolean
  /** Rendered operation name override (yml key stays the unique id). */
  gqlName?: string
  /** Comment block rendered after the operation (file-trailing NOTEs). */
  footer?: string
  /** Verbatim operation body — rendered as-is (escape hatch for inexpressible ops). */
  raw?: string
  /** Per-operation layout hints matching the hand-written file's formatting. */
  style?: {
    signature?: 'inline' | 'multi'
    args?: 'inline' | 'multi'
    /** `inline` = whole call on one line; `compact` = one-line data object inside a multi-line call. */
    data?: 'inline' | 'multi' | 'compact'
    /** `bare` = single orderBy clause without array brackets. */
    orderBy?: 'bare' | 'array'
    /** `newline` = `@auth` on its own line (even NO_ACCESS). */
    auth?: 'inline' | 'newline'
    /** `multi` = key object expanded one field per line. */
    key?: 'inline' | 'multi'
    /** `inline` = compact one-line `_and: [{…}, {…}]` even inside multi-line args. */
    and?: 'inline' | 'multi'
    /** `multi` = plain where body wrapped with one condition per line. */
    where?: 'inline' | 'multi'
  }
  sourceFile?: string
}

export type ApiKind = 'callable' | 'https' | 'task' | 'pubsub'

/** Request or response shape of an API endpoint. */
export interface IrApiPayload {
  /** Reference an existing model as the shape. */
  model?: string
  /** Inline fields (used when `model` is absent). */
  fields: IrField[]
  /** Response only: the endpoint returns nothing. */
  isVoid: boolean
}

/** Cloud Task / Pub/Sub delivery config for an endpoint. */
export interface IrTaskConfig {
  /** Envelope type (e.g. `RetryTaskPayload`) wrapping the task data. */
  envelope?: string
  maxAttempts?: number
  timeoutSeconds?: number
  topic?: string
}

/** An application API endpoint (callable / https / cloud task / pubsub). */
export interface IrApi {
  name: string
  description?: string
  kind: ApiKind
  /** HTTP method for `https` endpoints. */
  method?: string
  request: IrApiPayload
  response: IrApiPayload
  /** Delivery config for `task`/`pubsub` kinds. */
  task?: IrTaskConfig
  sourceFile?: string
}

/** A generic payload envelope, e.g. `RetryTaskPayload<T> = T & { identifierId, opId, enqueuedAt }`. */
export interface IrEnvelope {
  name: string
  description?: string
  /** Fields merged into the wrapped type `T`. */
  fields: IrField[]
  sourceFile?: string
}

/**
 * A Firestore projection document. Firestore is a denormalized read model, so a
 * projection *derives* from a Data Connect model (`from`) and then diverges:
 * fields are picked/omitted, relations become resolved string ids, timestamps
 * become dates, a `_meta_` envelope is added, and extra denormalized fields
 * (e.g. flattened DAG edges) are declared inline.
 */
export interface IrFirestoreDoc {
  name: string
  description?: string
  /** Base model to inherit fields from. */
  from?: string
  /** Firestore document path, e.g. `shops/{shopId}`. */
  collection?: string
  /** Keep only these base fields (mutually exclusive with `omit`). */
  pick: string[]
  /** Drop these base fields. */
  omit: string[]
  /** Added or overriding projection-specific fields. */
  fields: IrField[]
  /** Attach the consistency `_meta_` envelope (default true). */
  meta: boolean
  /** Embedded models to host in this projection file even when unreferenced. */
  include?: string[]
  /** Verbatim TypeScript helpers emitted into the projection file. */
  helpers?: string
  sourceFile?: string
}

/** A discriminated union of model variants keyed by a shared discriminant field. */
export interface IrUnion {
  name: string
  description?: string
  discriminant: string
  variants: string[]
  sourceFile?: string
}

/** A Data Connect service (one Postgres database + its connectors). */
export interface IrService {
  name: string
  database?: string
  location?: string
  connectors: string[]
}

/** Project-level topology: services and their Cloud Functions codebases. */
export interface IrProject {
  services: IrService[]
  /** Map of codebase id → service name (e.g. `shop` → `shop-service`). */
  codebases: { codebase: string; service: string }[]
  /** Sqids settings for the generated id-core (encode/decode primitives). */
  idCodec?: { minLength?: number; alphabet?: string }
}

export interface Ir {
  version: number
  enums: IrEnum[]
  models: IrModel[]
  operations: IrOperation[]
  apis: IrApi[]
  firestore: IrFirestoreDoc[]
  unions: IrUnion[]
  envelopes: IrEnvelope[]
  project?: IrProject
  /** Raw header text from the contract (`default` = built-in banner). */
  header?: string
}

export const findModel = (ir: Ir, name: string): IrModel | undefined =>
  ir.models.find(model => model.name === name)

export const findEnum = (ir: Ir, name: string): IrEnum | undefined =>
  ir.enums.find(irEnum => irEnum.name === name)

/** The id field's scalar name of a model, used to type foreign keys. Defaults to `string`. */
export const idTypeOf = (ir: Ir, modelName: string): ScalarType => {
  const model = findModel(ir, modelName)
  const idField = model?.fields.find(field => field.isId)
  if (idField && idField.type.kind === 'scalar') {
    return idField.type.name
  }
  return 'string'
}
