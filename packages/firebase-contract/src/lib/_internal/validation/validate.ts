import { Diagnostic } from '../diagnostics.js'
import { Ir } from '../ir/ir.js'

import { DEFAULT_RULES, ValidationRule } from './rules.js'

/**
 * Run semantic validation over the IR. Callers may pass a custom rule set to
 * add or replace checks; by default the built-in {@link DEFAULT_RULES} run.
 */
export const validateIr = (ir: Ir, rules: ValidationRule[] = DEFAULT_RULES): Diagnostic[] =>
  rules.flatMap(rule => rule(ir))
