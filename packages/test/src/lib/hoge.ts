import { isBoolean } from 'my-gadgetry/type-check'

export const hoge = () => {
  console.log('hoge', isBoolean('hoge'))
}