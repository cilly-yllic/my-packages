import { getDepth } from '../../fs.js'

describe('getDepth', () => {
  describe('shallow', () => {
    it('root', () => {
      expect(getDepth('hoge')).toBe(1)
    })
    it('/', () => {
      expect(getDepth('hoge')).toBe(1)
    })
    it('.', () => {
      expect(getDepth('./hoge')).toBe(1)
    })
    it('..', () => {
      expect(getDepth('../hoge')).toBe(0)
    })
  })
  describe('deep', () => {
    it('root', () => {
      expect(getDepth('hoge/foo')).toBe(2)
    })
    it('/', () => {
      expect(getDepth('foo/hoge')).toBe(2)
    })
    it('.', () => {
      expect(getDepth('./foo/hoge')).toBe(2)
    })
    it('..', () => {
      expect(getDepth('../foo/hoge')).toBe(1)
    })
  })
  describe('deep/filename', () => {
    it('root', () => {
      expect(getDepth('hoge/foo/piyo.js')).toBe(3)
    })
    it('/', () => {
      expect(getDepth('foo/hoge/piyo.js')).toBe(3)
    })
    it('.', () => {
      expect(getDepth('./foo/hoge/piyo.js')).toBe(3)
    })
    it('..', () => {
      expect(getDepth('../foo/hoge/piyo.js')).toBe(2)
    })
  })
})
