import { describe, expect, it } from 'vitest'

import { buildIr } from '../ir/build-ir.js'
import { Ir } from '../ir/ir.js'
import { parseContract } from '../parser/parse.js'

import { createTaskPayloadGenerator } from './api/task-payload-generator.js'

const SAMPLE = `
envelopes:
  RetryTaskPayload:
    fields:
      identifierId: string
      opId: string
      enqueuedAt: int
tasks:
  createCatalog:
    envelope: RetryTaskPayload
    maxAttempts: 3
    request:
      fields:
        uid: string
        catalogId: string
events:
  generateAiResponse:
    topic: ai-review-generate-response
    timeoutSeconds: 540
    request:
      fields:
        noteId: string
`

const irOf = (): Ir => buildIr([parseContract(SAMPLE, '/c.yml')]).ir

describe('F: cloud-products payload envelopes', () => {
  const content = (): string => createTaskPayloadGenerator().generate(irOf())[0].content

  it('emits the generic envelope type', () => {
    expect(content()).toContain('export type RetryTaskPayload<T> = T & {')
    expect(content()).toContain('  identifierId: string')
    expect(content()).toContain('  enqueuedAt: number')
  })

  it('emits TaskData + TaskPayload wrapped in the envelope', () => {
    const c = content()
    expect(c).toContain('export interface CreateCatalogTaskData {')
    expect(c).toContain('export type CreateCatalogTaskPayload = RetryTaskPayload<CreateCatalogTaskData>')
  })

  it('emits delivery constants', () => {
    const c = content()
    expect(c).toContain('export const CREATE_CATALOG_MAX_ATTEMPTS = 3')
    expect(c).toContain('export const GENERATE_AI_RESPONSE_TIMEOUT_SECONDS = 540')
    expect(c).toContain("export const GENERATE_AI_RESPONSE_TOPIC = 'ai-review-generate-response'")
  })

  it('leaves TaskPayload unwrapped when no envelope is set', () => {
    expect(content()).toContain('export type GenerateAiResponseTaskPayload = GenerateAiResponseTaskData')
  })
})
