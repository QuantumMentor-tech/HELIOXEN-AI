import { AiProviderId } from '../../shared/ai/types'
import {
  ModelDefinition,
  UserAiPreferences
} from '../../shared/ai/models'
import {
  AiTaskType,
  TASK_DEFINITIONS,
  RoutingDecision,
  FallbackCandidate
} from '../../shared/ai/routing'
import { ModelRegistry } from './ModelRegistry'
import { ModelEligibilityService } from './ModelEligibilityService'
import { ProviderHealthService } from './ProviderHealthService'
import { AiProviderException, AiErrorCode } from './errors'
import { securityLogger } from '../security/securityLogger'

export class ModelRouter {
  private modelRegistry: ModelRegistry
  private eligibilityService: ModelEligibilityService
  private healthService: ProviderHealthService

  constructor(
    modelRegistry: ModelRegistry,
    eligibilityService?: ModelEligibilityService,
    healthService?: ProviderHealthService
  ) {
    this.modelRegistry = modelRegistry
    this.eligibilityService = eligibilityService ?? new ModelEligibilityService()
    this.healthService = healthService ?? new ProviderHealthService()
  }

  public getHealthService(): ProviderHealthService {
    return this.healthService
  }

  public getEligibilityService(): ModelEligibilityService {
    return this.eligibilityService
  }

  /**
   * Deterministically resolves a registered provider and model for a task.
   * Enforces user routing mode, eligibility criteria, and fallback candidates.
   */
  public route(
    request: {
      provider?: AiProviderId
      model?: string
      taskType?: AiTaskType
    },
    preferences: UserAiPreferences,
    credentialStatuses: Record<AiProviderId, { configured: boolean }>
  ): RoutingDecision {
    const taskType = request.taskType || 'conversation'
    const taskRequirement = TASK_DEFINITIONS[taskType] || TASK_DEFINITIONS.conversation
    const correlationId = `route-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

    // --- Mode 1: Manual Explicit Selection (Default) ---
    if (preferences.routingMode === 'manual' || request.model) {
      const targetProvider = request.provider || preferences.activeProvider
      const targetModelId = request.model || preferences.activeModel

      const modelDef = this.modelRegistry.getModel(targetProvider, targetModelId)
      if (!modelDef) {
        throw new AiProviderException({
          code: 'INVALID_MODEL',
          provider: targetProvider,
          message: `Requested model '${targetModelId}' does not belong to provider '${targetProvider}' or is not registered.`
        })
      }

      // Check eligibility
      const hasCredential = credentialStatuses[targetProvider]?.configured ?? false
      const isHealthy = this.healthService.isProviderAvailable(targetProvider)
      const eligibility = this.eligibilityService.evaluateModel(taskRequirement, modelDef, {
        hasCredential,
        isProviderHealthy: isHealthy
      })

      if (!eligibility.isEligible) {
        const code =
          eligibility.rejectionReason === 'MISSING_CREDENTIAL' ? 'MISSING_CREDENTIAL' : 'INVALID_MODEL'
        throw new AiProviderException({
          code,
          provider: targetProvider,
          message:
            eligibility.rejectionReason === 'MISSING_CREDENTIAL'
              ? `API credential for ${targetProvider} is not configured. Please set your key in Settings.`
              : `Selected model '${modelDef.displayName}' is not eligible for task '${taskType}': ${eligibility.details}`
        })
      }

      // Determine eligible fallback candidates based on user preferences
      const fallbackCandidates: FallbackCandidate[] = []
      const catalog = this.modelRegistry.getCatalog()

      // 1. Same-provider fallbacks (if enabled)
      if (preferences.allowSameProviderFallback) {
        const sameProvider = catalog.find((p) => p.id === targetProvider)
        if (sameProvider) {
          for (const candidate of sameProvider.models) {
            if (candidate.id !== targetModelId) {
              const res = this.eligibilityService.evaluateModel(taskRequirement, candidate, {
                hasCredential,
                isProviderHealthy: isHealthy
              })
              if (res.isEligible) {
                fallbackCandidates.push({
                  provider: targetProvider,
                  model: candidate.id,
                  reason: `Same-provider alternative (${candidate.capabilities.tier || 'standard'})`
                })
              }
            }
          }
        }
      }

      // 2. Cross-provider fallbacks (strictly gated by user preference)
      if (preferences.allowCrossProviderFallback) {
        const otherProviderId: AiProviderId =
          targetProvider === 'google-gemini' ? 'openai' : 'google-gemini'
        const otherHasCred = credentialStatuses[otherProviderId]?.configured ?? false
        const otherHealthy = this.healthService.isProviderAvailable(otherProviderId)

        if (otherHasCred && otherHealthy) {
          const otherProvider = catalog.find((p) => p.id === otherProviderId)
          if (otherProvider) {
            for (const candidate of otherProvider.models) {
              const res = this.eligibilityService.evaluateModel(taskRequirement, candidate, {
                hasCredential: otherHasCred,
                isProviderHealthy: otherHealthy
              })
              if (res.isEligible) {
                fallbackCandidates.push({
                  provider: otherProviderId,
                  model: candidate.id,
                  reason: `Cross-provider alternative (${otherProvider.displayName})`
                })
              }
            }
          }
        }
      }

      const decision: RoutingDecision = {
        selectedProvider: targetProvider,
        selectedModel: targetModelId,
        taskType,
        strategy: 'explicit-user-preference',
        reason: `Explicit user selection respected for task '${taskRequirement.displayName}'.`,
        fallbackCandidates,
        correlationId,
        timestamp: Date.now()
      }

      securityLogger.logEvent('ROUTING_DECISION', 'model-router', 'PERMITTED', {
        provider: decision.selectedProvider,
        model: decision.selectedModel,
        strategy: decision.strategy,
        taskType
      })

      return decision
    }

    // --- Mode 2: Task-Based Model Selection ---
    const catalog = this.modelRegistry.getCatalog()
    const eligiblePool: Array<{ model: ModelDefinition; score: number }> = []

    for (const provider of catalog) {
      // If cross-provider is disabled, restrict pool to activeProvider only
      if (!preferences.allowCrossProviderFallback && provider.id !== preferences.activeProvider) {
        continue
      }

      const hasCred = credentialStatuses[provider.id]?.configured ?? false
      const isHealthy = this.healthService.isProviderAvailable(provider.id)

      for (const candidate of provider.models) {
        const res = this.eligibilityService.evaluateModel(taskRequirement, candidate, {
          hasCredential: hasCred,
          isProviderHealthy: isHealthy
        })

        if (res.isEligible) {
          let score = 0

          // Preferred tier matching
          if (taskRequirement.preferredTier && candidate.capabilities.tier === taskRequirement.preferredTier) {
            score += 100
          }

          // Active provider preference
          if (candidate.providerId === preferences.activeProvider) {
            score += 20
          }

          // Default model preference
          if (candidate.isDefault) {
            score += 10
          }

          eligiblePool.push({ model: candidate, score })
        }
      }
    }

    if (eligiblePool.length === 0) {
      const anyConfigured = Object.values(credentialStatuses).some((s) => s.configured)
      throw new AiProviderException({
        code: anyConfigured ? 'INVALID_MODEL' : 'MISSING_CREDENTIAL',
        provider: preferences.activeProvider,
        message: anyConfigured
          ? `No eligible registered models found for task '${taskRequirement.displayName}'.`
          : `No AI provider credentials configured for task '${taskRequirement.displayName}'. Please set your key in Settings.`
      })
    }

    // Deterministic sorting: highest score, tiebreak by alphabetical model ID
    eligiblePool.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.model.id.localeCompare(b.model.id)
    })

    const topCandidate = eligiblePool[0].model
    const fallbackCandidates: FallbackCandidate[] = eligiblePool.slice(1).map((item) => ({
      provider: item.model.providerId,
      model: item.model.id,
      reason: `Ranked alternative for '${taskRequirement.displayName}' (${item.model.capabilities.tier || 'standard'})`
    }))

    const decision: RoutingDecision = {
      selectedProvider: topCandidate.providerId,
      selectedModel: topCandidate.id,
      taskType,
      strategy: 'task-based-tier',
      reason: `Optimized for '${taskRequirement.displayName}' based on capability tier: ${topCandidate.capabilities.tier || 'standard'}.`,
      fallbackCandidates,
      correlationId,
      timestamp: Date.now()
    }

    securityLogger.logEvent('ROUTING_DECISION', 'model-router', 'PERMITTED', {
      provider: decision.selectedProvider,
      model: decision.selectedModel,
      strategy: decision.strategy,
      taskType
    })

    return decision
  }

  /**
   * Evaluates failure and determines next eligible fallback candidate.
   * Strictly respects retry safety and privacy policies.
   */
  public getNextFallback(
    decision: RoutingDecision,
    failedProvider: AiProviderId,
    failedModel: string,
    errorCode: AiErrorCode,
    preferences: UserAiPreferences
  ): FallbackCandidate | null {
    // 1. Cancellation never triggers fallback
    if (errorCode === 'CANCELLED') {
      return null
    }

    // 2. Filter remaining candidates
    for (const candidate of decision.fallbackCandidates) {
      if (candidate.provider === failedProvider && candidate.model === failedModel) {
        continue
      }

      // If same provider failed with AUTH failure, don't retry same provider
      if (candidate.provider === failedProvider && errorCode === 'AUTHENTICATION_FAILED') {
        continue
      }

      // If candidate is cross-provider but user disabled cross-provider fallback
      if (candidate.provider !== failedProvider && !preferences.allowCrossProviderFallback) {
        continue
      }

      // If candidate is on another provider, check if that provider is available
      if (
        candidate.provider !== failedProvider &&
        !this.healthService.isProviderAvailable(candidate.provider)
      ) {
        continue
      }

      // If candidate is on the same provider, skip only if circuit breaker tripped or auth failed
      if (candidate.provider === failedProvider) {
        const h = this.healthService.getHealth(candidate.provider)
        if (h.status === 'auth-failed' || h.status === 'unavailable') {
          continue
        }
      }

      return candidate
    }

    return null
  }
}
