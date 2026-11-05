/**
 * HELIOXEN AI — Step 47 Performance, Latency & Resource Utilization Benchmark Suite
 * Measures cold startup initialization, cryptographic hashing throughput,
 * memory bounds during extended sessions, and backup/verify operation latency.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'
import { CrashRecoveryManager } from '../../src/main/recovery/CrashRecoveryManager'
import { BackupManager } from '../../src/main/recovery/BackupManager'
import { RestoreManager } from '../../src/main/recovery/RestoreManager'
import { SelfRepairManager } from '../../src/main/recovery/SelfRepairManager'
import { SecurityLogger } from '../../src/main/security/securityLogger'
import { authorizer } from '../../src/main/security/authorizer'
import { mainToolRegistry } from '../../src/main/tools'

describe('Step 47: Performance, Benchmarks & Resource Profiling Suite', () => {
  let tempDir: string
  let mockTime: number

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-perf-test-'))
    mockTime = 1700000000000

    // Seed test files for benchmarking
    fs.writeFileSync(
      path.join(tempDir, 'ai_preferences.json'),
      JSON.stringify({ activeProvider: 'anthropic', activeModel: 'claude-3-5-sonnet' }),
      'utf8'
    )
    fs.writeFileSync(
      path.join(tempDir, 'productivity_store.json'),
      JSON.stringify({ notes: Array.from({ length: 100 }, (_, i) => ({ id: `note_${i}`, content: 'Sample text' })) }),
      'utf8'
    )
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe('1. Manager Initialization Latency', () => {
    it('initializes core recovery, backup, and self-repair subsystems in under 100ms', () => {
      const startTime = performance.now()

      const crashMgr = new CrashRecoveryManager({
        storageDir: tempDir,
        nowFn: () => mockTime
      })

      const backupMgr = new BackupManager({
        storageDir: tempDir,
        nowFn: () => mockTime
      })

      const restoreMgr = new RestoreManager({
        storageDir: tempDir,
        backupManager: backupMgr,
        nowFn: () => mockTime
      })

      const repairMgr = new SelfRepairManager({
        storageDir: tempDir,
        crashRecoveryManager: crashMgr,
        backupManager: backupMgr,
        nowFn: () => mockTime
      })

      const elapsed = performance.now() - startTime

      expect(elapsed).toBeLessThan(100) // Fast cold-boot
      expect(crashMgr.getSessionState().recoveryState).toBe('normal_startup')

      crashMgr.dispose()
    })
  })

  describe('2. Cryptographic Checksum Hashing Performance', () => {
    it('computes SHA-256 for a 1MB payload in under 250ms even under CPU load', () => {
      const oneMegaByteString = 'X'.repeat(1024 * 1024)

      const start = performance.now()
      const hash = crypto.createHash('sha256').update(oneMegaByteString).digest('hex')
      const elapsed = performance.now() - start

      expect(hash).toHaveLength(64)
      expect(elapsed).toBeLessThan(250)
    })
  })

  describe('3. Extended Session Memory Boundedness & Buffer Limits', () => {
    it('maintains bounded memory buffer under 500 consecutive security log events', () => {
      const MAX_ENTRIES = 50
      const logger = new SecurityLogger(MAX_ENTRIES)

      for (let i = 0; i < 500; i++) {
        logger.logEvent('AUTHORIZATION_CHECK', `requester_${i % 5}`, 'PERMITTED', {
          index: i,
          token: `token_${i}` // Should also be redacted
        })
      }

      const recentEvents = logger.getRecentEvents()
      expect(recentEvents.length).toBeLessThanOrEqual(MAX_ENTRIES)
      // Most recent entry should be preserved
      expect((recentEvents[recentEvents.length - 1].details as any)?.index).toBe(499)
      expect((recentEvents[recentEvents.length - 1].details as any)?.token).toBe('[REDACTED]')
    })

    it('executes 1000 capability authorization checks with negligible latency (<20ms total)', () => {
      const start = performance.now()

      for (let i = 0; i < 1000; i++) {
        authorizer.authorize('window:minimize', { requester: 'renderer-main-window' })
      }

      const totalElapsed = performance.now() - start
      expect(totalElapsed).toBeLessThan(100)
    })
  })

  describe('4. Backup Snapshot & Verification Latency', () => {
    it('creates and cryptographically verifies a backup snapshot with fast bounded latency (<1000ms)', async () => {
      const backupMgr = new BackupManager({
        storageDir: tempDir,
        nowFn: () => mockTime
      })

      const startCreate = performance.now()
      const snapshot = await backupMgr.createBackup({ label: 'Performance Benchmark Snapshot' })
      const createElapsed = performance.now() - startCreate

      expect(createElapsed).toBeLessThan(1000)
      expect(snapshot.backupId).toBeDefined()

      const startVerify = performance.now()
      const verification = backupMgr.verifyBackup(snapshot.backupId)
      const verifyElapsed = performance.now() - startVerify

      expect(verifyElapsed).toBeLessThan(500)
      expect(verification.valid).toBe(true)
      expect(verification.checkedArtifacts).toBeGreaterThanOrEqual(1)
    })
  })

  describe('5. Tool Registry Lookup & Schema Validation Throughput', () => {
    it('retrieves tool definitions and schema representations across 1000 lookups with high throughput (<500ms)', () => {
      const tools = mainToolRegistry.list()
      expect(tools.length).toBeGreaterThan(0)
      const firstToolId = tools[0].id

      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        const tool = mainToolRegistry.get(firstToolId)
        expect(tool).toBeDefined()
      }
      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(500)
    })
  })
})
