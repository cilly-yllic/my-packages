import { findModel, Ir, IrModel } from '../../ir/ir.js'
import { pluralize, snakeCase } from './naming.js'
import { isRelation } from './relations.js'

/** Whether a model is a real table (vs an embedded value object). */
export const isTable = (model: IrModel): boolean => model.key.length > 0 || model.fields.some(f => f.isId)

export const tableNameOf = (model: IrModel): string => model.table ?? pluralize(snakeCase(model.name))

export const kebabCase = (value: string): string => snakeCase(value).replace(/_/g, '-')

/** Direct enum/embedded-model dependencies of a model (relations excluded). */
const directDeps = (model: IrModel): { enums: string[]; models: string[] } => {
  const enums: string[] = []
  const models: string[] = []
  for (const field of model.fields) {
    if (field.type.kind === 'enum') enums.push(field.type.name)
    else if (field.type.kind === 'model' && !isRelation(field)) models.push(field.type.name)
  }
  return { enums, models }
}

export interface HostedDeps {
  /** Enum names in first-reference order. */
  enums: string[]
  /** Embedded model names in dependency (topological) order. */
  models: string[]
}

/**
 * Transitive enum/embedded-model dependencies of `roots`, in stable order:
 * enums by first reference, embedded models dependencies-first so their
 * declarations can be emitted top-down without forward references.
 */
export const collectDeps = (ir: Ir, roots: IrModel[]): HostedDeps => {
  const enums: string[] = []
  const models: string[] = []
  const seenEnums = new Set<string>()
  const seenModels = new Set<string>()
  const visit = (model: IrModel): void => {
    const deps = directDeps(model)
    for (const name of deps.models) {
      if (seenModels.has(name)) continue
      seenModels.add(name)
      const embedded = findModel(ir, name)
      if (embedded) visit(embedded) // dependencies of the dependency come first
      models.push(name)
    }
    for (const name of deps.enums) {
      if (!seenEnums.has(name)) {
        seenEnums.add(name)
        enums.push(name)
      }
    }
  }
  for (const root of roots) visit(root)
  return { enums, models }
}

/**
 * Assign a unique module basename to every table. Two models may share a
 * physical table name across services (e.g. both declare
 * `reconciliation_operations`); the first keeps the table-derived name and
 * later ones fall back to their model name so files never overwrite each other.
 */
export const assignModuleNames = (tables: IrModel[]): Map<string, string> => {
  const used = new Set<string>()
  const names = new Map<string, string>()
  for (const table of tables) {
    let name = kebabCase(tableNameOf(table))
    if (used.has(name)) name = kebabCase(pluralize(snakeCase(table.name)))
    let candidate = name
    let suffix = 2
    while (used.has(candidate)) candidate = `${name}-${suffix++}`
    used.add(candidate)
    names.set(table.name, candidate)
  }
  return names
}

export interface SplitGroups {
  tables: IrModel[]
  /** enum name → hosting table model name */
  enumHome: Map<string, string>
  /** embedded model name → hosting table model name */
  modelHome: Map<string, string>
  /** Enums referenced by no table (api-only etc.). */
  leftoverEnums: string[]
  /** Embedded models referenced by no table. */
  leftoverModels: string[]
}

/**
 * Assign every enum and embedded model to the first table model that
 * (transitively) references it; the rest become shared leftovers.
 */
export const splitGroups = (ir: Ir): SplitGroups => {
  const tables = ir.models.filter(isTable)
  const enumHome = new Map<string, string>()
  const modelHome = new Map<string, string>()
  for (const table of tables) {
    const deps = collectDeps(ir, [table])
    for (const name of deps.enums) if (!enumHome.has(name)) enumHome.set(name, table.name)
    for (const name of deps.models) if (!modelHome.has(name)) modelHome.set(name, table.name)
  }
  const leftoverEnums = ir.enums.map(e => e.name).filter(name => !enumHome.has(name))
  const leftoverModels = ir.models
    .filter(model => !isTable(model))
    .map(model => model.name)
    .filter(name => !modelHome.has(name))
  return { tables, enumHome, modelHome, leftoverEnums, leftoverModels }
}
