import { ModelDefinition } from '../../shared/ai/models'
import {
  TaskRequirement,
  EligibilityResult
} from '../../shared/ai/routing'

export class ModelEligibilityService {
  /**
   * Deterministically evaluates whether a model is eligible for a given task.
   * Strictly verifies model-level support AND HELIOXEN desktop runtime integration.
   */
  public evaluateModel(
    task: TaskRequirement,
    model: ModelDefinition,
    options: {
      hasCredential: boolean
      isProviderHealthy: boolean
    }
  ): EligibilityResult {
    // 1. Model registration check
    if (!model || !model.id) {
      return {
        isEligible: false,
        rejectionReason: 'MODEL_UNREGISTERED',
        details: 'Model is not registered in the authoritative catalog.'
      }
    }

    // 2. Policy / Status check
    if (model.status && model.status !== 'active' && model.status !== 'preview') {
      return {
        isEligible: false,
        rejectionReason: 'EXCLUDED_BY_POLICY',
        details: `Model '${model.id}' is excluded by policy (status: ${model.status}).`
      }
    }

    // 2. Credential availability check
    if (!options.hasCredential) {
      return {
        isEligible: false,
        rejectionReason: 'MISSING_CREDENTIAL',
        details: `Provider '${model.providerId}' has no API key configured in the secure vault.`
      }
    }

    // 3. Provider operational health check
    if (!options.isProviderHealthy) {
      return {
        isEligible: false,
        rejectionReason: 'PROVIDER_UNHEALTHY',
        details: `Provider '${model.providerId}' is currently rate-limited, authentication-failed, or unavailable.`
      }
    }

    // 4. Required capabilities verification
    for (const dimension of task.requiredCapabilities) {
      const modelSupport = model.capabilities.modelLevel[dimension]
      const helioxenSupport = model.capabilities.helioxenLevel[dimension]

      // Model level must be verified and supported (unknown is treated as unsupported for required capabilities)
      if (modelSupport !== 'supported') {
        return {
          isEligible: false,
          rejectionReason: 'MISSING_CAPABILITY',
          details: `Model '${model.id}' does not support required capability '${dimension}' (status: ${modelSupport}).`
        }
      }

      // HELIOXEN runtime must actually implement the capability
      if (helioxenSupport !== 'supported') {
        return {
          isEligible: false,
          rejectionReason: 'HELIOXEN_RUNTIME_UNSUPPORTED',
          details: `Capability '${dimension}' is not yet integrated into the HELIOXEN desktop runtime (deferred milestone).`
        }
      }
    }

    return {
      isEligible: true
    }
  }
}
