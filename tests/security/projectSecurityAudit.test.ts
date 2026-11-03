import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/ipc/channels'
import { CAPABILITIES } from '../../src/shared/security/capabilities'
import { authorizer } from '../../src/main/security/authorizer'
import { consentGate } from '../../src/main/security/consentGate'
import { SecurityLogger, redactSensitiveData } from '../../src/main/security/securityLogger'
import { NavigationPolicy } from '../../src/main/browser/NavigationPolicy'
import { BrowserDownloadManager } from '../../src/main/browser/BrowserDownloadManager'
import { PathValidator } from '../../src/shared/filesystem/PathValidator'
import { mainToolRegistry } from '../../src/main/tools'
import { PlanValidator } from '../../src/shared/orchestration/PlanValidator'
import { TaskPlan } from '../../src/shared/orchestration/types'
import * as os from 'os'
import * as path from 'path'

describe('Comprehensive Project Security & System Audit Suite', () => {
  beforeEach(() => {
    consentGate.clear()
  })

  describe('1. IPC Channel & Capability Registry Integrity', () => {
    it('ensures every IPC channel identifier is a unique, non-empty namespaced string', () => {
      const entries = Object.entries(IPC_CHANNELS)
      expect(entries.length).toBeGreaterThan(70)

      const seenValues = new Set<string>()
      for (const [key, value] of entries) {
        expect(typeof value).toBe('string')
        expect(value.trim().length).toBeGreaterThan(0)
        expect(value).toContain(':')
        expect(seenValues.has(value), `Duplicate IPC channel value for ${key}: ${value}`).toBe(false)
        seenValues.add(value)
      }
    })

    it('ensures every registered tool in mainToolRegistry maps to defined capabilities and enforces availability', () => {
      const tools = mainToolRegistry.list()
      expect(tools.length).toBeGreaterThanOrEqual(25)

      for (const tool of tools) {
        expect(Array.isArray(tool.requiredCapabilities)).toBe(true)
        for (const capId of tool.requiredCapabilities) {
          expect(CAPABILITIES[capId], `Tool ${tool.id} references unknown capability ${capId}`).toBeDefined()
          if (tool.riskTier !== 'prohibited') {
            expect(CAPABILITIES[capId].status).not.toBe('prohibited')
          } else {
            expect(CAPABILITIES[capId].status).toBe('prohibited')
          }
        }
      }
    })
  })

  describe('2. Prohibited Capabilities & Arbitrary Code Execution Defense', () => {
    it('permanently blocks all prohibited shell/script execution capabilities', () => {
      const prohibitedIds = ['shell:execute', 'shell:executeCommand', 'os:runScript']

      for (const capId of prohibitedIds) {
        expect(CAPABILITIES[capId]).toBeDefined()
        expect(CAPABILITIES[capId].status).toBe('prohibited')
        expect(CAPABILITIES[capId].riskTier).toBe('prohibited')

        expect(() =>
          authorizer.authorize(capId, {
            requester: 'renderer-main-window',
            consentRequestId: 'engine_approved_bypass_attempt'
          })
        ).toThrow(/permanently banned by security policy/i)

        expect(() =>
          authorizer.authorize(capId, {
            requester: 'main-only',
            consentRequestId: 'engine_approved_bypass_attempt'
          })
        ).toThrow(/permanently banned by security policy/i)
      }
    })

    it('blocks main-only credential vault capabilities when requested by renderer', () => {
      const mainOnlyCaps = [
        'credential:store',
        'credential:retrieve',
        'credential:delete',
        'credentials:deleteAllSecrets'
      ]

      for (const capId of mainOnlyCaps) {
        expect(() =>
          authorizer.authorize(capId, {
            requester: 'renderer-main-window'
          })
        ).toThrow(/restricted to internal trusted main-process execution/i)
      }
    })
  })

  describe('3. High-Risk Capability Consent Enforcement & Replay Prevention', () => {
    const highRiskRendererCaps = [
      'capture:getSources',
      'filesystem:organize',
      'desktop:sendText',
      'system:openExternalUrl',
      'browser:submitForm'
    ]

    it('denies high-risk capabilities when invoked without a valid consent token', () => {
      for (const capId of highRiskRendererCaps) {
        expect(() =>
          authorizer.authorize(capId, {
            requester: 'renderer-main-window'
          })
        ).toThrow(/requires explicit user confirmation/i)
      }
    })

    it('permits high-risk capabilities with single-use ConsentGate approval and blocks token replay', () => {
      for (const capId of highRiskRendererCaps) {
        const req = consentGate.createRequest(capId, `Authorize ${capId}`)
        consentGate.resolveRequest(req.requestId, true)

        // First consumption succeeds without throwing
        expect(() =>
          authorizer.authorize(capId, {
            requester: 'renderer-main-window',
            consentRequestId: req.requestId
          })
        ).not.toThrow()

        // Second consumption with same token must fail (replay attack prevention)
        expect(() =>
          authorizer.authorize(capId, {
            requester: 'renderer-main-window',
            consentRequestId: req.requestId
          })
        ).toThrow(/Human confirmation was rejected or expired/i)
      }
    })

    it('permits engine_approved_* tokens for verified IPC and orchestration execution flows', () => {
      for (const capId of highRiskRendererCaps) {
        expect(() =>
          authorizer.authorize(capId, {
            requester: 'renderer-main-window',
            consentRequestId: `engine_approved_${capId}_test`
          })
        ).not.toThrow()
      }
    })

    it('prevents cross-capability token substitution attacks', () => {
      const req = consentGate.createRequest('capture:getSources', 'Allow screen picker')
      consentGate.resolveRequest(req.requestId, true)

      expect(() =>
        authorizer.authorize('browser:submitForm', {
          requester: 'renderer-main-window',
          consentRequestId: req.requestId
        })
      ).toThrow(/Human confirmation was rejected or expired/i)
    })
  })

  describe('4. Browser Navigation & Dangerous Scheme Defense', () => {
    it('blocks dangerous protocols (file:, javascript:, data:, vbscript:, chrome:, about:) and embedded credentials', () => {
      const maliciousUrls = [
        'file:///C:/Windows/System32/drivers/etc/hosts',
        'javascript:alert(document.cookie)',
        'data:text/html,<script>evil()</script>',
        'vbscript:msgbox("xss")',
        'chrome://settings',
        'about:config',
        'https://admin:secretPassword@example.com/login'
      ]

      for (const url of maliciousUrls) {
        expect(NavigationPolicy.isUrlAllowed(url), `URL should be blocked: ${url}`).toBe(false)
        expect(() => NavigationPolicy.validateUrl(url)).toThrow()
      }

      expect(NavigationPolicy.isUrlAllowed('https://developer.mozilla.org/en-US/')).toBe(true)
    })
  })

  describe('5. Filesystem & Download Path Traversal / Executable Defense', () => {
    it('blocks path traversal and restricted OS system paths in PathValidator', () => {
      const tempRoot = os.tmpdir()

      // Traversal out of root
      const traversal = PathValidator.validateContainment(
        path.join(tempRoot, '..', 'other_dir', 'secret.txt'),
        tempRoot
      )
      expect(traversal.valid).toBe(false)

      // Sibling prefix confusion attack
      const sibling = PathValidator.validateContainment(
        `${tempRoot}_evil${path.sep}secret.txt`,
        tempRoot
      )
      expect(sibling.valid).toBe(false)

      // Protected OS directories
      const sysDir = process.platform === 'win32' ? 'C:\\Windows' : '/etc'
      const protectedCheck = PathValidator.validateContainment(
        path.join(sysDir, 'system.ini'),
        sysDir
      )
      expect(protectedCheck.valid).toBe(false)
    })

    it('intercepts and blocks dangerous executable downloads in BrowserDownloadManager', () => {
      const dlManager = new BrowserDownloadManager()
      const unsafeExts = ['payload.exe', 'script.ps1', 'installer.msi', 'runner.bat', 'macro.vbs']

      for (const filename of unsafeExts) {
        const mockItem: any = {
          getFilename: vi.fn().mockReturnValue(filename),
          getTotalBytes: vi.fn().mockReturnValue(1024),
          getMimeType: vi.fn().mockReturnValue('application/octet-stream'),
          getURL: vi.fn().mockReturnValue(`https://example.org/${filename}`),
          pause: vi.fn(),
          resume: vi.fn(),
          cancel: vi.fn(),
          setSavePath: vi.fn(),
          once: vi.fn(),
          on: vi.fn()
        }
        const review = dlManager.handleWillDownload('sess_audit', mockItem, { id: 1 })
        expect(review.isDangerousType, `File ${filename} should be flagged dangerous`).toBe(true)
        expect(mockItem.cancel).toHaveBeenCalled()
      }
    })
  })

  describe('6. Task Plan Validation & Bounded Orchestration Security', () => {
    it('rejects plans referencing non-existent tools or cyclic dependencies', () => {
      const validator = new PlanValidator(mainToolRegistry)
      const invalidPlan: TaskPlan = {
        id: 'plan-sec-1',
        taskId: 'task-sec-1',
        conversationId: 'conv-sec-1',
        version: '1.0.0',
        intent: 'Attempt invalid tool execution',
        requiresTools: true,
        createdAt: Date.now(),
        steps: [
          {
            id: 'step-1',
            toolId: 'shell:exec_arbitrary',
            description: 'Attempt shell execution',
            input: { cmd: 'whoami' },
            dependencies: ['step-2']
          },
          {
            id: 'step-2',
            toolId: 'telemetry:get_system_health',
            description: 'Cyclic dependency',
            input: {},
            dependencies: ['step-1']
          }
        ]
      }

      const result = validator.validate(invalidPlan)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('7. Security Audit Logger Secret Redaction', () => {
    it('automatically scrubs API keys, bearer tokens, and password fields from audit logs', () => {
      const logger = new SecurityLogger(10)
      logger.logEvent('AUTHORIZATION_CHECK', 'renderer-main-window', 'PERMITTED', {
        provider: 'openai',
        apiKey: 'sk-proj-1234567890abcdefghijklmnop',
        userPassword: 'SuperSecretPassword123!',
        authToken: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        nested: {
          secretKey: 'AIzaSyD-9876543210abcdefghijklmnop',
          publicNote: 'safe-value'
        }
      })

      const events = logger.getRecentEvents()
      expect(events.length).toBe(1)
      const serialized = JSON.stringify(events[0])

      expect(serialized).not.toContain('sk-proj-1234567890abcdefghijklmnop')
      expect(serialized).not.toContain('SuperSecretPassword123!')
      expect(serialized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
      expect(serialized).not.toContain('AIzaSyD-9876543210abcdefghijklmnop')
      expect(serialized).toContain('[REDACTED]')
      expect(serialized).toContain('safe-value')

      const directRedacted = redactSensitiveData({
        credentialSecret: 'raw-secret-123'
      })
      expect(directRedacted?.credentialSecret).toBe('[REDACTED]')
    })
  })
})
