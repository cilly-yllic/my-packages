import { describe, expect, it } from 'vitest'

import { generateAll } from '../compiler/compiler.js'
import { buildIr } from '../ir/build-ir.js'
import { parseContract } from '../parser/parse.js'
import { createMemoryLoader } from '../resolver/module-loader.js'
import { createDartGenerator } from './dart/dart-generator.js'
import { GeneratedFile, GeneratorContext } from './generator.js'

// Exercises every mapping the Dart generator handles: enums (key overrides,
// reserved names), embedded value objects, relations, fragments (`_meta_`),
// timestamps (single / list / nullable), defaults, json, and collection paths.
const CONTRACT = `
enums:
  ProductStatus:
    description: Lifecycle state of a product
    values:
      - DRAFT
      - { value: IN_REVIEW, description: Waiting for <review> }
      - PUBLISHED
  ReviewStatus:
    values:
      - { value: Q, key: QUEUED }
      - { value: new, key: new }
models:
  MetaOp:
    out: firestore/_
    file: _meta_.ts
    fields:
      id: { type: string, description: op id }
  Meta:
    description: consistency envelope
    out: firestore/_
    file: _meta_.ts
    fields:
      scope: { type: float, nullable: true }
      op: { type: MetaOp, nullable: true }
      syncedAt: { type: timestamp, optional: true }
  Dimensions:
    fields:
      width: float
      height: float
      unit: { type: string, default: cm }
  User:
    fields:
      id: { type: id, id: true }
      displayName: string
      photoURL: { type: string, optional: true }
      createdAt: timestamp
  Shop:
    fields:
      id: { type: id, id: true }
      name: string
      owner: { type: User, relation: true }
      status: ProductStatus
      createdAt: timestamp
      updatedAt: { type: timestamp, optional: true }
  Product:
    fields:
      id: { type: id, id: true }
      shop: { type: Shop, relation: true }
      title: string
      price: int
      dimensions: { type: Dimensions, optional: true }
fragments:
  meta:
    fields:
      _meta_: { type: Meta }
firestore:
  User:
    from: User
    collection: users/{userId}
    pick: [displayName, photoURL, createdAt]
  Shop:
    description: A shop document
    from: Shop
    collection: shops/{shopId}
    extends: [meta]
  Product:
    from: Product
    collection: shops/{shopId}/products/{product-id}
    omit: [id]
    fields:
      tags: { type: string, list: true, default: [] }
      review: { type: ReviewStatus, default: Q }
      publishedAts: { type: timestamp, list: true }
      attributes: { type: json, optional: true }
      note: { type: string, optional: true, description: absent when unset }
      archived: { type: boolean, nullable: true }
      default: { type: string, optional: true }
      fallback: { type: string, nullable: true, default: none }
  AuditLog:
    collection: audit_logs
    fields:
      message: string
      at: timestamp
`

const CASES = [
  { name: 'freezed_single', split: false, style: 'freezed' },
  { name: 'freezed_split', split: true, style: 'freezed' },
  { name: 'plain_single', split: false, style: 'plain' },
  { name: 'plain_split', split: true, style: 'plain' },
] as const

const generate = (split: boolean, style?: string, contract = CONTRACT): GeneratedFile[] => {
  const { ir } = buildIr([parseContract(contract, '/c.yml')])
  const context: GeneratorContext = { output: { split, ...(style ? { options: { style } } : {}) } }
  return createDartGenerator().generate(ir, context)
}

const contentOf = (files: GeneratedFile[], path: string): string => files.find(f => f.path === path)?.content ?? ''

describe('dart generator', () => {
  // File snapshots double as the `dart analyze` input (dart-check/, see README).
  for (const testCase of CASES) {
    it(`matches the ${testCase.name} snapshot`, async () => {
      for (const file of generate(testCase.split, testCase.style)) {
        await expect(file.content).toMatchFileSnapshot(`../../../../dart-check/lib/gen/${testCase.name}/${file.path}`)
      }
    })
  }

  it('defaults to freezed in a single contracts.dart', () => {
    const files = generate(false)
    expect(files.map(f => f.path)).toEqual(['contracts.dart'])
    const content = files[0].content
    expect(content).toContain("part 'contracts.freezed.dart';")
    expect(content).toContain('abstract class Shop with _$Shop {')
    expect(content).toContain('class TimestampConverter implements JsonConverter<DateTime, Object> {')
  })

  it('maps enums to Dart enums with @JsonValue and camelCase / escaped value names', () => {
    const content = generate(false)[0].content
    expect(content).toContain("  @JsonValue('IN_REVIEW')\n  inReview('IN_REVIEW'),")
    expect(content).toContain("  @JsonValue('Q')\n  queued('Q'),")
    // `new` is a Dart keyword → suffixed.
    expect(content).toContain("  @JsonValue('new')\n  newValue('new');")
    expect(content).toContain('  /// Waiting for &lt;review&gt;')
  })

  it('maps field types, relations, fragments and nullability', () => {
    const content = generate(false)[0].content
    expect(content).toContain('    required String ownerId,')
    expect(content).toContain('    @TimestampConverter() required DateTime createdAt,')
    expect(content).toContain('    @TimestampConverter() DateTime? updatedAt,')
    expect(content).toContain("    @JsonKey(name: '_meta_') required Meta meta,")
    expect(content).toContain('    @TimestampConverter() required List<DateTime> publishedAts,')
    expect(content).toContain('    @JsonKey(includeIfNull: false) Object? attributes,')
    expect(content).toContain('    bool? archived,')
    expect(content).toContain("    @JsonKey(name: 'default', includeIfNull: false) String? defaultValue,")
    expect(content).toContain('    @Default(<String>[]) List<String> tags,')
    expect(content).toContain('    @Default(ReviewStatus.queued) ReviewStatus review,')
    expect(content).toContain("    @Default('cm') String unit,")
    // `photoURL` is a valid identifier: kept verbatim, no @JsonKey rename.
    expect(content).toContain('    String? photoURL,')
  })

  it('emits collection path helpers for document and collection paths', () => {
    const content = generate(false)[0].content
    expect(content).toContain("  static const String template = 'shops/{shopId}/products/{product-id}';")
    expect(content).toContain("  static String collection({required String shopId}) => 'shops/$shopId/products';")
    expect(content).toContain(
      "  static String doc({required String shopId, required String productId}) => 'shops/$shopId/products/$productId';"
    )
    expect(content).toContain('abstract final class AuditLogPath {')
    expect(content).toContain("  static String collection() => 'audit_logs';")
    expect(content).not.toContain('AuditLogPath.doc')
  })

  it('splits into one file per type with relative imports and a barrel', () => {
    const files = generate(true)
    expect(files.map(f => f.path).sort()).toEqual([
      'audit_log.dart',
      'contracts.dart',
      'dimensions.dart',
      'meta.dart',
      'meta_op.dart',
      'product.dart',
      'product_status.dart',
      'review_status.dart',
      'shop.dart',
      'timestamp_converter.dart',
      'user.dart',
    ])
    const shop = contentOf(files, 'shop.dart')
    expect(shop).toContain("import 'meta.dart';\nimport 'product_status.dart';\nimport 'timestamp_converter.dart';")
    expect(shop).toContain("part 'shop.freezed.dart';\npart 'shop.g.dart';")
    expect(contentOf(files, 'contracts.dart')).toContain("export 'shop.dart';\nexport 'timestamp_converter.dart';")
  })

  it('renames the single file / barrel via `file`', () => {
    const { ir } = buildIr([parseContract(CONTRACT, '/c.yml')])
    const single = createDartGenerator().generate(ir, { output: { file: 'models.dart' } })
    expect(single[0].path).toBe('models.dart')
    expect(single[0].content).toContain("part 'models.freezed.dart';")
    const split = createDartGenerator().generate(ir, { output: { split: true, file: 'models.dart' } })
    expect(split.some(f => f.path === 'models.dart' && f.content.includes("export 'shop.dart';"))).toBe(true)
  })

  it('renders dependency-free plain classes with fromJson / toJson', () => {
    const content = generate(false, 'plain')[0].content
    expect(content).not.toContain('freezed')
    expect(content).toContain("        createdAt: timestampFromJson(json['createdAt']),")
    expect(content).toContain("        updatedAt: timestampFromJsonOrNull(json['updatedAt']),")
    expect(content).toContain("        meta: Meta.fromJson(json['_meta_'] as Map<String, dynamic>),")
    expect(content).toContain("        price: (json['price'] as num).toInt(),")
    expect(content).toContain(
      "        tags: (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ?? <String>[],"
    )
    // Absent-when-unset fields are skipped on write; nullable ones are written as null.
    expect(content).toContain("        if (note != null) 'note': note,")
    expect(content).toContain("        'archived': archived,")
    expect(content).toContain("        'publishedAts': publishedAts.map((e) => timestampToJson(e)).toList(),")
  })

  it('emits nothing without firestore projections', () => {
    expect(generate(false, undefined, 'models:\n  A:\n    fields:\n      name: string\n')).toEqual([])
  })

  it('throws on an unknown style when called programmatically', () => {
    expect(() => generate(false, 'nope')).toThrow(/unknown options.style "nope"/)
  })
})

describe('dart generator review regressions', () => {
  const contract = (body: string): string => `
models:
  User:
    fields:
      id: { type: id, id: true }
      name: string
${body}`

  it('keeps explicit null for nullable fields with a default (freezed readValue)', () => {
    const content = generate(false)[0].content
    expect(content).toContain('    @JsonKey(readValue: _read$Product$fallback) String? fallback,')
    expect(content).toContain(
      "Object? _read$Product$fallback(Map<dynamic, dynamic> json, String key) =>\n    json.containsKey(key) ? json[key] : 'none';"
    )
    expect(content).not.toContain("@Default('none')")
    expect(generate(false, 'plain')[0].content).toContain(
      "        fallback: json.containsKey('fallback') ? json['fallback'] as String? : 'none',"
    )
  })

  it('rejects an embedded model and a projection that share a Dart type name', () => {
    const body = `
firestore:
  User:
    from: User
    pick: [name]
  Order:
    fields:
      buyer: { type: User }
`
    expect(() => generate(false, undefined, contract(body))).toThrow(
      /"User" is emitted by model User and firestore User/
    )
    expect(() => generate(true, undefined, contract(body))).toThrow(/"User" is emitted by/)
  })

  it('rejects a type that collides with a generated <Doc>Path helper', () => {
    const body = `
firestore:
  A:
    collection: a/{id}
    fields:
      x: string
  APath:
    fields:
      y: string
`
    expect(() => generate(false, undefined, contract(body))).toThrow(
      /"APath" is emitted by path helper of firestore A and firestore APath/
    )
  })

  it('rejects type names that are Dart keywords or shadow core types', () => {
    const body = (name: string): string => `
firestore:
  ${name}:
    fields:
      x: string
`
    expect(() => generate(false, undefined, contract(body('class')))).toThrow(
      /"class" .* is not a valid Dart type name/
    )
    expect(() => generate(false, undefined, contract(body('DateTime')))).toThrow(/shadows a Dart core\/support name/)
  })

  it('exports from a nested barrel relative to the output root', () => {
    const { ir } = buildIr([parseContract(CONTRACT, '/c.yml')])
    const files = createDartGenerator().generate(ir, { output: { split: true, file: 'sub/contracts.dart' } })
    const barrel = files.find(f => f.path === 'sub/contracts.dart')?.content ?? ''
    expect(barrel).toContain("export '../shop.dart';")
    expect(barrel).toContain("export '../timestamp_converter.dart';")
    expect(files.some(f => f.path === 'shop.dart')).toBe(true)
  })

  it('keeps readValue helpers unique across classes (A.bC vs AB.c)', () => {
    const body = `
firestore:
  A:
    fields:
      bC: { type: string, nullable: true, default: x }
  AB:
    fields:
      c: { type: string, nullable: true, default: y }
`
    const content = generate(false, undefined, contract(body))[0].content
    expect(content).toContain('Object? _read$A$bC(')
    expect(content).toContain('Object? _read$AB$c(')
  })

  it('accepts contextual keywords as type names but rejects support names', () => {
    const body = (name: string): string => `
firestore:
  ${name}:
    fields:
      at: timestamp
`
    for (const name of ['async', 'show', 'when']) {
      expect(() => generate(false, undefined, contract(body(name)))).not.toThrow()
    }
    expect(() => generate(false, undefined, contract(body('timestampFromJson')))).toThrow(
      /shadows a Dart core\/support name/
    )
    expect(() => generate(false, undefined, contract(body('ArgumentError')))).toThrow(/shadows/)
  })

  it('normalizes the barrel path before computing exports and collisions', () => {
    const { ir } = buildIr([parseContract(CONTRACT, '/c.yml')])
    const barrelOf = (file: string): GeneratedFile[] =>
      createDartGenerator().generate(ir, { output: { split: true, file } })
    const root = barrelOf('./contracts.dart')
    expect(root.find(f => f.path === 'contracts.dart')?.content).toContain("export 'shop.dart';")
    const nested = barrelOf('sub/./contracts.dart')
    expect(nested.find(f => f.path === 'sub/contracts.dart')?.content).toContain("export '../shop.dart';")
    const windows = barrelOf('sub\\contracts.dart')
    expect(windows.find(f => f.path === 'sub/contracts.dart')?.content).toContain("export '../shop.dart';")
    for (const bad of ['./timestamp_converter.dart', 'TIMESTAMP_CONVERTER.dart', '../contracts.dart', '/abs.dart']) {
      expect(() => barrelOf(bad)).toThrow(/must not be timestamp_converter.dart or leave the output directory/)
    }
    // A barrel that differs only in case from a type file pushes the type file aside.
    const upper = barrelOf('Shop.dart')
    expect(upper.map(f => f.path)).toContain('shop_2.dart')
  })

  it('refuses a barrel named like the timestamp helper file', () => {
    const { ir } = buildIr([parseContract(CONTRACT, '/c.yml')])
    expect(() =>
      createDartGenerator().generate(ir, { output: { split: true, file: 'timestamp_converter.dart' } })
    ).toThrow(/must not be timestamp_converter.dart/)
  })
})

describe('dart generator declaration', () => {
  const run = (options: string) =>
    generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({
        '/proj/contract.yml': `
generators:
  - { generator: dart, out: lib/gen, split: true${options} }
models:
  User:
    fields:
      id: { type: id, id: true }
      name: string
firestore:
  User:
    from: User
    collection: users/{userId}
`,
      }),
    })

  it('generates split output from a yml declaration', () => {
    const result = run(', options: { style: plain }')
    expect(result.ok).toBe(true)
    const paths = result.targets.flatMap(target => target.files.map(file => file.path))
    expect(paths).toContain('/proj/lib/gen/user.dart')
    expect(paths).toContain('/proj/lib/gen/contracts.dart')
  })

  it('rejects an unknown style value', () => {
    const result = run(', options: { style: frozen }')
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some(d => d.code === 'INVALID_VALUE' && d.message.includes('frozen'))).toBe(true)
  })

  it('rejects prototype-named option keys as unknown (no crash)', () => {
    for (const key of ['constructor', 'toString']) {
      const result = run(`, options: { ${key}: plain }`)
      expect(result.ok).toBe(false)
      expect(result.diagnostics.some(d => d.code === 'UNKNOWN_KEY' && d.message.includes(key))).toBe(true)
    }
  })

  it('reports a generator failure as a diagnostic instead of throwing', () => {
    const result = generateAll('/proj/contract.yml', {
      loader: createMemoryLoader({
        '/proj/contract.yml': `
generators:
  - { generator: dart, out: lib/gen }
firestore:
  class:
    fields:
      x: string
`,
      }),
    })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some(d => d.code === 'GENERATOR_FAILED' && d.message.includes('dart'))).toBe(true)
  })

  it('keeps other generators running and reports the failing one with its error class', () => {
    const { generate: run } = { generate: generateAll }
    const result = run('/proj/contract.yml', {
      loader: createMemoryLoader({
        '/proj/contract.yml': `
generators:
  - { generator: dart, out: lib/gen }
  - { generator: typescript, out: src }
firestore:
  class:
    fields:
      x: string
`,
      }),
    })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.filter(d => d.code === 'GENERATOR_FAILED')).toHaveLength(1)
  })

  it('rejects an unknown option key', () => {
    const result = run(', options: { styel: plain }')
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some(d => d.code === 'UNKNOWN_KEY' && d.message.includes('styel'))).toBe(true)
  })
})
