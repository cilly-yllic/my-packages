export const ENVS = {
  PACKAGE_VERSION: 'PACKAGE_VERSION',
  IS_DEBUG: 'IS_DEBUG',
} as const
export type Env = (typeof ENVS)[keyof typeof ENVS]
