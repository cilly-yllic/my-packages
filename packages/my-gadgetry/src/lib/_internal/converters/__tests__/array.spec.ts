import { getUnique } from '../array.js'

describe('getUnique', () => {
  const list = [1, 2, 3, 1, 1, 1, 3, 100, 'foo', 'hoge', 1, 'foo']
  const expects = [1, 2, 3, 100, 'foo', 'hoge']
  it('should be equal', () => {
    expect(JSON.stringify(getUnique(list))).toBe(JSON.stringify(expects))
  })
})
