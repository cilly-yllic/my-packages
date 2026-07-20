import { Ir } from '../../ir/ir.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'
import { withSplitVariant } from '../support/split-variant.js'
import { createZodSplitLayout } from './zod-split-generator.js'
import { outputFile } from '../support/templates.js'
import { renderEnum, renderModel } from './render.js'

/**
 * Generates Zod schemas and the types inferred from them. Model references use
 * `z.lazy` so the output is order- and cycle-independent. Rendering is shared
 * with the split layout (./render.js) so both emit identical members.
 */
export const createZodGenerator = (): Generator =>
  withSplitVariant(
    {
      name: 'zod',
  description: 'Zod validation schemas',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    const blocks: string[] = [...headerBlocks(context), "import { z } from 'zod'"]

    for (const irEnum of ir.enums) {
      blocks.push(renderEnum(irEnum))
    }

    for (const model of ir.models) {
      blocks.push(renderModel(model, ir))
    }

    return [{ path: outputFile(context, 'schemas.ts'), content: `${blocks.join('\n\n')}\n` }]
  },
    },
    createZodSplitLayout()
  )
