import { isArray } from '~core/type-check.js'
// const validate = (text: string): RegExpMatchArray | null =>
//   text.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)

isArray([])

export const camelCase = (text: string) =>
  `${text.charAt(0).toLowerCase()}${text.slice(1)}`.replace(/[-_](.)/g, (_, group1) => group1.toUpperCase())

export const snakeCase = (text: string) => camelCase(text).replace(/[A-Z]/g, s => `_${s.charAt(0).toLowerCase()}`)

export const kebabCase = (text: string): string =>
  camelCase(text).replace(/[A-Z]/g, s => `-${s.charAt(0).toLowerCase()}`)

export const pascalCase = (text: string) => {
  const camel = camelCase(text)
  return `${camel.charAt(0).toUpperCase()}${camel.slice(1)}`
}

export const hexdec = (stringText: string): number => {
  return parseInt(stringText.replace(/[^a-f0-9]/gi, ''), 16)
}
