export interface CommandOptions {
  debug?: boolean
  skipHidden?: boolean
  include?: string
  exclude?: string
  filenames?: string
  input?: string
  output?: string
  depth?: string
}

export interface MdSettings {
  ['skip-hidden']: boolean
  include: string[]
  exclude: string[]
  filenames: string[]
  input: string
  output: string
  depth: number
}
