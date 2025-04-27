import { Token as _Token, Tokens } from 'marked'

import { lexer } from './lexer.js'

type TokenTypes = {
  [type in _Token['type']]: _Token['type']
}

const TOKEN_TYPES: TokenTypes = {
  list: 'list',
  heading: 'heading',
}

type Token = Tokens.ListItem | Tokens.Heading

interface SymbolEl {
  raw: Token['raw']
  text: Token['text']
}

export const getSymbolAndText = ({ raw, text }: SymbolEl) => {
  return {
    symbol: raw.replace(new RegExp(`${text}$`), ''),
    text,
  }
}

export const getElements = (txt: string) => {
  const indent = txt.replace(/^(\s*)(.*)$/, '$1')
  const str = txt.replace(/^(\s*)(.*)$/, '$2')
  const token = lexer(str)
  return {
    indent,
    str,
    token,
  }
}

export const getProperties = (txt: string) => {
  const { indent, token } = getElements(txt)
  let symbol = ''
  let text = ''
  switch (token.type) {
    case TOKEN_TYPES.list: {
      const symbolAndText = getSymbolAndText((token as Tokens.List).items[0])
      symbol = symbolAndText.symbol
      text = symbolAndText.text
      break
    }
    case TOKEN_TYPES.heading: {
      const symbolAndText = getSymbolAndText(token as Tokens.Heading)
      symbol = symbolAndText.symbol
      text = symbolAndText.text
      break
    }
    default:
      return null
  }

  return { indent, symbol, text }
}

export const replaceLineToLink = (txt: string, defineName: string) => {
  const properties = getProperties(txt)
  if (!properties) {
    return `[${txt}][${defineName}]`
  }
  const { indent, symbol, text } = properties
  return `${indent}${symbol}[${text}][${defineName}]`
}
