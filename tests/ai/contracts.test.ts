import { describe, it, expect } from 'vitest'
import {
  AiGenerationRequestSchema,
  CredentialSetRequestSchema,
  CredentialDeleteRequestSchema,
  CredentialTestRequestSchema,
  UserAiPreferencesSchema,
  ModelRefreshRequestSchema
} from '../../src/shared/ai/contracts'

describe('AI Provider Contracts & Runtime Schemas', () => {
  it('validates a correct AiGenerationRequest payload', () => {
    const valid = {
      provider: 'google-gemini',
      model: 'gemini-3.8-flash',
      messages: [{ role: 'user', content: 'What is the speed of light?' }],
      temperature: 0.5,
      maxTokens: 500,
      stream: true
    }

    const result = AiGenerationRequestSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects AiGenerationRequest with empty messages array or unapproved provider', () => {
    const emptyMessages = {
      provider: 'google-gemini',
      messages: []
    }
    expect(AiGenerationRequestSchema.safeParse(emptyMessages).success).toBe(false)

    const unapprovedProvider = {
      provider: 'unapproved-llm-cloud',
      messages: [{ role: 'user', content: 'hi' }]
    }
    expect(AiGenerationRequestSchema.safeParse(unapprovedProvider).success).toBe(false)
  })

  it('validates CredentialSetRequestSchema and rejects empty key', () => {
    expect(
      CredentialSetRequestSchema.safeParse({
        provider: 'google-gemini',
        apiKey: 'AIzaSyTest12345'
      }).success
    ).toBe(true)

    expect(
      CredentialSetRequestSchema.safeParse({
        provider: 'google-gemini',
        apiKey: ''
      }).success
    ).toBe(false)
  })

  it('validates CredentialDeleteRequestSchema and CredentialTestRequestSchema', () => {
    expect(
      CredentialDeleteRequestSchema.safeParse({ provider: 'openai' }).success
    ).toBe(true)
    expect(
      CredentialTestRequestSchema.safeParse({ provider: 'google-gemini' }).success
    ).toBe(true)
    expect(
      CredentialTestRequestSchema.safeParse({ provider: 'invalid-provider' }).success
    ).toBe(false)
  })

  it('validates UserAiPreferencesSchema and rejects out-of-range values', () => {
    const valid = {
      activeProvider: 'google-gemini',
      activeModel: 'gemini-3.8-flash',
      temperature: 0.7,
      stream: true
    }
    expect(UserAiPreferencesSchema.safeParse(valid).success).toBe(true)

    const invalidTemp = {
      activeProvider: 'google-gemini',
      activeModel: 'gemini-3.8-flash',
      temperature: 3.5, // max is 2
      stream: true
    }
    expect(UserAiPreferencesSchema.safeParse(invalidTemp).success).toBe(false)

    const emptyModel = {
      activeProvider: 'openai',
      activeModel: '',
      stream: false
    }
    expect(UserAiPreferencesSchema.safeParse(emptyModel).success).toBe(false)
  })

  it('validates ModelRefreshRequestSchema', () => {
    expect(ModelRefreshRequestSchema.safeParse({ provider: 'google-gemini' }).success).toBe(true)
    expect(ModelRefreshRequestSchema.safeParse({ provider: 'openai' }).success).toBe(true)
    expect(ModelRefreshRequestSchema.safeParse({ provider: 'anthropic' }).success).toBe(false)
  })

  it('validates routing preferences in UserAiPreferencesSchema', () => {
    const validWithRouting = {
      activeProvider: 'google-gemini',
      activeModel: 'gemini-2.5-flash',
      temperature: 0.7,
      stream: true,
      routingMode: 'task-based',
      allowSameProviderFallback: true,
      allowCrossProviderFallback: false
    }
    expect(UserAiPreferencesSchema.safeParse(validWithRouting).success).toBe(true)

    const invalidRoutingMode = {
      ...validWithRouting,
      routingMode: 'uncontrolled-autonomous'
    }
    expect(UserAiPreferencesSchema.safeParse(invalidRoutingMode).success).toBe(false)
  })

  it('validates taskType in AiGenerationRequestSchema', () => {
    const validWithTask = {
      provider: 'google-gemini',
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'Extract entities' }],
      taskType: 'structured-extraction'
    }
    expect(AiGenerationRequestSchema.safeParse(validWithTask).success).toBe(true)

    const invalidTask = {
      ...validWithTask,
      taskType: 'unsupported-arbitrary-task'
    }
    expect(AiGenerationRequestSchema.safeParse(invalidTask).success).toBe(false)
  })
})
