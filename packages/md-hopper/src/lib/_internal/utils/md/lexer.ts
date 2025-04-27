import { marked } from 'marked'

export const lexer = (txt: string) => {
  const tokens = marked.lexer(txt)
  return tokens[0]
}
