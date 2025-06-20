export type Action = (...args: any[]) => any

export interface BeforeFunction {
  fn: Action

  args: any[]
}

export interface ActionArg<CommandOptions extends Record<string, any>, MdSettings extends Record<string, any>> {
  options: CommandOptions
  settings: MdSettings
}
