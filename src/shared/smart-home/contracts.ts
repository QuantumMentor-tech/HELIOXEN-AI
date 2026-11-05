/**
 * HELIOXEN AI — Step 45: Smart-Home Contracts & Risk Classification
 * Safety boundary rules determining mandatory human confirmation for physical security actions.
 */

import { z } from 'zod'
import { SmartHomeEntityDomain, SmartHomeRiskClass } from './types'

export function classifyActionRisk(
  domain: SmartHomeEntityDomain,
  command: string
): SmartHomeRiskClass {
  const normCmd = command.toLowerCase().trim()

  // 1. High-impact physical security/safety actions strictly require human authorization
  if (domain === 'lock' && (normCmd === 'unlock' || normCmd === 'open')) {
    return 'physical_security_consequential'
  }
  if (domain === 'alarm' && (normCmd === 'disarm' || normCmd === 'disable')) {
    return 'physical_security_consequential'
  }
  if (domain === 'cover' && (normCmd === 'open' || normCmd === 'unlock')) {
    return 'physical_security_consequential'
  }

  // 2. Read-only sensor inspection
  if (domain === 'sensor' || domain === 'binary_sensor') {
    return 'read_only'
  }

  // 3. Ordinary reversible environmental actions (lighting, climate, switches)
  return 'reversible_action'
}

export function isHighRiskPhysicalAction(
  domain: SmartHomeEntityDomain,
  command: string
): boolean {
  return classifyActionRisk(domain, command) === 'physical_security_consequential'
}

export const SmartHomeActionCommandSchema = z.object({
  hubId: z.string().min(1).max(128),
  entityId: z.string().min(1).max(256).regex(/^[a-zA-Z0-9_.-]+$/, {
    message: 'Invalid entity ID format.'
  }),
  command: z.string().min(1).max(64),
  parameters: z.record(z.string(), z.unknown()).optional(),
  confirmationToken: z.string().max(128).optional()
})
