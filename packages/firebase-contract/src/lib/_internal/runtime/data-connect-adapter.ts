/**
 * Runtime helpers for the Data Connect `Any` boundary.
 *
 * Data Connect stores JSON and embedded objects as the `Any` scalar, which
 * erases the logical type. Generated adapters call {@link fromAny}/{@link toAny}
 * to cross that boundary so application code keeps working with the logical
 * TypeScript type. These are intentionally minimal (typed pass-through) because
 * the Data Connect client already parses JSON; swap in {@link jsonStringAdapter}
 * when a value is stored as a raw JSON string instead.
 */

/** The type of a value once it has crossed into Data Connect's `Any` scalar. */
export type Any = unknown

export interface JsonAdapter<T> {
  toAny(value: T): Any
  fromAny(value: Any): T
}

/** Restore a logical value from an `Any` field (typed pass-through). */
export const fromAny = <T>(value: Any): T => value as T

/** Send a logical value into an `Any` field (typed pass-through). */
export const toAny = <T>(value: T): Any => value as Any

/** Adapter that trusts the client to have already parsed the JSON. */
export const identityAdapter = <T>(): JsonAdapter<T> => ({
  toAny: value => toAny(value),
  fromAny: value => fromAny<T>(value),
})

/** Adapter for `Any` fields stored/received as raw JSON strings. */
export const jsonStringAdapter = <T>(): JsonAdapter<T> => ({
  toAny: value => JSON.stringify(value),
  fromAny: value => (typeof value === 'string' ? (JSON.parse(value) as T) : (value as T)),
})
