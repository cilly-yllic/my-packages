import { Ir } from '../../ir/ir.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'
import { withSplitVariant } from '../support/split-variant.js'
import { createTypeScriptSplitLayout } from './typescript-split-generator.js'
import { outputFile } from '../support/templates.js'
import { JSON_TYPE, renderEnumConst, renderEnumUnion, renderModel, usesJson } from './render.js'

export interface TypeScriptGeneratorOptions {
  /**
   * How enums are emitted. `const` (default) produces a frozen const object plus
   * a `Key` type and a value type — giving runtime values and types from one
   * source. `union` produces a plain
   * string-literal union.
   */
  enumStyle?: 'const' | 'union'
}

/**
 * Generates TypeScript types: an interface per model and, per enum, either a
 * frozen const object (default — runtime values + `Key`/value types) or a
 * plain string-literal union. This is the highest-priority
 * generator and the shape other TS-facing generators reference. Rendering is
 * shared with the split layout (./render.js) so both emit identical members.
 */
export const createTypeScriptGenerator = (options: TypeScriptGeneratorOptions = {}): Generator => {
  const enumStyle = options.enumStyle ?? 'const'
  return withSplitVariant(
    {
  name: 'typescript',
  description: 'TypeScript interfaces and enum const/union types',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    const blocks: string[] = [...headerBlocks(context)]
    // Pinned value objects (models with `out`) are firestore-scoped: excluded here.
    const models = ir.models.filter(model => model.out === undefined)

    if (usesJson(models)) {
      blocks.push(JSON_TYPE)
    }

    for (const irEnum of ir.enums) {
      blocks.push(enumStyle === 'const' ? renderEnumConst(irEnum) : renderEnumUnion(irEnum))
    }

    for (const model of models) {
      blocks.push(renderModel(model, ir))
    }

    return [{ path: outputFile(context, 'types.ts'), content: `${blocks.join('\n\n')}\n` }]
  },
    },
    createTypeScriptSplitLayout()
  )
}
