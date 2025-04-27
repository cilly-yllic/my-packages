import { isBoolean as _isBoolean } from 'my-gadgetry/type-check'

export const isBoolean = (val: any, isAllowString = true) => {
  if (_isBoolean(val)) {
    return true
  }
  if (isAllowString) {
    return val === 'true' || val === 'false'
  }
  return false
}
