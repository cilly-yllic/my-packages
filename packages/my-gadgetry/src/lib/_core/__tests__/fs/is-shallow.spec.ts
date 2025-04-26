import { isShallow } from '../../fs.js'
import { resolve } from 'path'

const path = resolve(__dirname, '../../../..', 'fs-test')

describe('isShallow', () => {
  it('depth: 1', () => {
    expect(isShallow(path, `${path}/foo`, 1)).toBeTruthy()
  })
  it('same path', () => {
    expect(isShallow(path, path, 0)).toBeTruthy()
  })
})
