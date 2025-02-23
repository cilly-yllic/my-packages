export const getUnique = <T extends string | number>(list: T[]): T[] => [...new Set(list)]
export const chunk = <T = unknown>(list: T[], size: number): T[][] =>
  list.reduce(
    (acc: T[][], _: T, i: number, self: T[]) => (i % size ? acc : [...acc, self.slice(i, i + size)]),
    [] as T[][]
  ) as T[][]
