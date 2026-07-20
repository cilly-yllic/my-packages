import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const CONFIG_FILENAME = 'firebase-contract.json'

export interface FbcConfig {
  entry?: string
}

/**
 * Load `firebase-contract.json` from `cwd` if present. CLI flags override these
 * values; the config only supplies defaults so common invocations stay short.
 * Deliberately only `entry`: a config-side outDir/generators used to flip
 * `fbc generate` into single-target mode, silently ignoring every `generators:`
 * declaration in the contract graph — output routing belongs in the yml.
 */
export const loadConfig = (cwd: string = process.cwd()): FbcConfig => {
  const path = resolve(cwd, CONFIG_FILENAME)
  if (!existsSync(path)) {
    return {}
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as FbcConfig
    return parsed ?? {}
  } catch {
    return {}
  }
}
