/** Render a JSDoc block for a possibly multi-line description ('' when absent). */
export const jsdoc = (description: string | undefined, indent: string): string => {
  if (!description) return ''
  const lines = description.split('\n')
  if (lines.length === 1) return `${indent}/** ${lines[0]} */\n`
  return `${indent}/**\n${lines.map(line => `${indent} * ${line}`.trimEnd()).join('\n')}\n${indent} */\n`
}
