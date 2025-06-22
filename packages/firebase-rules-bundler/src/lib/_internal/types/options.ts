import { AliasTypesKeys } from './bundle-type.js'

export interface BundleOptions {
  doc?: boolean
  only?: AliasTypesKeys
}

export interface HelpOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface DefaultOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export type Options<T extends DefaultOptions = DefaultOptions> = T
