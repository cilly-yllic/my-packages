import { posix } from 'node:path'

import { Ir } from '../../ir/ir.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'
import { snakeCase } from '../support/naming.js'
import { outputFile } from '../support/templates.js'
import { buildDartContract, DartClass, DartContract, DartEnum } from './dart-model.js'
import {
  DART_STYLES,
  DartStyle,
  referencedType,
  renderClass,
  renderEnum,
  renderPathHelpers,
  renderTimestampSupport,
  usesDateTime,
} from './dart-render.js'

const DEFAULT_FILE = 'contracts.dart'
const TIMESTAMP_FILE = 'timestamp_converter.dart'

const FIRESTORE_IMPORT = "import 'package:cloud_firestore/cloud_firestore.dart';"
const FREEZED_IMPORT = "import 'package:freezed_annotation/freezed_annotation.dart';"
const JSON_ANNOTATION_IMPORT = "import 'package:json_annotation/json_annotation.dart';"
// `@JsonSerializable` on the freezed factory is the documented way to pass
// json_serializable options, but the analyzer flags it (class-only target).
const IGNORE_ANNOTATION_TARGET = '// ignore_for_file: invalid_annotation_target'

const styleOf = (context: GeneratorContext | undefined): DartStyle => {
  const style = context?.output?.options?.['style'] ?? 'freezed'
  // The compiler rejects unknown values (`optionValues`); programmatic callers get a clear error.
  if (!(DART_STYLES as readonly string[]).includes(style)) {
    throw new Error(`dart generator: unknown options.style "${style}" (expected ${DART_STYLES.join(' | ')})`)
  }
  return style as DartStyle
}

const enumMap = (contract: DartContract): Map<string, DartEnum> =>
  new Map(contract.enums.map(dartEnum => [dartEnum.name, dartEnum]))

const classesOf = (contract: DartContract): DartClass[] => [...contract.models, ...contract.docs]

const classUsesDateTime = (dartClass: DartClass): boolean => dartClass.fields.some(usesDateTime)

const renderDoc = (dartClass: DartClass, style: DartStyle, enums: Map<string, DartEnum>): string[] => {
  const helpers = renderPathHelpers(dartClass)
  return [renderClass(dartClass, style, enums), ...(helpers ? [helpers] : [])]
}

/** Dart core / annotation / generated-support type names a contract type must not shadow. */
const RESERVED_TYPE_NAMES = new Set([
  'Object',
  'String',
  'int',
  'double',
  'num',
  'bool',
  'List',
  'Map',
  'Set',
  'Iterable',
  'DateTime',
  'Duration',
  'Type',
  'Function',
  'Null',
  'Never',
  'Record',
  'Enum',
  'Timestamp',
  'Default',
  'JsonKey',
  'JsonValue',
  'JsonSerializable',
  'JsonConverter',
  'TimestampConverter',
  'ArgumentError',
  // Top-level Timestamp helpers emitted into the same library.
  'timestampFromJson',
  'timestampFromJsonOrNull',
  'timestampToJson',
  'timestampToJsonOrNull',
])

/**
 * Words that cannot name a Dart type: reserved words plus built-in identifiers.
 * Contextual keywords (`async`, `show`, `when`, `on`, …) are valid type names.
 */
const TYPE_NAME_KEYWORDS = new Set([
  'assert',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'do',
  'else',
  'enum',
  'extends',
  'false',
  'final',
  'finally',
  'for',
  'if',
  'in',
  'is',
  'new',
  'null',
  'rethrow',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'var',
  'void',
  'while',
  'with',
  'abstract',
  'as',
  'covariant',
  'deferred',
  'dynamic',
  'export',
  'extension',
  'external',
  'factory',
  'Function',
  'get',
  'implements',
  'import',
  'interface',
  'late',
  'library',
  'mixin',
  'operator',
  'part',
  'required',
  'set',
  'static',
  'typedef',
])

/**
 * Normalize an output-relative path (`./a`, `sub/./a`, `sub\\a` → POSIX form);
 * undefined when it is absolute or escapes the output directory.
 */
const normalizeOutPath = (raw: string): string | undefined => {
  const normalized = posix.normalize(raw.replace(/\\/g, '/'))
  if (normalized.startsWith('/') || normalized === '..' || normalized.startsWith('../')) return undefined
  return normalized
}

/**
 * Every emitted Dart type (enums, value objects, projections, `<Doc>Path`
 * helpers) shares one library namespace: reject names that are not valid
 * public Dart type identifiers, shadow core/support types, or collide.
 */
const assertTypeNames = (contract: DartContract): void => {
  const owners = new Map<string, string[]>()
  const claim = (name: string, owner: string): void => {
    owners.set(name, [...(owners.get(name) ?? []), owner])
  }
  for (const dartEnum of contract.enums) claim(dartEnum.name, `enum ${dartEnum.name}`)
  for (const model of contract.models) claim(model.name, `model ${model.name}`)
  for (const doc of contract.docs) {
    claim(doc.name, `firestore ${doc.name}`)
    if (renderPathHelpers(doc) !== undefined) claim(`${doc.name}Path`, `path helper of firestore ${doc.name}`)
  }
  const problems: string[] = []
  for (const [name, claimed] of owners) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || TYPE_NAME_KEYWORDS.has(name)) {
      problems.push(`"${name}" (${claimed.join(', ')}) is not a valid Dart type name`)
    } else if (RESERVED_TYPE_NAMES.has(name)) {
      problems.push(`"${name}" (${claimed.join(', ')}) shadows a Dart core/support name`)
    } else if (claimed.length > 1) {
      problems.push(`"${name}" is emitted by ${claimed.join(' and ')}`)
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `dart generator: conflicting type names — ${problems.join('; ')}. Rename via fsName or the projection key.`
    )
  }
}

const isEmpty = (contract: DartContract): boolean =>
  contract.docs.length === 0 && contract.models.length === 0 && contract.enums.length === 0

/** Everything in one library (`contracts.dart`, renamable via `file`). */
const generateSingle = (ir: Ir, context?: GeneratorContext): GeneratedFile[] => {
  const contract = buildDartContract(ir)
  if (isEmpty(contract)) return []
  assertTypeNames(contract)
  const style = styleOf(context)
  const enums = enumMap(contract)
  const classes = classesOf(contract)
  const path = normalizeOutPath(outputFile(context, DEFAULT_FILE))
  if (path === undefined)
    throw new Error(`dart generator: file "${outputFile(context, DEFAULT_FILE)}" must stay inside the output directory`)
  const base = (path.split('/').pop() ?? path).replace(/\.dart$/, '')
  const timestamps = classes.some(classUsesDateTime)

  const imports: string[] = []
  if (timestamps) imports.push(FIRESTORE_IMPORT)
  if (style === 'freezed') imports.push(FREEZED_IMPORT)
  const blocks: string[] = [...headerBlocks(context)]
  if (style === 'freezed' && classes.length > 0) blocks.push(IGNORE_ANNOTATION_TARGET)
  if (imports.length > 0) blocks.push(imports.join('\n'))
  if (style === 'freezed' && classes.length > 0) blocks.push(`part '${base}.freezed.dart';\npart '${base}.g.dart';`)
  if (timestamps) blocks.push(renderTimestampSupport(style))
  for (const dartEnum of contract.enums) blocks.push(renderEnum(dartEnum, style))
  for (const model of contract.models) blocks.push(renderClass(model, style, enums))
  for (const doc of contract.docs) blocks.push(...renderDoc(doc, style, enums))
  return [{ path, content: `${blocks.join('\n\n')}\n` }]
}

/** Assign unique snake_case file names (Dart `file_names` convention) per type. */
const assignFileNames = (names: string[], reserved: string[]): Map<string, string> => {
  // Case-insensitive: `A.dart` and `a.dart` are the same file on macOS / Windows.
  const used = new Set(reserved.map(path => path.toLowerCase()))
  const files = new Map<string, string>()
  for (const name of names) {
    const base = snakeCase(name) || 'type'
    let candidate = `${base}.dart`
    let suffix = 2
    while (used.has(candidate.toLowerCase())) candidate = `${base}_${suffix++}.dart`
    used.add(candidate.toLowerCase())
    files.set(name, candidate)
  }
  return files
}

/**
 * One file per type (enum / value object / projection) plus the Timestamp
 * helpers and a barrel (`contracts.dart`, renamable via `file`).
 */
const generateSplit = (ir: Ir, context?: GeneratorContext): GeneratedFile[] => {
  const contract = buildDartContract(ir)
  if (isEmpty(contract)) return []
  assertTypeNames(contract)
  const style = styleOf(context)
  const enums = enumMap(contract)
  const classes = classesOf(contract)
  const rawBarrel = outputFile(context, DEFAULT_FILE)
  const barrel = normalizeOutPath(rawBarrel)
  if (barrel === undefined || barrel.toLowerCase() === TIMESTAMP_FILE) {
    throw new Error(
      `dart generator: barrel file "${rawBarrel}" must not be ${TIMESTAMP_FILE} or leave the output directory`
    )
  }
  // Type files sit at the output root; the barrel may live in a subdirectory.
  const fileOf = assignFileNames(
    [...contract.enums.map(e => e.name), ...classes.map(c => c.name)],
    [barrel, TIMESTAMP_FILE]
  )
  const toRoot = '../'.repeat(barrel.split('/').length - 1)
  const files: GeneratedFile[] = []
  const header = headerBlocks(context)
  const timestamps = classes.some(classUsesDateTime)

  if (timestamps) {
    const imports = style === 'freezed' ? [FIRESTORE_IMPORT, JSON_ANNOTATION_IMPORT] : [FIRESTORE_IMPORT]
    files.push({
      path: TIMESTAMP_FILE,
      content: `${[...header, imports.join('\n'), renderTimestampSupport(style)].join('\n\n')}\n`,
    })
  }

  for (const dartEnum of contract.enums) {
    const blocks = [...header]
    if (style === 'freezed') blocks.push(FREEZED_IMPORT)
    blocks.push(renderEnum(dartEnum, style))
    files.push({ path: fileOf.get(dartEnum.name) as string, content: `${blocks.join('\n\n')}\n` })
  }

  const docNames = new Set(contract.docs.map(doc => doc.name))
  for (const dartClass of classes) {
    const file = fileOf.get(dartClass.name) as string
    const local = new Set<string>()
    for (const field of dartClass.fields) {
      const type = referencedType(field)
      if (type && type !== dartClass.name) local.add(fileOf.get(type) as string)
    }
    if (classUsesDateTime(dartClass)) local.add(TIMESTAMP_FILE)
    const imports = [
      ...(style === 'freezed' ? [FREEZED_IMPORT] : []),
      ...(style === 'freezed' && local.size > 0 ? [''] : []),
      ...[...local].sort().map(path => `import '${path}';`),
    ]
    const blocks = [...header]
    if (style === 'freezed') blocks.push(IGNORE_ANNOTATION_TARGET)
    if (imports.length > 0) blocks.push(imports.join('\n'))
    if (style === 'freezed') {
      const base = file.replace(/\.dart$/, '')
      blocks.push(`part '${base}.freezed.dart';\npart '${base}.g.dart';`)
    }
    if (docNames.has(dartClass.name)) blocks.push(...renderDoc(dartClass, style, enums))
    else blocks.push(renderClass(dartClass, style, enums))
    files.push({ path: file, content: `${blocks.join('\n\n')}\n` })
  }

  const exports = [...(timestamps ? [TIMESTAMP_FILE] : []), ...fileOf.values()]
    .sort()
    .map(path => `export '${toRoot}${path}';`)
  files.push({ path: barrel, content: `${[...header, exports.join('\n')].join('\n\n')}\n` })
  return files
}

/**
 * Generates Dart (Flutter) models for the Firestore projections: freezed +
 * json_serializable classes (default) or dependency-free plain classes
 * (`options: { style: plain }`), Dart enums with their stored values,
 * `DateTime` ⇄ Firestore `Timestamp` conversion, and `<Doc>Path` collection
 * path helpers. `split: true` emits one file per type plus a barrel.
 */
export const createDartGenerator = (): Generator => ({
  name: 'dart',
  description: 'Dart (Flutter) models for Firestore projections (freezed or plain classes)',
  splittable: true,
  optionValues: { style: DART_STYLES },
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    return context?.output?.split ? generateSplit(ir, context) : generateSingle(ir, context)
  },
})
