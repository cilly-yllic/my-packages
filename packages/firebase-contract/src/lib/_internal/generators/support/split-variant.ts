import { Generator } from '../generator.js'

/**
 * Merge a single-file generator and its per-item split layout into ONE
 * registry entry: `split: true` in the declaration routes to the split
 * implementation, everything else (name, description, defaults) comes from
 * the base. Keeps "one concern = one generator id" in the YAML surface.
 */
export const withSplitVariant = (base: Generator, splitVariant: Generator): Generator => ({
  ...base,
  splittable: true,
  generate(ir, context) {
    return (context?.output?.split ? splitVariant : base).generate(ir, context)
  },
})
