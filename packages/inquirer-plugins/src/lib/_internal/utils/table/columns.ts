export const isValidColumnIndex = (index: number, maxIndex: number, disableIndexes: number[]) => {
  if (index > maxIndex || index < 0) {
    return false
  }
  if (disableIndexes.includes(index)) {
    return false
  }
  return true
}

const getNextIndex = (index: number, maxIndex: number, num: number) => {
  const nextIndex = index + num
  if (nextIndex > maxIndex) {
    return 0
  }
  if (nextIndex < 0) {
    return maxIndex
  }
  return nextIndex
}

export const getColumnIndex = (
  diff: number,
  currentIndex: number,
  maxIndex: number,
  disableColumnIndexes: number[] = []
) => {
  let index = currentIndex
  for (let i = 0; i <= maxIndex; i++) {
    index = getNextIndex(index, maxIndex, diff)
    if (isValidColumnIndex(index, maxIndex, disableColumnIndexes)) {
      break
    }
  }
  return index
}
