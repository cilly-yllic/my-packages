import { Command as Program } from 'commander'

const initCommand = async (filename: string, program: Program) => {
  ;(await import(`./${filename}/command.js`)).init(program)
}
export const init = async (program: Program) => {
  await initCommand('bundle', program)
  await initCommand('help', program)
}
