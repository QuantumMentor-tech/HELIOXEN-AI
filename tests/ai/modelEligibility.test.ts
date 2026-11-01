import { describe, it, expect } from 'vitest'
import { ModelEligibilityService } from '../../src/main/ai/ModelEligibilityService'
import { ModelDefinition } from '../../src/shared/ai/models'
import { TASK_DEFINITIONS } from '../../src/shared/ai/routing'

describe('ModelEligibilityService (Capability-Aware Selection & Boundaries)', () => {
  const eligibilityService = new ModelEligibilityService()

  const validFlashModel: ModelDefinition = {
    id: 'gemini-2.5-flash',
    providerId: 'google-gemini',
    displayName: 'Gemini 2.5 Flash',
    description: 'Fast, high-throughput model.',
    isDefault: true,
    source: 'curated',
    status: 'active',
    lastVerified: Date.now(),
    capabilities: {
      tier: 'balanced',
      contextWindow: 1048576,
      maxOutputTokens: 8192,
      modelLevel: {
        textGeneration: 'supported',
        streaming: 'supported',
        imageInput: 'supported',
        audioInput: 'supported',
        audioOutput: 'supported',
        toolCalling: 'supported',
        structuredOutput: 'supported'
      },
      helioxenLevel: {
        textGeneration: 'supported',
        streaming: 'supported',
        imageInput: 'unsupported',
        audioInput: 'unsupported',
        audioOutput: 'unsupported',
        toolCalling: 'unsupported',
        structuredOutput: 'supported'
      }
    }
  }

  it('marks a valid model with supported capabilities and valid credentials as eligible', () => {
    const task = TASK_DEFINITIONS.conversation
    const result = eligibilityService.evaluateModel(task, validFlashModel, {
      hasCredential: true,
      isProviderHealthy: true
    })

    expect(result.isEligible).toBe(true)
    expect(result.rejectionReason).toBeUndefined()
  })

  it('rejects a model when provider credential is missing', () => {
    const task = TASK_DEFINITIONS.conversation
    const result = eligibilityService.evaluateModel(task, validFlashModel, {
      hasCredential: false,
      isProviderHealthy: true
    })

    expect(result.isEligible).toBe(false)
    expect(result.rejectionReason).toBe('MISSING_CREDENTIAL')
    expect(result.details).toContain('API key')
  })

  it('rejects a model when provider is unhealthy or circuit breaker is tripped', () => {
    const task = TASK_DEFINITIONS.conversation
    const result = eligibilityService.evaluateModel(task, validFlashModel, {
      hasCredential: true,
      isProviderHealthy: false
    })

    expect(result.isEligible).toBe(false)
    expect(result.rejectionReason).toBe('PROVIDER_UNHEALTHY')
    expect(result.details).toContain('unavailable')
  })

  it('rejects a model when status is not active', () => {
    const inactiveModel: ModelDefinition = {
      ...validFlashModel,
      status: 'disabled'
    }

    const task = TASK_DEFINITIONS.conversation
    const result = eligibilityService.evaluateModel(task, inactiveModel, {
      hasCredential: true,
      isProviderHealthy: true
    })

    expect(result.isEligible).toBe(false)
    expect(result.rejectionReason).toBe('EXCLUDED_BY_POLICY')
  })

  it('rejects a model when required capability is unsupported at model level', () => {
    const limitedModel: ModelDefinition = {
      ...validFlashModel,
      capabilities: {
        ...validFlashModel.capabilities,
        modelLevel: {
          ...validFlashModel.capabilities.modelLevel,
          structuredOutput: 'unsupported'
        }
      }
    }

    const task = TASK_DEFINITIONS['structured-extraction']
    const result = eligibilityService.evaluateModel(task, limitedModel, {
      hasCredential: true,
      isProviderHealthy: true
    })

    expect(result.isEligible).toBe(false)
    expect(result.rejectionReason).toBe('MISSING_CAPABILITY')
    expect(result.details).toContain('structuredOutput')
  })

  it('rejects a model when required capability has unknown verification state', () => {
    const unknownCapabilityModel: ModelDefinition = {
      ...validFlashModel,
      capabilities: {
        ...validFlashModel.capabilities,
        modelLevel: {
          ...validFlashModel.capabilities.modelLevel,
          structuredOutput: 'unknown'
        }
      }
    }

    const task = TASK_DEFINITIONS['structured-extraction']
    const result = eligibilityService.evaluateModel(task, unknownCapabilityModel, {
      hasCredential: true,
      isProviderHealthy: true
    })

    expect(result.isEligible).toBe(false)
    expect(result.rejectionReason).toBe('MISSING_CAPABILITY')
    expect(result.details).toContain('unknown')
  })

  it('rejects a model when HELIOXEN runtime does not support the required capability', () => {
    const runtimeUnsupportedModel: ModelDefinition = {
      ...validFlashModel,
      capabilities: {
        ...validFlashModel.capabilities,
        helioxenLevel: {
          ...validFlashModel.capabilities.helioxenLevel,
          structuredOutput: 'unsupported'
        }
      }
    }

    const task = TASK_DEFINITIONS['structured-extraction']
    const result = eligibilityService.evaluateModel(task, runtimeUnsupportedModel, {
      hasCredential: true,
      isProviderHealthy: true
    })

    expect(result.isEligible).toBe(false)
    expect(result.rejectionReason).toBe('HELIOXEN_RUNTIME_UNSUPPORTED')
    expect(result.details).toContain('not yet integrated into the HELIOXEN desktop runtime')
  })
})
