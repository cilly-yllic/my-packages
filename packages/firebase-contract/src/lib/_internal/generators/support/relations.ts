import { idTypeOf, Ir, IrField, ScalarType } from '../../ir/ir.js'

/** A model-typed field that is a foreign-key relation (not an embedded value object). */
export const isRelation = (field: IrField): boolean => field.relation && field.type.kind === 'model'

/**
 * Foreign-key column name for a relation field. Data Connect stores a relation
 * `owner: User` as an `ownerId` column, so the entity/row/Firestore types expose
 * the id, matching how the value is actually persisted and projected.
 */
export const relationFkName = (field: IrField): string => `${field.name}Id`

/** Scalar type of a relation's foreign key (the related model's id type). */
export const relationFkType = (ir: Ir, field: IrField): ScalarType =>
  field.type.kind === 'model' ? idTypeOf(ir, field.type.name) : 'string'
