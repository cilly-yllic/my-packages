/** Stateless naming helpers shared by generators. Pure functions only. */

const words = (value: string): string[] =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-\s]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

export const pascalCase = (value: string): string =>
  words(value)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')

export const camelCase = (value: string): string => {
  const pascal = pascalCase(value)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

export const constantCase = (value: string): string =>
  words(value)
    .map(word => word.toUpperCase())
    .join('_')

export const snakeCase = (value: string): string =>
  words(value)
    .map(word => word.toLowerCase())
    .join('_')

export const kebabCase = (value: string): string =>
  words(value)
    .map(word => word.toLowerCase())
    .join('-')

/** Naive English pluralization sufficient for table naming. */
export const pluralize = (value: string): string => {
  if (/[^aeiou]y$/.test(value)) return `${value.slice(0, -1)}ies`
  if (/(s|x|z|ch|sh)$/.test(value)) return `${value}es`
  return `${value}s`
}

/** Escape a string for use inside a single-quoted TypeScript literal. */
export const singleQuote = (value: string): string => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
