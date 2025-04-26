import { Key } from 'readline'

export const getKeypressValue = (key: Key) => {
  switch (key.name) {
    case 'escape':
    case 'delete':
    case 'backspace':
    case 'down':
    case 'up':
    case 'left':
    case 'right':
      return ''
    default:
      return key.sequence || ''
  }
}

export const getBackspaceText = (str: string) => {
  if (!str) {
    return ''
  }
  return str.slice(0, -1)
}

export const isUpKey = (key: Key) => key.name === 'up'
export const isDownKey = (key: Key) => key.name === 'down'
export const isLeftKey = (key: Key) => key.name === 'left'
export const isRightKey = (key: Key) => key.name === 'right'
export const isEscapeKey = (key: Key) => key.name === 'escape'
export const isSpaceKey = (key: Key) => key.name === 'space'
export const isDeleteKey = (key: Key) => key.name === 'delete'
export const isBackspaceKey = (key: Key) => key.name === 'backspace'
