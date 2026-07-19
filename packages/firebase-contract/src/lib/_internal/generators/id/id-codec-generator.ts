import { Ir, IrField, IrModel } from '../../ir/ir.js'
import { pascalCase } from '../support/naming.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'
import { outputFile } from '../support/templates.js'

export interface IdCodecGeneratorOptions {
  /**
   * Module the generic `encodeNumericId`/`decodeNumericId`/`encodeStringId`/
   * `decodeStringId` primitives are imported from. Defaults to `./id-core.js`.
   */
  core?: string
}

const idFieldOf = (model: IrModel): IrField | undefined => {
  const ids = model.fields.filter(field => field.isId)
  return ids.length === 1 ? ids[0] : undefined
}

/** Numeric (Int64/bigserial) ids use the numeric codec; everything else the string codec. */
const isNumericId = (field: IrField): boolean => field.type.kind === 'scalar' && (field.type.name === 'int' || field.type.name === 'int64')

/**
 * Self-contained Sqids primitives, emitted when the contract configures
 * `project.idCodec`, so the Sqids alphabet/minLength stay a contract-level
 * constant shared by every service.
 */
const idCoreFile = (idCodec: { minLength?: number; alphabet?: string }): string => `import Sqids from 'sqids'

/**
 * ID 短縮用の Sqids インスタンス
 *
 * minLength: 最小${idCodec.minLength ?? 8}文字（短すぎないように）
 * alphabet: URL-safe な文字のみ（シャッフル済み）
 */
const sqids = new Sqids({
  minLength: ${idCodec.minLength ?? 8},
  alphabet: '${idCodec.alphabet ?? ''}',
})

/**
 * 数値 ID（DC の BIGINT 等）を Sqids でエンコードして短い URL-safe 文字列にする。
 *
 * @param id - 数値 ID（string 形式の数値、JS の safe integer 範囲内）
 * @returns 短縮文字列
 * @throws safe integer 範囲を超える場合
 */
export const encodeNumericId = (id: string): string => {
  if (id === '') {
    throw new Error('Cannot encode empty ID')
  }
  const numId = Number(id)
  if (!Number.isSafeInteger(numId)) {
    throw new Error(\`ID exceeds safe integer range: \${id}\`)
  }
  return sqids.encode([numId])
}

/**
 * \`encodeNumericId\` でエンコードされた文字列を元の数値文字列に戻す。
 *
 * @param encoded - encodeNumericId の出力
 * @returns DC の ID（string 形式）
 * @throws デコードできない場合
 */
export const decodeNumericId = (encoded: string): string => {
  const decoded = sqids.decode(encoded)
  const value = decoded[0]
  if (value === undefined) {
    throw new Error(\`Invalid encoded numeric ID: \${encoded}\`)
  }
  return value.toString()
}

/**
 * 任意の文字列を Sqids でエンコードする。
 *
 * 文字列の各コードポイント (UTF-16 サロゲートペアも 1 文字として扱う) を
 * 数値配列に変換し、 sqids にかける。 結果は URL-safe な短縮文字列。
 *
 * 用途: Firebase uid のような英数字 ID を、 数値 ID と同じ枠組みで扱いたいとき。
 * 文字列長に比例して結果も長くなるので、 短縮効果は薄い (難読化が主目的)。
 */
export const encodeStringId = (str: string): string => {
  if (str === '') {
    throw new Error('Cannot encode empty string')
  }
  const codePoints = Array.from(str).map(c => c.codePointAt(0) ?? 0)
  return sqids.encode(codePoints)
}

/**
 * \`encodeStringId\` でエンコードされた文字列を元の文字列に戻す。
 *
 * @throws デコードできない場合
 */
export const decodeStringId = (encoded: string): string => {
  const codePoints = sqids.decode(encoded)
  if (codePoints.length === 0) {
    throw new Error(\`Invalid encoded string ID: \${encoded}\`)
  }
  return String.fromCodePoint(...codePoints)
}
`

const renderCodec = (model: IrModel, field: IrField): string => {
  const name = pascalCase(model.name)
  if (isNumericId(field)) {
    return [
      `export const encode${name}Id = (id: number | string): string => encodeNumericId(String(id))`,
      `export const decode${name}Id = (encoded: string): string => decodeNumericId(encoded)`,
    ].join('\n')
  }
  return [
    `export const encode${name}Id = (id: string): string => encodeStringId(id)`,
    `export const decode${name}Id = (encoded: string): string => decodeStringId(encoded)`,
  ].join('\n')
}

/**
 * Generates typed per-entity id encode/decode wrappers (`encodeShopId`,
 * `decodeProductId`, …) over the generic Sqids/hashids primitives — instead of
 * scattering untyped `encodeNumericId` calls at every call site, the wrappers
 * make the int↔string boundary explicit and entity-safe.
 */
export const createIdCodecGenerator = (options: IdCodecGeneratorOptions = {}): Generator => {
  const core = options.core ?? './id-core'
  return {
    name: 'id-codecs',
    description: 'Typed per-entity id encode/decode wrappers',
    generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
      const entries = ir.models
        .map(model => ({ model, field: idFieldOf(model) }))
        .filter((entry): entry is { model: IrModel; field: IrField } => !!entry.field)
      if (entries.length === 0) {
        return []
      }
      const needsNumeric = entries.some(e => isNumericId(e.field))
      const needsString = entries.some(e => !isNumericId(e.field))
      const imports = [
        ...(needsNumeric ? ['encodeNumericId', 'decodeNumericId'] : []),
        ...(needsString ? ['encodeStringId', 'decodeStringId'] : []),
      ]
      const blocks: string[] = [...headerBlocks(context), `import { ${imports.join(', ')} } from '${core}'`]
      for (const { model, field } of entries) {
        blocks.push(renderCodec(model, field))
      }
      const files: GeneratedFile[] = [{ path: outputFile(context, 'id-codecs.ts'), content: `${blocks.join('\n\n')}\n` }]
      // Emit the primitives too when the contract pins the Sqids settings.
      if (ir.project?.idCodec && core === './id-core') {
        files.push({ path: 'id-core.ts', content: idCoreFile(ir.project.idCodec) })
      }
      return files
    },
  }
}
