import { COMMENT_REG_EXP, getParamExp } from '../md.js'

const removeComments = (txt: string) => txt.replace(COMMENT_REG_EXP, '')

describe('COMMENT_REG_EXP', () => {
  it('removes comments', () => {
    expect(removeComments('a<!-- x -->b')).toBe('ab')
    expect(removeComments('a<!--\nx\n-->b<!-- y -->c')).toBe('abc')
  })

  it('treats --!> as the end of a comment', () => {
    expect(removeComments('a<!-- x --!>b')).toBe('ab')
  })
})

describe('getParamExp', () => {
  it('matches md-hopper params closed by --> or --!>', () => {
    for (const end of ['-->', '--!>']) {
      const txt = `a<!-- MD_HOPPER: ID: x ${end}\nb`
      expect(txt.replace(getParamExp('ID'), '')).toBe('ab')
    }
  })
})
