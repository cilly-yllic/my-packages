import { Ir, IrModel } from '../../ir/ir.js'
import { pluralize, snakeCase } from '../support/naming.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerBlocks } from '../support/header.js'
import { outputFile } from '../support/templates.js'

const tableName = (model: IrModel): string => model.table ?? pluralize(snakeCase(model.name))

/**
 * Postgres has no `ADD CONSTRAINT IF NOT EXISTS`, so constraint statements are
 * wrapped in a DO block that swallows `duplicate_object` — rerunning the whole
 * file against an already-migrated database is a no-op.
 */
const guarded = (statement: string): string =>
  ['DO $$ BEGIN', `  ${statement}`, 'EXCEPTION WHEN duplicate_object THEN NULL;', 'END $$;'].join('\n')

const renderModelSql = (model: IrModel): string[] => {
  const sql = model.sql
  if (!sql) return []
  const table = tableName(model)
  const statements: string[] = []

  sql.checks.forEach((expr, i) => {
    const name = `${table}_chk_${i + 1}`
    statements.push(guarded(`ALTER TABLE "${table}" ADD CONSTRAINT "${name}" CHECK (${expr});`))
  })

  for (const fk of sql.foreignKeys) {
    const name = fk.name ?? `${table}_${fk.columns.join('_')}_fkey`
    const cols = fk.columns.map(c => `"${c}"`).join(', ')
    statements.push(
      guarded(`ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY (${cols}) REFERENCES ${fk.references};`)
    )
  }

  for (const idx of sql.indexes) {
    const name = idx.name ?? `${table}_${idx.columns.join('_')}_${idx.unique ? 'uidx' : 'idx'}`
    const cols = idx.columns.map(c => `"${c}"`).join(', ')
    statements.push(`CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${name}" ON "${table}" (${cols});`)
  }

  return statements.length > 0 ? [`-- ${model.name} (${table})`, ...statements] : []
}

/**
 * Generates raw SQL migrations for constraints Data Connect cannot express:
 * composite foreign keys, CHECK constraints, and extra indexes — constraints
 * that otherwise live only as hand-written schema comments with no executable
 * artifact. Every statement is idempotent (`IF NOT EXISTS` / duplicate_object
 * guard), so the whole file can be (re)applied to any environment safely.
 */
export const createSqlMigrationGenerator = (): Generator => ({
  name: 'sql-migrations',
  description: 'Raw SQL migrations for composite FK / CHECK / index constraints',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    const blocks = ir.models.flatMap(renderModelSql)
    if (blocks.length === 0) {
      return []
    }
    const banner = headerBlocks(context, header => header.replace(/^\/\/ ?/gm, '-- '))
    const content = `${[...banner, blocks.join('\n')].join('\n\n')}\n`
    return [{ path: outputFile(context, 'migrations/constraints.sql'), content }]
  },
})
