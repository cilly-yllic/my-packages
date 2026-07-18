import { Ir, IrUnion } from '../../ir/ir.js'
import { singleQuote } from '../support/naming.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'

const schemaName = (name: string): string => `${name}Schema`

const renderUnion = (union: IrUnion): string => {
  const variantSchemas = union.variants.map(schemaName).join(', ')
  const variantTypes = union.variants.join(' | ') || 'never'
  const doc = union.description ? `/** ${union.description} */\n` : ''
  return [
    `${doc}export const ${schemaName(union.name)} = z.discriminatedUnion(${singleQuote(union.discriminant)}, [${variantSchemas}])`,
    `export type ${union.name} = ${variantTypes}`,
  ].join('\n')
}

/**
 * Generates Zod discriminated unions (and their TS union types) over model
 * variants — e.g. a `z.discriminatedUnion('operationType', …)` of operation drafts.
 * References the variant schemas/types from the zod and typescript outputs.
 */
export const createUnionGenerator = (): Generator => ({
  name: 'unions',
  description: 'Zod discriminated unions + TS union types',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    if (ir.unions.length === 0) {
      return []
    }
    const variantNames = [...new Set(ir.unions.flatMap(union => union.variants))].sort()
    const blocks: string[] = [...headerBlocks(context), "import { z } from 'zod'"]
    if (variantNames.length > 0) {
      // One import block — a blank line between relative imports trips import/order.
      blocks.push(
        `import { ${variantNames.map(schemaName).join(', ')} } from './schemas.js'\n` +
          `import type { ${variantNames.join(', ')} } from './types.js'`
      )
    }
    for (const union of ir.unions) {
      blocks.push(renderUnion(union))
    }
    return [{ path: 'unions.ts', content: `${blocks.join('\n\n')}\n` }]
  },
})
