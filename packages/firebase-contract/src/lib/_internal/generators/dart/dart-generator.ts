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

const isEmpty = (contract: DartContract): boolean =>
  contract.docs.length === 0 && contract.models.length === 0 && contract.enums.length === 0

/** Everything in one library (`contracts.dart`, renamable via `file`). */
const generateSingle = (ir: Ir, context?: GeneratorContext): GeneratedFile[] => {
  const contract = buildDartContract(ir)
  if (isEmpty(contract)) return []
  const style = styleOf(context)
  const enums = enumMap(contract)
  const classes = classesOf(contract)
  const path = outputFile(context, DEFAULT_FILE)
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
  const used = new Set(reserved)
  const files = new Map<string, string>()
  for (const name of names) {
    const base = snakeCase(name) || 'type'
    let candidate = `${base}.dart`
    let suffix = 2
    while (used.has(candidate)) candidate = `${base}_${suffix++}.dart`
    used.add(candidate)
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
  const style = styleOf(context)
  const enums = enumMap(contract)
  const classes = classesOf(contract)
  const barrel = outputFile(context, DEFAULT_FILE)
  const barrelName = barrel.split('/').pop() ?? barrel
  const fileOf = assignFileNames(
    [...contract.enums.map(e => e.name), ...classes.map(c => c.name)],
    [barrelName, TIMESTAMP_FILE]
  )
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

  const exports = [...(timestamps ? [TIMESTAMP_FILE] : []), ...fileOf.values()].sort().map(path => `export '${path}';`)
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
