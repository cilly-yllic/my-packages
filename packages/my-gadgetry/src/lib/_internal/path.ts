import { dirname } from 'path'
import { fileURLToPath } from 'url'

export const getDirnameFromFileURL = (url: string) => dirname(fileURLToPath(url))
