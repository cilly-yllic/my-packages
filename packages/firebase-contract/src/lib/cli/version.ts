import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Read the package version from package.json relative to the built CLI file. */
export const getVersion = (): string => {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    // dist/lib/cli/version.js -> package root is three levels up.
    const pkg = JSON.parse(readFileSync(join(here, '../../../package.json'), 'utf8')) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}
