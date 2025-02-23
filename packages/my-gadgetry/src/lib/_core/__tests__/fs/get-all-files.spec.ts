import { resolve, join } from 'path'
import { getAllFiles } from '../../fs.js'

describe('getAllFiles', () => {
  const path = resolve(__dirname, '../../../..', 'fs-test')
  it('no exclude & include', () => {
    const exclude: string[] = []
    const include: string[] = []
    const expects = [
      join(path, 'foo/piyo/index.ts'),
      join(path, 'foo/piyo.ts'),
      join(path, 'foo.ts'),
      join(path, 'hoge/foo/piyo/index.ts'),
      join(path, 'hoge/foo/piyo.ts'),
      join(path, 'hoge/foo.ts'),
      join(path, 'hoge.ts'),
    ]
    expect(JSON.stringify(getAllFiles(path, { include, exclude }))).toBe(JSON.stringify(expects))
  })
  describe('set exclude', () => {
    it('filename', () => {
      const exclude: string[] = ['**/index.ts']
      const include: string[] = []
      const expects = [
        join(path, 'foo/piyo.ts'),
        join(path, 'foo.ts'),
        join(path, 'hoge/foo/piyo.ts'),
        join(path, 'hoge/foo.ts'),
        join(path, 'hoge.ts'),
      ]
      expect(JSON.stringify(getAllFiles(path, { include, exclude }))).toBe(JSON.stringify(expects))
    })
    it('dirname', () => {
      const exclude: string[] = ['**/piyo/**/*']
      const include: string[] = []
      const expects = [
        join(path, 'foo/piyo.ts'),
        join(path, 'foo.ts'),
        join(path, 'hoge/foo/piyo.ts'),
        join(path, 'hoge/foo.ts'),
        join(path, 'hoge.ts'),
      ]
      expect(JSON.stringify(getAllFiles(path, { include, exclude }))).toBe(JSON.stringify(expects))
    })
  })
  describe('set include', () => {
    it('filename', () => {
      const exclude: string[] = []
      const include: string[] = ['**/index.ts']
      const expects = [join(path, 'foo/piyo/index.ts'), join(path, 'hoge/foo/piyo/index.ts')]
      expect(JSON.stringify(getAllFiles(path, { include, exclude }))).toBe(JSON.stringify(expects))
    })
    it('dirname', () => {
      const exclude: string[] = []
      const include: string[] = ['**/foo/**/*']
      const expects = [
        join(path, 'foo/piyo/index.ts'),
        join(path, 'foo/piyo.ts'),
        join(path, 'hoge/foo/piyo/index.ts'),
        join(path, 'hoge/foo/piyo.ts'),
      ]
      expect(JSON.stringify(getAllFiles(path, { include, exclude }))).toBe(JSON.stringify(expects))
    })
  })
  describe('set include & exclude', () => {
    it('filename & dirname', () => {
      const exclude: string[] = ['**/p*.ts']
      const include: string[] = ['**/foo/**/*']
      const expects = [join(path, 'foo/piyo/index.ts'), join(path, 'hoge/foo/piyo/index.ts')]
      expect(JSON.stringify(getAllFiles(path, { include, exclude }))).toBe(JSON.stringify(expects))
    })
  })
  describe('set depth', () => {
    it('1', () => {
      const exclude: string[] = []
      const include: string[] = []
      const depth = 1
      const expects = [join(path, 'foo.ts'), join(path, 'hoge.ts')]
      expect(JSON.stringify(getAllFiles(path, { include, exclude, depth }))).toBe(JSON.stringify(expects))
    })
    it('0: toThrow', () => {
      const exclude: string[] = []
      const include: string[] = []
      const depth = 0
      expect(() => getAllFiles(join(path, 'foo'), { include, exclude, depth })).toThrow(
        'Invalid depth, must be greater than 0'
      )
    })
  })
})
