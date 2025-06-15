import { Inclusions } from '~types/inclusion-types.js'
import { KeyTypeConst, KeyType, Type } from '~types/key-type.js'

export const getLeftTypes = <C extends KeyTypeConst = KeyTypeConst>(
  types: Type<C>[],
  keyTypes: KeyType<C>,
  inclusions: Inclusions<C>
): Type<C>[] =>
  Object.values(keyTypes).filter(keyType => {
    // // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // // @ts-ignore
    // if (keyType in inclusions && inclusions[keyType].length > 0) {
    //   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //   // @ts-ignore
    //   return types.every(type => !inclusions[keyType].includes(type))
    // }
    const type = keyType in inclusions ? inclusions[keyType] : null
    if (!!type && type.length > 0) {
      return types.every(t => !type.includes(t))
    }
    return types.every(type => keyType !== type)
  })
