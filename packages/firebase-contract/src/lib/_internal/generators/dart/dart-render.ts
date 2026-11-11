/** Dart source rendering for the `dart` generator. Pure functions only. */
import { DartClass, DartElement, DartEnum, DartField, dartIdentifier } from './dart-model.js'

export type DartStyle = 'freezed' | 'plain'

export const DART_STYLES: readonly DartStyle[] = ['freezed', 'plain']

/** Escape text for a single-quoted Dart string literal. */
export const dartString = (value: string): string =>
  `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\$/g, '\\$')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}'`

/** `///` doc comment lines; `<`/`>` are escaped so dartdoc does not read them as HTML. */
export const docComment = (description: string | undefined, indent: string): string[] =>
  description
    ? description.split('\n').map(line => `${indent}/// ${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}`.trimEnd())
    : []

const elementType = (element: DartElement): string => {
  if (element.kind !== 'scalar') return element.name
  return element.name === 'json' ? 'Object?' : element.name
}

/** Full Dart type of a field: list wrapping + `?` for nullable (json is already `Object?`). */
export const fieldType = (field: DartField): string => {
  const type = field.list ? `List<${elementType(field.element)}>` : elementType(field.element)
  return field.nullable && !type.endsWith('?') ? `${type}?` : type
}

/** Whether a field (or its list elements) is a `DateTime` needing Timestamp conversion. */
export const usesDateTime = (field: DartField): boolean =>
  field.element.kind === 'scalar' && field.element.name === 'DateTime'

/** Types (enums / models) a field references, for split-file imports. */
export const referencedType = (field: DartField): string | undefined =>
  field.element.kind === 'scalar' ? undefined : field.element.name

const literal = (value: unknown, element: DartElement, enums: Map<string, DartEnum>): string | undefined => {
  if (value === null) return 'null'
  if (element.kind === 'enum') {
    if (typeof value !== 'string') return undefined
    const match = enums.get(element.name)?.values.find(entry => entry.value === value)
    return match ? `${element.name}.${match.name}` : undefined
  }
  if (element.kind === 'model') return undefined
  if (element.name === 'DateTime') return undefined
  if (typeof value === 'string') return dartString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (element.name !== 'json') return undefined
  if (Array.isArray(value)) {
    const items = value.map(item => literal(item, element, enums))
    return items.every(item => item !== undefined) ? `<Object?>[${items.join(', ')}]` : undefined
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const rendered = literal(item, element, enums)
      return rendered === undefined ? undefined : `${dartString(key)}: ${rendered}`
    })
    return entries.every(entry => entry !== undefined) ? `<String, Object?>{${entries.join(', ')}}` : undefined
  }
  return undefined
}

/**
 * Dart constant for a field's `default`, or undefined when it cannot be
 * expressed (DateTime / embedded model defaults are dropped). Rendered without
 * `const` (an `@Default(…)` argument is a constant context); plain-class
 * constructor defaults add it where needed.
 */
export const defaultLiteral = (field: DartField, enums: Map<string, DartEnum>): string | undefined => {
  if (field.default === undefined) return undefined
  if (!field.list) return literal(field.default, field.element, enums)
  if (!Array.isArray(field.default)) return undefined
  const items = field.default.map(item => literal(item, field.element, enums))
  if (items.some(item => item === undefined)) return undefined
  return `<${elementType(field.element)}>[${items.join(', ')}]`
}

// ---------------------------------------------------------------------------
// Timestamp conversion
// ---------------------------------------------------------------------------

const TIMESTAMP_FUNCTIONS = [
  '/// Reads a Firestore timestamp: a `Timestamp`, `DateTime`, ISO-8601 string,',
  '/// epoch milliseconds, or a `{_seconds, _nanoseconds}` map (Admin SDK JSON).',
  'DateTime timestampFromJson(Object? value) {',
  '  if (value is Timestamp) return value.toDate();',
  '  if (value is DateTime) return value;',
  '  if (value is String) return DateTime.parse(value);',
  '  if (value is int) return DateTime.fromMillisecondsSinceEpoch(value);',
  '  if (value is Map) {',
  "    final seconds = value['_seconds'] ?? value['seconds'];",
  "    final nanoseconds = value['_nanoseconds'] ?? value['nanoseconds'] ?? 0;",
  '    if (seconds is int && nanoseconds is int) {',
  '      return Timestamp(seconds, nanoseconds).toDate();',
  '    }',
  '  }',
  "  throw ArgumentError.value(value, 'value', 'Unsupported timestamp value');",
  '}',
  '',
  '/// Nullable variant of [timestampFromJson].',
  'DateTime? timestampFromJsonOrNull(Object? value) => value == null ? null : timestampFromJson(value);',
  '',
  '/// Writes a `DateTime` as a Firestore `Timestamp`.',
  'Timestamp timestampToJson(DateTime value) => Timestamp.fromDate(value);',
  '',
  '/// Nullable variant of [timestampToJson].',
  'Timestamp? timestampToJsonOrNull(DateTime? value) => value == null ? null : timestampToJson(value);',
].join('\n')

const TIMESTAMP_CONVERTER = [
  '/// json_serializable converter between `DateTime` and Firestore `Timestamp`.',
  'class TimestampConverter implements JsonConverter<DateTime, Object> {',
  '  const TimestampConverter();',
  '',
  '  @override',
  '  DateTime fromJson(Object json) => timestampFromJson(json);',
  '',
  '  @override',
  '  Object toJson(DateTime object) => timestampToJson(object);',
  '}',
].join('\n')

/** Timestamp helpers (and the json_serializable converter for the freezed style). */
export const renderTimestampSupport = (style: DartStyle): string =>
  style === 'freezed' ? `${TIMESTAMP_FUNCTIONS}\n\n${TIMESTAMP_CONVERTER}` : TIMESTAMP_FUNCTIONS

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const renderEnum = (dartEnum: DartEnum, style: DartStyle): string => {
  const lines = [...docComment(dartEnum.description, ''), `enum ${dartEnum.name} {`]
  dartEnum.values.forEach((entry, index) => {
    lines.push(...docComment(entry.description, '  '))
    if (style === 'freezed') lines.push(`  @JsonValue(${dartString(entry.value)})`)
    const terminator = index === dartEnum.values.length - 1 ? ';' : ','
    lines.push(`  ${entry.name}(${dartString(entry.value)})${terminator}`)
  })
  lines.push(
    '',
    `  const ${dartEnum.name}(this.value);`,
    '',
    '  /// The value stored in Firestore.',
    '  final String value;'
  )
  if (style === 'plain') {
    lines.push(
      '',
      `  static ${dartEnum.name} fromJson(String value) => values.firstWhere(`,
      '        (entry) => entry.value == value,',
      `        orElse: () => throw ArgumentError.value(value, 'value', ${dartString(`Unknown ${dartEnum.name}`)}),`,
      '      );',
      '',
      '  String toJson() => value;'
    )
  }
  lines.push('}')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

const classDoc = (dartClass: DartClass): string[] => {
  const lines = docComment(dartClass.description, '')
  if (dartClass.collection) {
    if (lines.length > 0) lines.push('///')
    lines.push(`/// Firestore: \`${dartClass.collection}\``)
  }
  return lines
}

const renderFreezedClass = (dartClass: DartClass, enums: Map<string, DartEnum>): string => {
  const { name } = dartClass
  const readers: string[] = []
  const lines = [...classDoc(dartClass), '@freezed', `abstract class ${name} with _$${name} {`]
  lines.push('  @JsonSerializable(explicitToJson: true)')
  if (dartClass.fields.length === 0) {
    lines.push(`  const factory ${name}() = _${name};`)
  } else {
    lines.push(`  const factory ${name}({`)
    for (const field of dartClass.fields) {
      lines.push(...docComment(field.description, '    '))
      const annotations: string[] = []
      const keyArgs: string[] = []
      if (field.key !== field.name) keyArgs.push(`name: ${dartString(field.key)}`)
      if (field.omitIfNull) keyArgs.push('includeIfNull: false')
      if (usesDateTime(field)) annotations.push('@TimestampConverter()')
      const fallback = defaultLiteral(field, enums)
      // json_serializable applies `@Default` with `??`, which would turn an explicit
      // null into the default. For nullable fields the default is applied only to an
      // absent key (like plain output and the TS `.default().nullable()` schema).
      const absentOnly = fallback !== undefined && field.nullable
      if (absentOnly) {
        const reader = readerName(name, field)
        keyArgs.push(`readValue: ${reader}`)
        readers.push(
          `Object? ${reader}(Map<dynamic, dynamic> json, String key) =>\n    json.containsKey(key) ? json[key] : ${jsonLiteral(field.default)};`
        )
      } else if (fallback !== undefined) annotations.push(`@Default(${fallback})`)
      if (keyArgs.length > 0) annotations.unshift(`@JsonKey(${keyArgs.join(', ')})`)
      const required = fallback === undefined && !field.nullable ? 'required ' : ''
      const prefix = annotations.length > 0 ? `${annotations.join(' ')} ` : ''
      lines.push(`    ${prefix}${required}${fieldType(field)} ${field.name},`)
    }
    lines.push(`  }) = _${name};`)
  }
  lines.push('', `  factory ${name}.fromJson(Map<String, dynamic> json) => _$${name}FromJson(json);`, '}')
  return [lines.join('\n'), ...readers].join('\n\n')
}

/** Private top-level `readValue` function name for a field (`_readProductNote`). */
const readerName = (className: string, field: DartField): string =>
  `_read${className}${field.name.charAt(0).toUpperCase()}${field.name.slice(1)}`

/** Raw JSON value as a Dart literal (what the key would hold in the document). */
const jsonLiteral = (value: unknown): string => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return dartString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `<Object?>[${value.map(jsonLiteral).join(', ')}]`
  const entries = Object.entries(value as Record<string, unknown>).map(
    ([k, v]) => `${dartString(k)}: ${jsonLiteral(v)}`
  )
  return `<String, Object?>{${entries.join(', ')}}`
}

/** Decode expression for a non-list value `source` (non-null result unless `nullable`). */
const decodeElement = (element: DartElement, source: string, nullable: boolean): string => {
  const q = nullable ? '?' : ''
  if (element.kind === 'enum') {
    const decoded = `${element.name}.fromJson(${source} as String)`
    return nullable ? `${source} == null ? null : ${decoded}` : decoded
  }
  if (element.kind === 'model') {
    const decoded = `${element.name}.fromJson(${source} as Map<String, dynamic>)`
    return nullable ? `${source} == null ? null : ${decoded}` : decoded
  }
  switch (element.name) {
    case 'String':
      return `${source} as String${q}`
    case 'bool':
      return `${source} as bool${q}`
    case 'int':
      return `(${source} as num${q})${q}.toInt()`
    case 'double':
      return `(${source} as num${q})${q}.toDouble()`
    case 'DateTime':
      return nullable ? `timestampFromJsonOrNull(${source})` : `timestampFromJson(${source})`
    case 'json':
      return source
  }
}

const decodeField = (field: DartField, nullable: boolean): string => {
  const source = `json[${dartString(field.key)}]`
  if (!field.list) return decodeElement(field.element, source, nullable)
  const q = nullable ? '?' : ''
  const item = decodeElement(field.element, 'e', false)
  return `(${source} as List<dynamic>${q})${q}.map((e) => ${item}).toList()`
}

/** Encode expression for a non-list value `source` of the given nullability. */
const encodeElement = (element: DartElement, source: string, nullable: boolean): string => {
  if (element.kind !== 'scalar') return nullable ? `${source}?.toJson()` : `${source}.toJson()`
  if (element.name === 'DateTime') return nullable ? `timestampToJsonOrNull(${source})` : `timestampToJson(${source})`
  return source
}

const encodeField = (field: DartField): string => {
  if (!field.list) return encodeElement(field.element, field.name, field.nullable)
  const item = encodeElement(field.element, 'e', false)
  if (item === 'e') return field.name
  return `${field.name}${field.nullable ? '?' : ''}.map((e) => ${item}).toList()`
}

const renderPlainClass = (dartClass: DartClass, enums: Map<string, DartEnum>): string => {
  const { name, fields } = dartClass
  const lines = [...classDoc(dartClass), `class ${name} {`]
  if (fields.length === 0) {
    lines.push(`  const ${name}();`, '')
    lines.push(`  factory ${name}.fromJson(Map<String, dynamic> json) => const ${name}();`)
    lines.push('', '  Map<String, dynamic> toJson() => <String, dynamic>{};', '}')
    return lines.join('\n')
  }
  lines.push(`  const ${name}({`)
  for (const field of fields) {
    const fallback = defaultLiteral(field, enums)
    // Default parameter values are not a constant context: collection literals need `const`.
    if (fallback !== undefined)
      lines.push(`    this.${field.name} = ${/^<[^>]+>[[{]/.test(fallback) ? `const ${fallback}` : fallback},`)
    else if (field.nullable) lines.push(`    this.${field.name},`)
    else lines.push(`    required this.${field.name},`)
  }
  lines.push('  });', '')
  lines.push(`  factory ${name}.fromJson(Map<String, dynamic> json) => ${name}(`)
  for (const field of fields) {
    const fallback = defaultLiteral(field, enums)
    let expr: string
    if (fallback === undefined) expr = decodeField(field, field.nullable)
    else if (field.nullable)
      expr = `json.containsKey(${dartString(field.key)}) ? ${decodeField(field, true)} : ${fallback}`
    else expr = `${wrap(decodeField(field, true))} ?? ${fallback}`
    lines.push(`        ${field.name}: ${expr},`)
  }
  lines.push('      );')
  for (const field of fields) {
    lines.push('', ...docComment(field.description, '  '), `  final ${fieldType(field)} ${field.name};`)
  }
  lines.push('', '  Map<String, dynamic> toJson() => <String, dynamic>{')
  for (const field of fields) {
    const entry = `${dartString(field.key)}: ${encodeField(field)}`
    lines.push(field.omitIfNull ? `        if (${field.name} != null) ${entry},` : `        ${entry},`)
  }
  lines.push('      };', '}')
  return lines.join('\n')
}

/** Parenthesize conditional expressions before applying `??`. */
const wrap = (expr: string): string => (expr.includes(' ? ') ? `(${expr})` : expr)

export const renderClass = (dartClass: DartClass, style: DartStyle, enums: Map<string, DartEnum>): string =>
  style === 'freezed' ? renderFreezedClass(dartClass, enums) : renderPlainClass(dartClass, enums)

// ---------------------------------------------------------------------------
// Collection path helpers
// ---------------------------------------------------------------------------

const PARAM_RE = /\{([^}]+)\}/g

/** Dart string with `{param}` segments interpolated (`$id`, or `${id}` before identifier chars). */
const interpolate = (path: string, names: Map<string, string>): string => {
  let out = ''
  let last = 0
  for (const match of path.matchAll(PARAM_RE)) {
    out += dartString(path.slice(last, match.index)).slice(1, -1)
    const name = names.get(match[1]) ?? match[1]
    const next = path.charAt(match.index + match[0].length)
    out += /[A-Za-z0-9_$]/.test(next) ? `\${${name}}` : `$${name}`
    last = match.index + match[0].length
  }
  out += dartString(path.slice(last)).slice(1, -1)
  return `'${out}'`
}

const paramsOf = (path: string): string[] => [...path.matchAll(PARAM_RE)].map(match => match[1])

const pathFunction = (fn: string, path: string, names: Map<string, string>): string => {
  const params = [...new Set(paramsOf(path))].map(param => `required String ${names.get(param)}`)
  const signature = params.length > 0 ? `{${params.join(', ')}}` : ''
  return `  static String ${fn}(${signature}) => ${interpolate(path, names)};`
}

/**
 * `<Doc>Path` helpers for a projection's Firestore path: the raw template, the
 * collection path, and (for document paths) the document path.
 */
export const renderPathHelpers = (dartClass: DartClass): string | undefined => {
  const template = dartClass.collection
  if (!template) return undefined
  const segments = template.split('/').filter(segment => segment.length > 0)
  if (segments.length === 0) return undefined
  const params = [...new Set(paramsOf(template))]
  const names = new Map<string, string>()
  const used = new Set<string>()
  for (const param of params) {
    const base = dartIdentifier(param)
    let name = base
    let suffix = 2
    while (used.has(name)) name = `${base}${suffix++}`
    used.add(name)
    names.set(param, name)
  }
  const isDocPath = segments.length % 2 === 0
  const collectionPath = isDocPath ? segments.slice(0, -1).join('/') : segments.join('/')
  const lines = [
    `/// Firestore path helpers for [${dartClass.name}].`,
    `abstract final class ${dartClass.name}Path {`,
    `  static const String template = ${dartString(template)};`,
    '',
    pathFunction('collection', collectionPath, names),
  ]
  if (isDocPath) lines.push('', pathFunction('doc', segments.join('/'), names))
  lines.push('}')
  return lines.join('\n')
}
