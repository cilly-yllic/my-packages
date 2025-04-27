// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Action = (...args: any[]) => any

export interface BeforeFunction {
  fn: Action
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[]
}

export interface ActionArg<CommandOptions extends Record<string, any>, MdSettings extends Record<string, any>> {
  options: CommandOptions
  settings: MdSettings
}
