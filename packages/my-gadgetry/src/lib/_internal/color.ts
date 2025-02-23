import { hexdec } from './converters/string.js'

export const getLuminance = (code: string): number =>
  (hexdec(code.substring(1, 3)) * 0.299 + hexdec(code.substring(3, 5)) * 0.587 + hexdec(code.substring(5, 7)) * 0.114) /
  2.55

export const isDarker = (code: string): boolean => getLuminance(`#${code}`.replace(/^#{2,}/, '#')) < 50
