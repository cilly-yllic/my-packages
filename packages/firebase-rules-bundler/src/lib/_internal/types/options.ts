import { AliasTypesKeys } from './bundle-type.js'

export interface BundleOptions {
  doc?: boolean
  only?: AliasTypesKeys
}

export interface HelpOptions {
  [key: string]: any
}

export interface DefaultOptions {
  [key: string]: any
}

export type Options<T extends DefaultOptions = DefaultOptions> = T
