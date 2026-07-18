import { describe, expect, it } from 'vitest'

import { buildIr } from '../ir/build-ir.js'
import { Ir } from '../ir/ir.js'
import { parseContract } from '../parser/parse.js'

import { createApiDtoGenerator } from './api/api-dto-generator.js'
import { createApiValidationGenerator } from './api/api-validation-generator.js'
import { createTypeScriptGenerator } from './typescript/typescript-generator.js'
import { createZodGenerator } from './zod/zod-generator.js'

const SAMPLE = `
enums:
  ReviewKind:
    values: [USER, AI, SYSTEM]
models:
  Note:
    fields:
      id: { type: id, id: true }
      kind: ReviewKind
      title: { type: string, nonempty: true, maxLength: 200 }
      body: { type: string, maxLength: 10000 }
      score: { type: int, min: 0, max: 100 }
      email: { type: string, email: true }
      tags: { type: string, list: true, minLength: 1, maxLength: 10 }
apis:
  createNote:
    kind: https
    method: POST
    request:
      fields:
        title: { type: string, nonempty: true, maxLength: 200 }
        score: { type: int, min: 0, max: 100 }
    response:
      void: true
`

const irOf = (): Ir => buildIr([parseContract(SAMPLE, '/c.yml')]).ir

describe('A: enum single-source representation', () => {
  it('emits a frozen const object + Key type + value type by default', () => {
    const [file] = createTypeScriptGenerator().generate(irOf())
    expect(file.content).toContain('export const REVIEW_KIND = Object.freeze({')
    expect(file.content).toContain("  USER: 'USER',")
    expect(file.content).toContain('} as const)')
    expect(file.content).toContain('export type ReviewKindKey = keyof typeof REVIEW_KIND')
    expect(file.content).toContain('export type ReviewKind = (typeof REVIEW_KIND)[ReviewKindKey]')
  })

  it('still supports a plain union via enumStyle', () => {
    const [file] = createTypeScriptGenerator({ enumStyle: 'union' }).generate(irOf())
    expect(file.content).toContain("export type ReviewKind = 'USER' | 'AI' | 'SYSTEM'")
  })
})

describe('B: field constraints', () => {
  it('applies constraints in Zod schemas (value and array)', () => {
    const [file] = createZodGenerator().generate(irOf())
    expect(file.content).toContain('title: z.string().min(1).max(200),')
    expect(file.content).toContain('body: z.string().max(10000),')
    expect(file.content).toContain('score: z.number().int().min(0).max(100),')
    expect(file.content).toContain('email: z.string().email(),')
    expect(file.content).toContain('tags: z.array(z.string()).min(1).max(10),')
  })

  it('applies constraints in API request Zod schemas', () => {
    const [file] = createApiValidationGenerator().generate(irOf())
    expect(file.content).toContain('title: z.string().min(1).max(200),')
    expect(file.content).toContain('score: z.number().int().min(0).max(100),')
  })

  it('emits class-validator DTOs from API requests', () => {
    const [file] = createApiDtoGenerator().generate(irOf())
    expect(file.content).toContain("from 'class-validator'")
    expect(file.content).toContain('export class CreateNoteDto {')
    expect(file.content).toContain('@IsString()')
    expect(file.content).toContain('@IsNotEmpty()')
    expect(file.content).toContain('@MaxLength(200)')
    expect(file.content).toContain('@IsInt()')
    expect(file.content).toContain('@Min(0)')
    expect(file.content).toContain('@Max(100)')
    expect(file.content).toContain('title!: string')
    expect(file.content).toContain('score!: number')
  })
})
