import { join } from 'path'

import { writeJsonSync } from 'fs-extra/esm'

import { cleanDirectory } from './clean-directories.js'

export const writePackageJson = (
  prefix: string,
  author: string,
  name: string,
  outputDir: string,
  aliases: string[],
  ignoreDirectory = ''
) => {
  for (const alias of aliases) {
    const splits = alias.split(/\//g)
    const outputPaths = splits.filter(dir => dir !== ignoreDirectory)
    const relative = outputPaths.map(() => '..').join('/')
    const outputPath = outputPaths.join('/')
    const pkgManifest = {
      name: `${author}/${[name, ...splits].join('-')}`,
      types: `${relative}/${outputDir}/${alias}.d.ts`,
      main: `${relative}/${outputDir}/${alias}.js`,
      sideEffects: false,
    }
    cleanDirectory(prefix, outputPath)
    writeJsonSync(join(prefix, outputPath, 'package.json'), pkgManifest, { spaces: 2 })
  }
}
