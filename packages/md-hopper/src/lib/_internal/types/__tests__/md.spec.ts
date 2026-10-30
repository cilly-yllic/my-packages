import { COMMENT_REG_EXP, MD_HOPPER_CONTENT_REG_EXP, getParamExp } from '../md.js'

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

describe('MD_HOPPER_CONTENT_REG_EXP', () => {
  it('keeps content after the first comment end, even if it contains --> or --!>', () => {
    // セクションは `<!-- MD_HOPPER: ` で分割された後の文字列
    const section = 'LINK_NEXT_LINE: id: missing -->\nKeep this paragraph.\nLiteral --!>\nLiteral -->\nTail'
    expect(section.replace(MD_HOPPER_CONTENT_REG_EXP, '$1')).toBe(
      '\nKeep this paragraph.\nLiteral --!>\nLiteral -->\nTail'
    )
  })
})
