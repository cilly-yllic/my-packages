import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import { ActionArg } from '~types/command.js'
import { CommandOptions, MdSettings } from '~types/configs/links.js'
import { Detail, PathDepthClassify, PathInfo } from '~types/md.js'
import { getAllMdFiles } from '~utils/fs.js'
import { info, warn, success } from '~utils/log.js'
import { replace, getLinkedMdDetail } from '~utils/md.js'
import { getExclude, getInclude } from '~utils/minimatch.js'
import { getDepthType, DEPTH_TYPES, getExecDir, getParseDirPath } from '~utils/path.js'

const splitComma = (str: string | undefined, alternative: string[]) => (str ? str.split(',') : null) || alternative

type Arg = ActionArg<CommandOptions, MdSettings>

const mergeConfig = ({ options, settings }: Arg): MdSettings => {
  return {
    'skip-hidden':
      typeof options.skipHidden === 'undefined' ? settings['skip-hidden'] : JSON.parse(`${options.skipHidden}`),
    exclude: splitComma(options.exclude, settings.exclude),
    include: splitComma(options.include, settings.include),
    filenames: splitComma(options.filenames, settings.filenames),
    input: getParseDirPath(options.input || '.'),
    output: options.output || settings.output,
    depth: Number(options.depth) || settings.depth,
  }
}

const classify = (dataList: PathInfo[]) => {
  return dataList.reduce((mds: Detail[], data) => {
    const classifyList: PathDepthClassify = { children: [], grandchildren: [], parallels: [] }
    for (const { dir, path } of dataList) {
      if (data.path === path) {
        continue
      }
      switch (getDepthType(dir, data.dir)) {
        case DEPTH_TYPES.parallel:
          classifyList.parallels.push(path)
          break
        case DEPTH_TYPES.child:
          classifyList.children.push(path)
          break
        case DEPTH_TYPES.grandchild:
          classifyList.grandchildren.push(path)
          break
      }
    }
    mds.push({
      ...data,
      ...classifyList,
    })
    return mds
  }, [])
}

const getPathDetails = (paths: string[], config: MdSettings) => {
  const list: PathInfo[] = []
  for (const path of paths) {
    const md = readFileSync(path, 'utf-8')
    const dir = getParseDirPath(path)
    const detail = getLinkedMdDetail(md)
    const output = detail.output || config.output
    list.push({
      ...detail,
      path,
      dir,
      title: detail.title || path,
      output,
      outputPath: join(dir, output),
    })
  }
  return classify(list)
}

export const action = async (args: Arg) => {
  const isDebug = args.options.debug
  if (isDebug) {
    info('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
    info('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=- DEBUG MODE =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
    info('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  } else {
    warn('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
    warn('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=- PRODUCTION MODE =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
    warn('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  }
  const execDir = getExecDir()
  info('exec dir path', execDir)
  const config = mergeConfig(args)
  info('settings', JSON.stringify(config, null, 2))
  const targetDir = join(execDir, config.input)
  info('target dir', targetDir)
  const exclude = getExclude(targetDir, config.exclude, config['skip-hidden'])
  info('exclude', JSON.stringify(exclude, null, 2))
  const include = getInclude(targetDir, config.include)
  info('include', JSON.stringify(include, null, 2))
  const paths = getAllMdFiles(config.filenames, targetDir, {
    include,
    exclude,
    ...(config.depth >= 1 ? { depth: config.depth } : {}),
  })
  info('target paths', JSON.stringify(paths, null, 2))
  if (isDebug) {
    info('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
    info('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=- END OF DEBUG MODE =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
    info('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
    return
  }
  const pathDetails = getPathDetails(paths, config)
  for (const pathDetail of pathDetails) {
    if (pathDetail.lock) {
      continue
    }
    const content = replace(pathDetail, pathDetails)
    const output = pathDetail.output || config.output
    const writePath = output ? join(pathDetail.dir, output) : pathDetail.path
    success('write file: ', writePath)
    writeFileSync(writePath, content, 'utf-8')
  }
  success('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  success('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=- END OF PRODUCTION MODE =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  success('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
}
