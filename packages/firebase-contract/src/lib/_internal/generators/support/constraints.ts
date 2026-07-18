import { IrField } from '../../ir/ir.js'

const isNumber = (field: IrField): boolean =>
  field.type.kind === 'scalar' && (field.type.name === 'int' || field.type.name === 'int64' || field.type.name === 'float')

const isStringy = (field: IrField): boolean =>
  field.type.kind === 'scalar' && (field.type.name === 'string' || field.type.name === 'id')

/**
 * Zod constraint chain for a field. For list fields the constraints apply to the
 * array (length); otherwise to the value. Returned as a suffix to append after
 * the base schema (and after `z.array(...)` for lists).
 */
export const zodConstraints = (field: IrField): string => {
  const c = field.constraints
  const parts: string[] = []
  if (field.list) {
    if (c.minLength !== undefined) parts.push(`.min(${c.minLength})`)
    if (c.maxLength !== undefined) parts.push(`.max(${c.maxLength})`)
    if (c.nonempty) parts.push('.nonempty()')
    return parts.join('')
  }
  if (isNumber(field)) {
    if (c.min !== undefined) parts.push(`.min(${c.min})`)
    if (c.max !== undefined) parts.push(`.max(${c.max})`)
  }
  if (isStringy(field)) {
    if (c.email) parts.push('.email()')
    if (c.url) parts.push('.url()')
    if (c.nonempty || c.minLength !== undefined) parts.push(`.min(${c.minLength ?? 1})`)
    if (c.maxLength !== undefined) parts.push(`.max(${c.maxLength})`)
    if (c.pattern) parts.push(`.regex(/${c.pattern}/)`)
  }
  return parts.join('')
}
