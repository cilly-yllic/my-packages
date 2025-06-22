import { RcSettings, Settings, RcSetting, Setting } from '~types/settings.js'

import { SETTING_FILE_NAME } from './configs.js'
import { getProjectRootPath } from './path.js'

export const DEFAULT_STORAGE: Setting = {
  doc: false,
  directoryPath: 'storage',
  main: 'storage.main.rules',
  output: 'storage.rules',
}

export const DEFAULTS: Settings = {
  firestore: {
    doc: false,
    directoryPath: 'firestore',
    main: 'firestore.main.rules',
    output: 'firestore.rules',
  },
  storage: [],
}

const getFirestore = (setting: RcSetting, defaults: Setting): Setting => ({
  doc: setting.doc || defaults.doc,
  directoryPath: setting.directoryPath || defaults.directoryPath,
  main: setting.main || defaults.main,
  output: setting.output || defaults.output,
})
export const parse = (settings: RcSettings): Settings => {
  return {
    firestore: getFirestore(settings.firestore || {}, DEFAULTS.firestore),
    storage: (settings.storage || []).map(storage => getFirestore(storage || {}, DEFAULT_STORAGE)),
  }
}

export const getSettings = async () => {
  const { default: settings } = await import(`${getProjectRootPath()}/${SETTING_FILE_NAME}`)
  return parse(settings)
}
