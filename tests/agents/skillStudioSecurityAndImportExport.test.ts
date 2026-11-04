/**
 * HELIOXEN AI — Step 42 Test Suite: Dynamic Skill Studio Security, Import/Export & AI Assistance
 * Tests declarative export serialization (secret scrubbing), untrusted package import quarantine,
 * pre-flight dependency checking, and AI-assisted drafting security controls.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'
import { DynamicSkillsManager } from '../../src/main/agents/DynamicSkillsManager'
import { ToolRegistry } from '../../src/shared/tools/ToolRegistry'
import { TaskExecutionEngine, ToolDispatcher } from '../../src/shared/orchestration'
import { authorizer } from '../../src/main/security'
import {
  serializeSkillExportPackage,
  parseAndValidateSkillImportPackage
} from '../../src/shared/agents/skillStudioContracts'
import { DynamicSkillDefinition } from '../../src/shared/agents/types'

describe('Step 42 — Dynamic Skill Studio: Security & Import/Export', () => {
  let tempDir: string
  let toolRegistry: ToolRegistry
  let toolDispatcher: ToolDispatcher
  let executionEngine: TaskExecutionEngine
  let skillsManager: DynamicSkillsManager

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-skill-security-test-'))
    toolRegistry = new ToolRegistry()
    toolDispatcher = new ToolDispatcher()
    executionEngine = new TaskExecutionEngine(toolRegistry, toolDispatcher, authorizer)

    // Register baseline tools
    toolRegistry.register({
      id: 'system:get_time',
      displayName: 'Get Time',
      description: 'Reads system clock',
      category: 'system' as const,
      version: '1.0.0',
      inputSchema: z.object({}).passthrough(),
      outputSchema: z.object({ epochMs: z.number() }),
      jsonSchema: { type: 'object' },
      requiredCapabilities: [],
      riskTier: 'low' as const,
      confirmationPolicy: 'none' as const,
      implementationStatus: 'available' as const,
      registrationStatus: 'enabled' as const,
      executionMode: 'asynchronous' as const,
      limits: { timeoutMs: 5000, maxPayloadSizeBytes: 1024 },
      retryPolicy: { isIdempotent: true },
      source: 'builtin' as const,
      tags: []
    })

    skillsManager = new DynamicSkillsManager({
      storageDir: tempDir,
      toolRegistry,
      executionEngine
    })
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  // --------------------------------------------------------------------------
  // 1. DECLARATIVE EXPORT SERIALIZATION & SECRET SANITIZATION
  // --------------------------------------------------------------------------
  describe('Declarative Export & Secret Scrubbing', () => {
    it('serializes portable skill package and scrubs sensitive tokens', () => {
      const skillWithPotentialSecrets: DynamicSkillDefinition = {
        id: 'skill_exportable',
        displayName: 'Exportable Skill',
        description: 'Testing export hygiene',
        category: 'productivity',
        version: '1.0.0',
        author: 'User',
        status: 'enabled',
        steps: [
          {
            stepId: 'step_1',
            displayName: 'Read Time',
            toolId: 'system:get_time',
            inputBindings: {
              apiKey: { type: 'literal', literalValue: 'AIzaSyA_secret_token_12345' },
              normalParam: { type: 'literal', literalValue: 'allowed_value' }
            },
            dependsOnStepIds: []
          }
        ],
        derivedCapabilities: [],
        derivedRiskTier: 'low',
        constraints: { maxTimeoutMs: 10000, maxStepRetries: 0, stopOnFirstFailure: true },
        createdAt: 1700000000000,
        updatedAt: 1700000000000
      }

      const jsonPackage = serializeSkillExportPackage(skillWithPotentialSecrets)
      expect(typeof jsonPackage).toBe('string')
      const parsed = JSON.parse(jsonPackage)

      expect(parsed.format).toBe('helioxen-skill-package')
      expect(parsed.packageSchemaVersion).toBe(1)
      expect(parsed.definitionHash).toBeDefined()

      // Verify that sensitive token was scrubbed by serializeSkillExportPackage
      const exportedBindings = parsed.skill.steps[0].inputBindings
      expect(exportedBindings.apiKey.literalValue).not.toContain('AIzaSyA_secret_token_12345')
      expect(exportedBindings.apiKey.literalValue).toBe('[REDACTED_CREDENTIAL]')
      expect(exportedBindings.normalParam.literalValue).toBe('allowed_value')
    })
  })

  // --------------------------------------------------------------------------
  // 2. UNTRUSTED IMPORT PARSING, DEPENDENCY CHECKING & QUARANTINE
  // --------------------------------------------------------------------------
  describe('Untrusted Import Parsing & Quarantine', () => {
    it('rejects malformed and unparseable JSON', () => {
      expect(() => {
        parseAndValidateSkillImportPackage('{ malformed json package...', toolRegistry)
      }).toThrow(/IMPORT_ERROR: Malformed JSON/)
    })

    it('rejects invalid schema or missing required fields', () => {
      const invalidPkg = JSON.stringify({
        format: 'helioxen-skill-package',
        packageSchemaVersion: 1,
        exportedAt: 1700000000000,
        skill: {
          id: 'skill_incomplete'
          // missing required fields
        }
      })

      expect(() => {
        parseAndValidateSkillImportPackage(invalidPkg, toolRegistry)
      }).toThrow(/IMPORT_ERROR: Invalid package structure/)
    })

    it('pre-flights dependencies and flags missing tools in import preview', () => {
      const pkgWithMissingTool = JSON.stringify({
        format: 'helioxen-skill-package',
        packageSchemaVersion: 1,
        exportedAt: 1700000000000,
        definitionHash: 'abcdef0123456789abcdef0123456789',
        skill: {
          id: 'skill_with_missing_tool',
          displayName: 'Skill With Missing Tool',
          description: 'Uses tool not installed',
          version: '1.0.0',
          author: 'External',
          category: 'productivity',
          steps: [
            {
              stepId: 'step_1',
              displayName: 'Missing Tool Step',
              toolId: 'thirdparty:uninstalled_tool',
              inputBindings: {},
              dependsOnStepIds: []
            }
          ],
          constraints: { maxTimeoutMs: 10000, maxStepRetries: 0, stopOnFirstFailure: true },
          derivedCapabilities: ['network:http'],
          derivedRiskTier: 'moderate'
        }
      })

      const preview = parseAndValidateSkillImportPackage(pkgWithMissingTool, toolRegistry)
      expect(preview.valid).toBe(false)
      expect(preview.missingDependencies).toContain('thirdparty:uninstalled_tool')
      expect(preview.validationReport.issues.length).toBeGreaterThan(0)
    })

    it('always quarantines imported skills with draft status', async () => {
      const validPkg = JSON.stringify({
        format: 'helioxen-skill-package',
        packageSchemaVersion: 1,
        exportedAt: 1700000000000,
        definitionHash: 'abcdef0123456789abcdef0123456789',
        skill: {
          id: 'skill_imported_quarantine',
          displayName: 'Quarantined Skill',
          description: 'Should be imported strictly as draft',
          version: '1.0.0',
          author: 'UntrustedThirdParty',
          category: 'productivity',
          steps: [
            {
              stepId: 'step_1',
              displayName: 'Get Time Step',
              toolId: 'system:get_time',
              inputBindings: {},
              dependsOnStepIds: []
            }
          ],
          constraints: { maxTimeoutMs: 10000, maxStepRetries: 0, stopOnFirstFailure: true },
          derivedCapabilities: [],
          derivedRiskTier: 'low'
        }
      })

      const importedSkill = await skillsManager.importSkillPackage(validPkg)
      expect(importedSkill.id).toBe('skill_imported_quarantine')
      expect(importedSkill.status).toBe('draft') // Strictly quarantined as draft!

      // Verify that it is stored as draft in the active registry
      const stored = await skillsManager.getSkill('skill_imported_quarantine')
      expect(stored?.status).toBe('draft')
    })
  })

  // --------------------------------------------------------------------------
  // 3. AI-ASSISTED DRAFT GENERATION SECURITY CONTROLS
  // --------------------------------------------------------------------------
  describe('AI-Assisted Draft Security Controls', () => {
    it('quarantines AI-generated skills as unapproved draft workflows', async () => {
      // Test AI draft generation fallback when provider returns structured draft
      const draft = await skillsManager.generateSkillDraftWithAi(
        'Check system time and summarize status',
        'productivity'
      )

      expect(draft.id).toBeDefined()
      expect(draft.status).toBe('draft')
      expect(draft.steps.length).toBeGreaterThanOrEqual(1)
      expect(draft.steps[0].toolId).toBe('system:get_time')

      // Ensure that all tools referenced in the AI draft exist in the ToolRegistry
      for (const step of draft.steps) {
        expect(toolRegistry.get(step.toolId)).toBeDefined()
      }
    })
  })
})
