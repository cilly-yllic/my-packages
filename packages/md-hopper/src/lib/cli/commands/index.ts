import { readdirSync } from 'fs'
import { join } from 'path'
import { getDirnameFromFileURL } from '~utils/path.js'

import { Command as Program } from 'commander'

import { setCommands } from '~utils/command.js'
import { isDirectory } from '~utils/fs.js'

const __dirname = getDirnameFromFileURL(import.meta.url)

const initCommand = async (filename: string, program: Program) => {
  const { COMMANDS, init, getSettings } = await import(`./${filename}/command.js`)

  setCommands(program, COMMANDS, init, getSettings)
}
export const init = async (program: Program) => {
  const list = readdirSync(join(__dirname))
  for (const dir of list) {
    if (!isDirectory(join(__dirname, dir))) {
      continue
    }
    await initCommand(dir, program)
  }
}
