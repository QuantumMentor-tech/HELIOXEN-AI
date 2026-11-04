/**
 * HELIOXEN AI — Step 42: Advanced Dynamic Skill Studio Types
 * Immutable versioning, 7-stage validation pipeline, test scenarios,
 * version comparisons, and portable declarative export/import packages.
 */

import {
  AgentCategory,
  DynamicSkillDefinition,
  SkillDataBinding,
  SkillExecutionConstraint,
  SkillLifecycleStatus,
  SkillStepDefinition
} from './types'
import { RiskTier } from '../security/capabilities'

// ============================================================================
// 1. 7-STAGE VALIDATION PIPELINE CONTRACTS
// ============================================================================

export type ValidationStageName =
  | 'structural'
  | 'registry_resolution'
  | 'data_flow'
  | 'dependency_graph'
  | 'authorization_risk'
  | 'resource_limits'

export interface ValidationIssue {
  readonly stage: ValidationStageName
  readonly severity: 'error' | 'warning'
  readonly code: string
  readonly message: string
  readonly stepId?: string
  readonly fieldPath?: string
  readonly suggestedFix?: string
}

export interface SkillValidationReport {
  readonly valid: boolean
  readonly overallStatus: 'passed' | 'passed_with_warnings' | 'failed'
  readonly issues: readonly ValidationIssue[]
  readonly stageResults: Record<
    ValidationStageName,
    {
      readonly passed: boolean
      readonly issueCount: number
    }
  >
  readonly stepOrder: readonly string[]
  readonly derivedCapabilities: readonly string[]
  readonly derivedRiskTier: RiskTier
  readonly requiresHumanConsent: boolean
  readonly confirmationPoints: readonly string[]
  readonly validatedAt: number
}

// ============================================================================
// 2. IMMUTABLE SKILL VERSIONING & COMPARISON
// ============================================================================

export interface SkillVersionRecord {
  readonly versionId: string
  readonly skillId: string
  readonly versionNumber: string
  readonly definitionHash: string
  readonly definition: DynamicSkillDefinition
  readonly changelog: string
  readonly author: string
  readonly validationReport: SkillValidationReport
  readonly testSummary?: {
    readonly totalScenarios: number
    readonly passedScenarios: number
    readonly lastTestedAt: number
  }
  readonly approvalStatus: 'draft' | 'validated' | 'approved' | 'rejected'
  readonly approvedAt?: number | null
  readonly createdAt: number
}

export interface SkillVersionDiff {
  readonly baseVersionId: string
  readonly targetVersionId: string
  readonly isIdentical: boolean
  readonly metadataChanges: {
    readonly displayNameChanged: boolean
    readonly descriptionChanged: boolean
    readonly categoryChanged: boolean
  }
  readonly stepsAdded: readonly string[]
  readonly stepsRemoved: readonly string[]
  readonly stepsModified: readonly {
    readonly stepId: string
    readonly toolChanged?: { readonly from: string; readonly to: string }
    readonly bindingsChanged?: readonly string[]
    readonly dependenciesChanged?: readonly string[]
    readonly approvalRequirementChanged?: boolean
  }[]
  readonly capabilitiesAdded: readonly string[]
  readonly capabilitiesRemoved: readonly string[]
  readonly riskTierChanged?: {
    readonly from: RiskTier
    readonly to: RiskTier
  }
}

// ============================================================================
// 3. SKILL TEST WORKBENCH & SCENARIOS
// ============================================================================

export interface SkillTestScenario {
  readonly scenarioId: string
  readonly skillId: string
  readonly name: string
  readonly description: string
  readonly inputParameters: Record<string, unknown>
  readonly mockToolOutputs: Record<string, unknown>
  readonly expectedOutput?: unknown
  readonly expectedStatus: 'completed' | 'failed'
  readonly createdAt: number
  readonly updatedAt: number
}

export interface SkillScenarioStepRun {
  readonly stepId: string
  readonly toolId: string
  readonly resolvedInputs: Record<string, unknown>
  readonly mockOutput: unknown
  readonly status: 'simulated' | 'failed'
  readonly durationMs: number
  readonly error?: string
}

export interface SkillScenarioTestResult {
  readonly scenarioId: string
  readonly scenarioName: string
  readonly passed: boolean
  readonly actualStatus: 'completed' | 'failed'
  readonly actualOutput?: unknown
  readonly stepRuns: readonly SkillScenarioStepRun[]
  readonly outputMatched: boolean
  readonly failureReason?: string
  readonly durationMs: number
  readonly executedAt: number
}

export interface SkillRegressionTestReport {
  readonly skillId: string
  readonly targetVersion: string
  readonly totalScenarios: number
  readonly passedCount: number
  readonly failedCount: number
  readonly scenarioResults: readonly SkillScenarioTestResult[]
  readonly hasRegressions: boolean
  readonly newlyFailedScenarioIds: readonly string[]
  readonly evaluatedAt: number
}

// ============================================================================
// 4. PORTABLE EXPORT / IMPORT PACKAGES
// ============================================================================

export interface SkillExportPackage {
  readonly format: 'helioxen-skill-package'
  readonly packageSchemaVersion: 1
  readonly exportedAt: number
  readonly skill: {
    readonly id: string
    readonly displayName: string
    readonly description: string
    readonly version: string
    readonly category: AgentCategory
    readonly author: string
    readonly steps: readonly SkillStepDefinition[]
    readonly constraints: SkillExecutionConstraint
    readonly derivedCapabilities: readonly string[]
    readonly derivedRiskTier: RiskTier
  }
  readonly testScenarios?: readonly Omit<SkillTestScenario, 'skillId'>[]
  readonly definitionHash: string
}

export interface SkillImportPreview {
  readonly valid: boolean
  readonly sourceFormat: string
  readonly candidateSkill: DynamicSkillDefinition
  readonly candidateScenariosCount: number
  readonly missingDependencies: readonly string[]
  readonly missingConnectors: readonly string[]
  readonly requiredCapabilities: readonly string[]
  readonly riskTier: RiskTier
  readonly validationReport: SkillValidationReport
  readonly requiresRemapping: boolean
  readonly potentialConflictWithExistingSkill: boolean
}

// ============================================================================
// 5. AI-ASSISTED SKILL DRAFT & REFINEMENT CONTRACTS
// ============================================================================

export interface SkillAiDraftRequest {
  readonly prompt: string
  readonly preferredCategory?: AgentCategory
  readonly availableToolIds?: readonly string[]
}

export interface SkillAiRefinementRequest {
  readonly currentDefinition: DynamicSkillDefinition
  readonly instruction: string
  readonly validationIssues?: readonly ValidationIssue[]
  readonly testFailures?: readonly string[]
}

