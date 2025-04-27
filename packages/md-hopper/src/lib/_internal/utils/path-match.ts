import { minimatch } from 'minimatch'

export const isMatch = (path: string, pattern: string) => minimatch(path, pattern)
