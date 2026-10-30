import { isUrlString } from '../../type-check.js'

describe('isUrlString', () => {
  it('accepts urls', () => {
    for (const url of [
      'example.com',
      'https://sub.example.co.jp/path?q=1#x',
      'http://192.168.0.1:8080/a',
      'a-b.c-d.io',
    ]) {
      expect(isUrlString(url)).toBe(true)
    }
  })

  it('rejects non urls', () => {
    for (const url of ['-bad.com', 'bad-.com', 'localhost', 'x.y']) {
      expect(isUrlString(url)).toBe(false)
    }
  })

  it('does not backtrack catastrophically on hyphenated labels', () => {
    const start = Date.now()
    expect(isUrlString(`a${'-a'.repeat(30)}!`)).toBe(false)
    expect(Date.now() - start).toBeLessThan(100)
  })
})
