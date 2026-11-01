import { describe, it, expect, beforeEach } from 'vitest'
import { ModelRouter } from '../../src/main/ai/ModelRouter'
import { ModelRegistry } from '../../src/main/ai/ModelRegistry'
import { ModelEligibilityService } from '../../src/main/ai/ModelEligibilityService'
import { ProviderHealthService } from '../../src/main/ai/ProviderHealthService'
import { DEFAULT_AI_PREFERENCES, UserAiPreferences } from '../../src/shared/ai/models'
import { AiProviderException } from '../../src/main/ai/errors'

describe('ModelRouter (Task-Based Routing & Deterministic Selection)', () => {
  let modelRegistry: ModelRegistry
  let eligibilityService: ModelEligibilityService
  let healthService: ProviderHealthService
  let router: ModelRouter

  const allConfigured = {
    'google-gemini': { configured: true },
    openai: { configured: true }
  }

  beforeEach(() => {
    modelRegistry = new ModelRegistry()
    eligibilityService = new ModelEligibilityService()
    healthService = new ProviderHealthService()
    router = new ModelRouter(modelRegistry, eligibilityService, healthService)
  })

  it('routes strictly to manual explicit activeModel in manual routing mode', () => {
    const preferences: UserAiPreferences = {
      ...DEFAULT_AI_PREFERENCES,
      routingMode: 'manual',
      activeProvider: 'google-gemini',
      activeModel: 'gemini-4-argon'
    }

    const decision = router.route({ taskType: 'conversation' }, preferences, allConfigured)

    expect(decision.selectedProvider).toBe('google-gemini')
    expect(decision.selectedModel).toBe('gemini-4-argon')
    expect(decision.taskType).toBe('conversation')
    expect(decision.reason).toContain('Explicit user selection respected')
  })

  it('routes fast-response tasks to ultra-fast tier (gemini-3.5-flash-lite) in task-based mode', () => {
    const preferences: UserAiPreferences = {
      ...DEFAULT_AI_PREFERENCES,
      routingMode: 'task-based',
      activeProvider: 'google-gemini'
    }

    const decision = router.route({ taskType: 'fast-response' }, preferences, allConfigured)

    expect(decision.selectedProvider).toBe('google-gemini')
    expect(decision.selectedModel).toBe('gemini-3.5-flash-lite')
    expect(decision.taskType).toBe('fast-response')
    expect(decision.reason).toContain('Optimized for')
  })

  it('routes complex-reasoning tasks to flagship-reasoning tier in task-based mode', () => {
    const preferences: UserAiPreferences = {
      ...DEFAULT_AI_PREFERENCES,
      routingMode: 'task-based',
      activeProvider: 'google-gemini'
    }

    const decision = router.route({ taskType: 'complex-reasoning' }, preferences, allConfigured)

    // Flagship reasoning tier matches gemini-4-argon
    expect(decision.selectedModel).toBe('gemini-4-argon')
    expect(decision.taskType).toBe('complex-reasoning')
  })

  it('generates same-provider fallback candidates when allowSameProviderFallback is true', () => {
    const preferences: UserAiPreferences = {
      ...DEFAULT_AI_PREFERENCES,
      routingMode: 'manual',
      activeProvider: 'google-gemini',
      activeModel: 'gemini-4-argon',
      allowSameProviderFallback: true,
      allowCrossProviderFallback: false
    }

    const decision = router.route({}, preferences, allConfigured)

    expect(decision.fallbackCandidates.length).toBeGreaterThan(0)
    // All candidates must belong to google-gemini
    for (const fallback of decision.fallbackCandidates) {
      expect(fallback.provider).toBe('google-gemini')
      expect(fallback.model).not.toBe('gemini-4-argon')
    }
  })

  it('generates cross-provider fallback candidates ONLY when allowCrossProviderFallback is true', () => {
    const preferencesDisabled: UserAiPreferences = {
      ...DEFAULT_AI_PREFERENCES,
      routingMode: 'manual',
      activeProvider: 'google-gemini',
      activeModel: 'gemini-3.8-flash',
      allowSameProviderFallback: false,
      allowCrossProviderFallback: false
    }

    const decisionDisabled = router.route({}, preferencesDisabled, allConfigured)
    expect(decisionDisabled.fallbackCandidates).toHaveLength(0)

    const preferencesEnabled: UserAiPreferences = {
      ...DEFAULT_AI_PREFERENCES,
      routingMode: 'manual',
      activeProvider: 'google-gemini',
      activeModel: 'gemini-3.8-flash',
      allowSameProviderFallback: false,
      allowCrossProviderFallback: true
    }

    const decisionEnabled = router.route({}, preferencesEnabled, allConfigured)
    expect(decisionEnabled.fallbackCandidates.length).toBeGreaterThan(0)
    for (const fallback of decisionEnabled.fallbackCandidates) {
      expect(fallback.provider).toBe('openai')
    }
  })

  it('rejects unregistered model with INVALID_MODEL', () => {
    const preferences: UserAiPreferences = {
      ...DEFAULT_AI_PREFERENCES,
      routingMode: 'manual',
      activeProvider: 'google-gemini',
      activeModel: 'non-existent-model'
    }

    expect(() => router.route({}, preferences, allConfigured)).toThrow(AiProviderException)
    try {
      router.route({}, preferences, allConfigured)
    } catch (err) {
      expect((err as AiProviderException).code).toBe('INVALID_MODEL')
    }
  })

  it('rejects unconfigured provider with MISSING_CREDENTIAL', () => {
    const unconfigured = {
      'google-gemini': { configured: false },
      openai: { configured: false }
    }

    const preferences: UserAiPreferences = {
      ...DEFAULT_AI_PREFERENCES,
      activeProvider: 'google-gemini',
      activeModel: 'gemini-3.8-flash'
    }

    expect(() => router.route({}, preferences, unconfigured)).toThrow(AiProviderException)
    try {
      router.route({}, preferences, unconfigured)
    } catch (err) {
      expect((err as AiProviderException).code).toBe('MISSING_CREDENTIAL')
    }
  })
})
