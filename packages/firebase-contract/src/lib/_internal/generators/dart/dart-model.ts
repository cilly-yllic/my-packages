/**
 * IR → Dart-facing view. Resolves Firestore projections (pick/omit, relations,
 * fragments) and their referenced enums / embedded value objects into plain
 * descriptors the Dart renderer consumes. Pure functions only.
 */
import { findEnum, findFragment, findModel, Ir, IrEnum, IrField, IrFirestoreDoc, IrModel } from '../../ir/ir.js'
import { camelCase } from '../support/naming.js'
import { isRelation, relationFkName } from '../support/relations.js'
import { collectDeps } from '../support/split.js'

/** Dart reserved words / built-in identifiers that cannot name a field or enum value. */
export const DART_KEYWORDS = new Set([
  'abstract',
  'as',
  'assert',
  'async',
  'await',
  'base',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'covariant',
  'default',
  'deferred',
  'do',
  'dynamic',
  'else',
  'enum',
  'export',
  'extends',
  'extension',
  'external',
  'factory',
  'false',
  'final',
  'finally',
  'for',
  'Function',
  'get',
  'hide',
  'if',
  'implements',
  'import',
  'in',
  'interface',
  'is',
  'late',
  'library',
  'mixin',
  'new',
  'null',
  'of',
  'on',
  'operator',
  'part',
  'required',
  'rethrow',
  'return',
  'sealed',
  'set',
  'show',
  'static',
  'super',
  'switch',
  'sync',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typedef',
  'var',
  'void',
  'when',
  'while',
  'with',
  'yield',
])

/** Members every generated class/enum already has (Object, freezed, (de)serialization, enum). */
const FIELD_RESERVED = new Set([
  'hashCode',
  'runtimeType',
  'toString',
  'noSuchMethod',
  'copyWith',
  'toJson',
  'fromJson',
])
const ENUM_VALUE_RESERVED = new Set([...FIELD_RESERVED, 'value', 'values', 'index', 'name'])

/**
 * A valid lowerCamelCase Dart identifier for `raw`. Names that already are one
 * are kept verbatim (`photoURL` stays `photoURL`); others are camel-cased
 * (`_meta_` → `meta`, `IN_PROGRESS` → `inProgress`) and escaped when reserved.
 */
export const dartIdentifier = (raw: string, reserved: Set<string> = FIELD_RESERVED): string => {
  let name = /^[a-z][A-Za-z0-9]*$/.test(raw) ? raw : camelCase(raw.replace(/[^A-Za-z0-9_\-\s]/g, ' '))
  if (name === '') name = 'value'
  if (/^[0-9]/.test(name)) name = `v${name}`
  if (DART_KEYWORDS.has(name) || reserved.has(name)) name = `${name}Value`
  return name
}

/** Assign unique identifiers in order, suffixing `2`, `3`, … on collision. */
const uniqueNames = (raws: string[], reserved: Set<string>): string[] => {
  const used = new Set<string>()
  return raws.map(raw => {
    const base = dartIdentifier(raw, reserved)
    let name = base
    let suffix = 2
    while (used.has(name)) name = `${base}${suffix++}`
    used.add(name)
    return name
  })
}

export type DartScalar = 'String' | 'int' | 'double' | 'bool' | 'DateTime' | 'json'

/** Element type of a field (before list / nullability wrapping). */
export type DartElement =
  { kind: 'scalar'; name: DartScalar } | { kind: 'enum'; name: string } | { kind: 'model'; name: string }

export interface DartField {
  /** Key in the Firestore document / JSON map. */
  key: string
  /** Dart identifier (differs from `key` only when `key` is not a valid one). */
  name: string
  element: DartElement
  list: boolean
  /** Type is `T?` — the value may be null or absent. */
  nullable: boolean
  /** Absent (not null) when unset: skip the key on write instead of writing null. */
  omitIfNull: boolean
  description?: string
  default?: unknown
}

export interface DartEnum {
  name: string
  description?: string
  values: { value: string; name: string; description?: string }[]
}

export interface DartClass {
  name: string
  description?: string
  fields: DartField[]
  /** Firestore document/collection path template (projection docs only). */
  collection?: string
}

export interface DartContract {
  enums: DartEnum[]
  /** Embedded value objects referenced by the projections. */
  models: DartClass[]
  /** Firestore projection documents. */
  docs: DartClass[]
}

const SCALARS: Record<string, DartScalar> = {
  string: 'String',
  id: 'String',
  int: 'int',
  int64: 'int',
  float: 'double',
  boolean: 'bool',
  timestamp: 'DateTime',
  date: 'DateTime',
  json: 'json',
}

const enumName = (irEnum: IrEnum): string => irEnum.fsName ?? irEnum.name
const modelName = (ir: Ir, name: string): string => findModel(ir, name)?.fsName ?? name

/** Emittable enums (Dart enums need at least one value; empty ones degrade to String). */
const emittableEnum = (ir: Ir, name: string): IrEnum | undefined => {
  const irEnum = findEnum(ir, name)
  return irEnum && irEnum.values.length > 0 ? irEnum : undefined
}

const elementOf = (ir: Ir, field: IrField): DartElement => {
  // Firestore stores relations as resolved (encoded) string ids.
  if (isRelation(field)) return { kind: 'scalar', name: 'String' }
  switch (field.type.kind) {
    case 'scalar':
      return { kind: 'scalar', name: SCALARS[field.type.name] ?? 'json' }
    case 'enum': {
      const irEnum = emittableEnum(ir, field.type.name)
      return irEnum ? { kind: 'enum', name: enumName(irEnum) } : { kind: 'scalar', name: 'String' }
    }
    case 'model':
      return findModel(ir, field.type.name)
        ? { kind: 'model', name: modelName(ir, field.type.name) }
        : { kind: 'scalar', name: 'json' }
    default:
      return { kind: 'scalar', name: 'json' }
  }
}

interface FieldSpec {
  field: IrField
  /** Base (DC-derived) projection field: optional maps to nullable, no default. */
  base: boolean
}

const toDartFields = (ir: Ir, specs: FieldSpec[]): DartField[] => {
  const names = uniqueNames(
    specs.map(({ field }) => (isRelation(field) ? relationFkName(field) : field.name)),
    FIELD_RESERVED
  )
  return specs.map(({ field, base }, index) => {
    const key = isRelation(field) ? relationFkName(field) : field.name
    const nullable = field.optional || field.nullable === true
    return {
      key,
      name: names[index],
      element: elementOf(ir, field),
      list: field.list,
      nullable,
      omitIfNull: !base && field.optional && field.nullable !== true,
      ...(field.description ? { description: field.description } : {}),
      ...(!base && field.default !== undefined ? { default: field.default } : {}),
    }
  })
}

/** Base fields (pick/omit applied) followed by inline + fragment fields; overrides keep position. */
const docFieldSpecs = (ir: Ir, doc: IrFirestoreDoc): FieldSpec[] => {
  const base = doc.from ? findModel(ir, doc.from) : undefined
  let baseFields = base?.fields ?? []
  if (doc.pick.length > 0) {
    baseFields = doc.pick
      .map(name => baseFields.find(field => field.name === name))
      .filter((field): field is IrField => Boolean(field))
  } else if (doc.omit.length > 0) {
    baseFields = baseFields.filter(field => !doc.omit.includes(field.name))
  }
  const entries = new Map<string, FieldSpec>()
  const keyOf = (field: IrField): string => (isRelation(field) ? relationFkName(field) : field.name)
  for (const field of baseFields) entries.set(keyOf(field), { field, base: true })
  const added = [...doc.fields, ...doc.extends.flatMap(name => findFragment(ir, name)?.fields ?? [])]
  for (const field of added) entries.set(keyOf(field), { field, base: false })
  return [...entries.values()]
}

const toDartEnum = (irEnum: IrEnum): DartEnum => {
  const names = uniqueNames(
    irEnum.values.map(value => irEnum.valueKeys?.[value] ?? value),
    ENUM_VALUE_RESERVED
  )
  const description = irEnum.fsDescription ?? irEnum.description
  return {
    name: enumName(irEnum),
    ...(description ? { description } : {}),
    values: irEnum.values.map((value, index) => ({
      value,
      name: names[index],
      ...(irEnum.valueComments?.[value] ? { description: irEnum.valueComments[value] } : {}),
    })),
  }
}

/**
 * Collect the Dart view of the contract: every Firestore projection plus the
 * enums and embedded value objects they (transitively) reference, in stable
 * first-reference order.
 */
export const buildDartContract = (ir: Ir): DartContract => {
  const docs: DartClass[] = []
  const enumNames: string[] = []
  const modelNames: string[] = []
  const addUnique = (list: string[], names: string[]): void => {
    for (const name of names) if (!list.includes(name)) list.push(name)
  }
  for (const doc of ir.firestore) {
    const specs = docFieldSpecs(ir, doc)
    const pseudo: IrModel = { name: `__${doc.name}`, fields: specs.map(spec => spec.field), key: [], indexes: [] }
    const included = (doc.include ?? []).map(name => findModel(ir, name)).filter((m): m is IrModel => Boolean(m))
    const deps = collectDeps(ir, [pseudo, ...included])
    addUnique(modelNames, [...deps.models, ...included.map(model => model.name)])
    addUnique(enumNames, deps.enums)
    docs.push({
      name: doc.name,
      ...(doc.description ? { description: doc.description } : {}),
      fields: toDartFields(ir, specs),
      ...(doc.collection ? { collection: doc.collection } : {}),
    })
  }
  const models = modelNames
    .map(name => findModel(ir, name))
    .filter((model): model is IrModel => Boolean(model))
    .map(model => ({
      name: model.fsName ?? model.name,
      ...(model.description ? { description: model.description } : {}),
      fields: toDartFields(
        ir,
        model.fields.map(field => ({ field, base: false }))
      ),
    }))
  const enums = enumNames
    .map(name => emittableEnum(ir, name))
    .filter((irEnum): irEnum is IrEnum => Boolean(irEnum))
    .map(toDartEnum)
  return { enums, models, docs }
}
