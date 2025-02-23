export const digits = (num: number | string, count = 2) => `${'0'.repeat(count)}${num}`.slice(-count)
