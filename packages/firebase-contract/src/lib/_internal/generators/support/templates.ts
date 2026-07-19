/** Shared output-settings resolution + placeholder expansion for generators. Pure functions only. */
import { GeneratedFile, GeneratorContext } from '../generator.js'
import { kebabCase } from './naming.js'

export const API_PLACEHOLDER_RE = /\{(api-name|path)\}/

/** Drop `{param}` segments from a REST path and join the rest (`/ai-models/{id}` → `ai-models`). */
export const pathSegments = (apiPath: string): string =>
  apiPath
    .split('/')
    .filter(segment => segment.length > 0 && !(segment.startsWith('{') && segment.endsWith('}')))
    .join('/')

/**
 * Expand `{api-name}` / `{path}` in an output template for one api. Returns
 * undefined when `{path}` is used but the api has no REST path.
 */
export const expandApiPlaceholders = (template: string, api: { name: string; path?: string }): string | undefined => {
  let out = template.replaceAll('{api-name}', kebabCase(api.name))
  if (out.includes('{path}')) {
    if (!api.path) return undefined
    out = out.replaceAll('{path}', pathSegments(api.path))
  }
  return out
}

/** Output settings after merging the compiler-resolved values over the generator's defaults. */
export interface ResolvedOutput {
  file: string
  split: boolean
  options: Record<string, string>
}

export const resolveOutput = (
  context: GeneratorContext | undefined,
  defaults: { file: string; split: boolean }
): ResolvedOutput => ({
  file: context?.output?.file ?? defaults.file,
  split: context?.output?.split ?? defaults.split,
  options: context?.output?.options ?? {},
})

/** `file` override for generators with a single (or barrel) output file. */
export const outputFile = (context: GeneratorContext | undefined, fallback: string): string =>
  context?.output?.file ?? fallback

/**
 * Materialize api-scoped output according to the resolved settings: `split`
 * emits one file per api (expanding `{api-name}`/`{path}` in `file`), otherwise
 * one bundled file named `file`. `render` returns the full content for the
 * given api subset, or undefined to emit nothing for it.
 */
export const emitApiFiles = <A extends { name: string; path?: string }>(
  apis: A[],
  output: ResolvedOutput,
  render: (subset: A[]) => string | undefined
): GeneratedFile[] => {
  if (!output.split) {
    const content = render(apis)
    return content === undefined ? [] : [{ path: output.file, content }]
  }
  const files: GeneratedFile[] = []
  for (const api of apis) {
    const content = render([api])
    if (content === undefined) continue
    const path = expandApiPlaceholders(output.file, api)
    if (path === undefined) continue
    files.push({ path, content })
  }
  return files
}
