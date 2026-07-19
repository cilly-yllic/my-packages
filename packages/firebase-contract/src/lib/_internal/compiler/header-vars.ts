/**
 * `${...}` template variables available in header text (contract `header:`,
 * per-generator `header`, CLI `--header`):
 *
 * - `${rootContractPath}`    — entry (root) yml, relative to the root yml's dir
 * - `${currentContractPath}` — the yml the output is generated from
 * - `${allContractPath}`     — import chain root → current, joined with ` -> `
 * - `${generatedAt}`         — date the file was first generated (kept stable)
 * - `${updatedAt}`           — date the content last changed (a regenerate that
 *                              produces identical content keeps both dates, so
 *                              `--check` stays drift-free)
 *
 * Date tokens accept an optional format: `${updatedAt:yyyy-mm-dd HH:mm:ss}`.
 * Format runs: `yyyy`/`yy` year, `MM` month, `dd` day, `HH` hour, `mm` month
 * before any hour token / minute after one (so both `yyyy-mm-dd` and `HH:mm`
 * read naturally), `ss` second. The default format is `yyyy-MM-dd`.
 *
 * Path variables are expanded before generators run; date variables survive
 * into the rendered content and are resolved per file against what is already
 * on disk (see {@link resolveDateTokens}).
 */

export interface HeaderPathVars {
  rootContractPath: string
  currentContractPath: string
  allContractPath: string
}

export const expandHeaderPathVars = (header: string, vars: HeaderPathVars): string =>
  header
    .replaceAll('${rootContractPath}', vars.rootContractPath)
    .replaceAll('${currentContractPath}', vars.currentContractPath)
    .replaceAll('${allContractPath}', vars.allContractPath)

export const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd'

const DATE_TOKEN_RE = /\$\{(generatedAt|updatedAt)(?::([^}]+))?\}/
const DATE_TOKEN_ALL_RE = /\$\{(generatedAt|updatedAt)(?::([^}]+))?\}/g
const FORMAT_RUN_RE = /y+|[Mm]+|[Dd]+|[Hh]+|s+/g

export const hasDateTokens = (content: string): boolean => DATE_TOKEN_RE.test(content)

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const pad = (value: number, width: number): string => String(value).padStart(width, '0')

/** Render `now` with a format string (see the module doc for the token set). */
export const formatDate = (format: string, now: Date): string => {
  let hourSeen = false
  let monthDone = false
  return format.replace(FORMAT_RUN_RE, run => {
    const char = run[0] as string
    const width = run.length
    if (char === 'y') {
      return width <= 2 ? String(now.getFullYear()).slice(-2) : pad(now.getFullYear(), width)
    }
    if (char === 'M' || char === 'm') {
      const isMonth = char === 'M' || (!monthDone && !hourSeen)
      if (isMonth) {
        monthDone = true
        return pad(now.getMonth() + 1, width)
      }
      return pad(now.getMinutes(), width)
    }
    if (char === 'D' || char === 'd') return pad(now.getDate(), width)
    if (char === 'H' || char === 'h') {
      hourSeen = true
      return pad(now.getHours(), width)
    }
    return pad(now.getSeconds(), width)
  })
}

/** Regex source matching any value rendered with `format` (digits per run, rest literal). */
const formatToPattern = (format: string): string => {
  let out = ''
  let last = 0
  for (const match of format.matchAll(FORMAT_RUN_RE)) {
    out += escapeRegExp(format.slice(last, match.index)) + String.raw`\d{${match[0].length}}`
    last = match.index + match[0].length
  }
  return out + escapeRegExp(format.slice(last))
}

/** Escaped-template → regex source with one capture per date token; records token order. */
const toDatePattern = (template: string, tokens: string[]): string => {
  let out = ''
  let last = 0
  for (const match of template.matchAll(DATE_TOKEN_ALL_RE)) {
    tokens.push(match[1] as string)
    out += escapeRegExp(template.slice(last, match.index)) + `(${formatToPattern(match[2] ?? DEFAULT_DATE_FORMAT)})`
    last = match.index + match[0].length
  }
  return out + escapeRegExp(template.slice(last))
}

/**
 * Resolve `${generatedAt}` / `${updatedAt}` in freshly rendered content against
 * the previously written file:
 *
 * - unchanged content (modulo the dates themselves) → both dates carried over
 * - changed or new content → `updatedAt` = now; `generatedAt` recovered from
 *   the existing file's matching header line when possible, else now
 */
export const resolveDateTokens = (content: string, existing: string | undefined, now: Date): string => {
  if (!hasDateTokens(content)) return content

  if (existing !== undefined) {
    const tokens: string[] = []
    const full = new RegExp(`^${toDatePattern(content, tokens)}$`)
    const match = existing.match(full)
    if (match) {
      let index = 0
      return content.replace(DATE_TOKEN_ALL_RE, () => match[++index] as string)
    }
  }

  let generatedAt: string | undefined
  if (existing !== undefined) {
    const generatedLine = content.split('\n').find(line => /\$\{generatedAt(?::[^}]+)?\}/.test(line))
    if (generatedLine !== undefined) {
      const lineTokens: string[] = []
      const lineMatch = existing.match(new RegExp(toDatePattern(generatedLine, lineTokens)))
      if (lineMatch) {
        generatedAt = lineMatch[lineTokens.indexOf('generatedAt') + 1]
      }
    }
  }
  return content.replace(DATE_TOKEN_ALL_RE, (_, name: string, format: string | undefined) => {
    if (name === 'generatedAt' && generatedAt !== undefined) return generatedAt
    return formatDate(format ?? DEFAULT_DATE_FORMAT, now)
  })
}
