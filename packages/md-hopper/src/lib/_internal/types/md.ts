export const PROPERTIES = {
  CONFIG: 'CONFIG',
  LINK_NEXT_LINE: 'LINK_NEXT_LINE',
  BEGIN_LINKS: 'BEGIN_LINKS',
  END_LINKS: 'END_LINKS',
  BEGIN_DEFINE_LINKS: 'BEGIN_DEFINE_LINKS',
  END_DEFINE_LINKS: 'END_DEFINE_LINKS',
  BEFORE_GENERATE_LINK: 'BEFORE_GENERATE_LINK',
}

export interface MdAttributes {
  id: string
  lock: boolean
  title: string
  output: string
}

export interface PathInfo extends MdAttributes {
  path: string
  dir: string
  outputPath: string
}

export interface PathDepthClassify {
  children: string[]
  grandchildren: string[]
  parallels: string[]
}

export interface Detail extends PathInfo, PathDepthClassify {}

export interface LinkNextLineProperties {
  id: string
  inline: true
}

export interface EndLinksProperties {
  all: boolean
  linked: boolean
  child: boolean
  grandChild: boolean
  parallel: boolean
}

export const LINK_NAME_PREFIX = 'md_hopper:'
export const BEGIN_COMMENT = '<!--'
export const END_COMMENT = '-->'
export const PARAM_SEPARATOR = ':'
export const MD_HOPPER_COMMENT_PREFIX = 'MD_HOPPER'
export const COMMENT_REG_EXP = new RegExp(`${BEGIN_COMMENT}\\s*.*?${END_COMMENT}`, 'gs')
export const BRAKE_LINE_REG_EXP = new RegExp(/\r?\n/, 'g')
export const LINK_REG_EXP = new RegExp('^(\\s*.*)\\[(.+)][(|\\[](.+)[)|\\]].*')
export const MD_HOPPER_COMMENT_PREFIX_REG_EXP = new RegExp(
  `${BEGIN_COMMENT}\\s*${MD_HOPPER_COMMENT_PREFIX}${PARAM_SEPARATOR}\\s*`
)
export const MD_HOPPER_PARAMS_REG_EXP = new RegExp(
  `^[^${PARAM_SEPARATOR}]+${PARAM_SEPARATOR}(.*?)${END_COMMENT}.*`,
  's'
)
export const MD_HOPPER_CONTENT_REG_EXP = new RegExp(
  `^[^${PARAM_SEPARATOR}]+${PARAM_SEPARATOR}.*${END_COMMENT}(.*)`,
  's'
)
export const MD_HOPPER_PROPERTY_REG_EXP = new RegExp(`^([^${PARAM_SEPARATOR}]+?)${PARAM_SEPARATOR}.*`, 's')
export const getParamExp = (param: string) =>
  new RegExp(
    `${BEGIN_COMMENT}\\s*${MD_HOPPER_COMMENT_PREFIX}\\s*${PARAM_SEPARATOR}\\s*${param}\\s*${PARAM_SEPARATOR}.*?${END_COMMENT}\\n*`,
    'gs'
  )
