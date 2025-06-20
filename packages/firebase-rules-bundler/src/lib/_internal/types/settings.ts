export interface Setting {
  doc: boolean
  directoryPath: string
  main: string
  output: string
}
export interface Settings<T = Setting> {
  firestore: T
  storage: T[]
}

export type RcSetting = Partial<Setting>
export type RcSettings = Partial<Settings<RcSetting>>
