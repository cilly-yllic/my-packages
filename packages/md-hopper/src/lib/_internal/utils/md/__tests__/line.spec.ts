import { getSymbolAndText, getProperties, replaceLineToLink } from '../line.js'

const getSymbolAndTextExpect = (symbol: string, text: string) => {
  const raw = `${symbol}${text}`
  expect(JSON.stringify(getSymbolAndText({ raw, text }))).toBe(JSON.stringify({ symbol, text }))
}

const getPropertiesExpect = (indent: string, symbol: string, text: string) => {
  const raw = `${indent}${symbol}${text}`
  expect(JSON.stringify(getProperties(raw))).toBe(JSON.stringify({ indent, symbol, text }))
}

const replaceLineToLinkExpect = (indent: string, symbol: string, text: string, defineName: string) => {
  const raw = `${indent}${symbol}${text}`
  expect(replaceLineToLink(raw, defineName)).toBe(`${indent}${symbol}[${text}][${defineName}]`)
}

describe('line', () => {
  describe('getSymbolAndText', () => {
    const text = 'a'
    describe('list', () => {
      it('-', () => {
        const symbol = '- '
        getSymbolAndTextExpect(symbol, text)
      })
      it('+', () => {
        const symbol = '+ '
        getSymbolAndTextExpect(symbol, text)
      })
      it('*', () => {
        const symbol = '* '
        getSymbolAndTextExpect(symbol, text)
      })
      it('1.', () => {
        const symbol = '1. '
        getSymbolAndTextExpect(symbol, text)
      })
      it('- [ ]', () => {
        const symbol = '- [ ] '
        getSymbolAndTextExpect(symbol, text)
      })
      it('- [x]', () => {
        const symbol = '- [x] '
        getSymbolAndTextExpect(symbol, text)
      })
    })
    describe('heading', () => {
      it('#', () => {
        const symbol = '# '
        getSymbolAndTextExpect(symbol, text)
      })
      it('##', () => {
        const symbol = '## '
        getSymbolAndTextExpect(symbol, text)
      })
    })
  })
  describe('getProperties', () => {
    const text = 'a'
    const indent = ' '
    describe('list', () => {
      it('-', () => {
        const symbol = '- '
        getPropertiesExpect(indent, symbol, text)
      })
      it('+', () => {
        const symbol = '+ '
        getPropertiesExpect(indent, symbol, text)
      })
      it('*', () => {
        const symbol = '* '
        getPropertiesExpect(indent, symbol, text)
      })
      it('1.', () => {
        const symbol = '1. '
        getPropertiesExpect(indent, symbol, text)
      })
      it('- [ ]', () => {
        const symbol = '- [ ] '
        getPropertiesExpect(indent, symbol, text)
      })
      it('- [x]', () => {
        const symbol = '- [x] '
        getPropertiesExpect(indent, symbol, text)
      })
    })
    describe('heading', () => {
      it('#', () => {
        const symbol = '# '
        getPropertiesExpect(indent, symbol, text)
      })
      it('##', () => {
        const symbol = '## '
        getPropertiesExpect(indent, symbol, text)
      })
    })
  })

  describe('replaceLineToLink', () => {
    const indent = ' '
    const text = 'a'
    const defineName = 'md-hopper'
    describe('list', () => {
      it('-', () => {
        const symbol = '- '
        replaceLineToLinkExpect(indent, symbol, text, defineName)
      })
      it('+', () => {
        const symbol = '+ '
        replaceLineToLinkExpect(indent, symbol, text, defineName)
      })
      it('*', () => {
        const symbol = '* '
        replaceLineToLinkExpect(indent, symbol, text, defineName)
      })
      it('1.', () => {
        const symbol = '1. '
        replaceLineToLinkExpect(indent, symbol, text, defineName)
      })
      it('- [ ]', () => {
        const symbol = '- [ ] '
        replaceLineToLinkExpect(indent, symbol, text, defineName)
      })
      it('- [x]', () => {
        const symbol = '- [x] '
        replaceLineToLinkExpect(indent, symbol, text, defineName)
      })
    })
    describe('heading', () => {
      it('#', () => {
        const symbol = '# '
        replaceLineToLinkExpect(indent, symbol, text, defineName)
      })
      it('##', () => {
        const symbol = '## '
        replaceLineToLinkExpect(indent, symbol, text, defineName)
      })
    })
  })
})
