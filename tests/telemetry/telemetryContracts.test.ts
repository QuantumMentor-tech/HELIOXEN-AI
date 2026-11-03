/**
 * HELIOXEN AI — Step 28: Telemetry Contracts & Schema Validation Tests
 */

import { describe, it, expect } from 'vitest'
import {
  SystemHealthRequestSchema,
  SystemHealthTelemetrySchema,
  InstalledAppsRequestSchema,
  InstalledAppsResultSchema,
  WindowDiscoveryRequestSchema,
  WindowDiscoveryResultSchema
} from '../../src/shared/telemetry/contracts'

describe('Step 28: Telemetry Contracts & Validation', () => {
  describe('SystemHealthRequestSchema', () => {
    it('accepts valid request within range', () => {
      const valid = SystemHealthRequestSchema.safeParse({ sampleDurationMs: 200 })
      expect(valid.success).toBe(true)
    })

    it('rejects sampleDurationMs outside bounded range (50 to 1000)', () => {
      const tooLow = SystemHealthRequestSchema.safeParse({ sampleDurationMs: 10 })
      expect(tooLow.success).toBe(false)

      const tooHigh = SystemHealthRequestSchema.safeParse({ sampleDurationMs: 5000 })
      expect(tooHigh.success).toBe(false)
    })

    it('rejects unrecognized parameters strictly', () => {
      const invalid = SystemHealthRequestSchema.safeParse({ sampleDurationMs: 100, unknownArg: 'evil' })
      expect(invalid.success).toBe(false)
    })
  })

  describe('InstalledAppsRequestSchema', () => {
    it('accepts valid filtering options', () => {
      const valid = InstalledAppsRequestSchema.safeParse({
        query: 'chrome',
        scope: 'system',
        limit: 100,
        forceRefresh: true
      })
      expect(valid.success).toBe(true)
    })

    it('rejects invalid scope or out-of-bounds limit', () => {
      const invalidScope = InstalledAppsRequestSchema.safeParse({ scope: 'root' as any })
      expect(invalidScope.success).toBe(false)

      const limitTooHigh = InstalledAppsRequestSchema.safeParse({ limit: 500 })
      expect(limitTooHigh.success).toBe(false)
    })
  })

  describe('WindowDiscoveryRequestSchema', () => {
    it('accepts valid window discovery request options', () => {
      const valid = WindowDiscoveryRequestSchema.safeParse({
        includeSelf: true,
        redactSensitiveTitles: true,
        limit: 25
      })
      expect(valid.success).toBe(true)
    })

    it('rejects limits exceeding 100 or negative values', () => {
      const tooHigh = WindowDiscoveryRequestSchema.safeParse({ limit: 150 })
      expect(tooHigh.success).toBe(false)

      const negative = WindowDiscoveryRequestSchema.safeParse({ limit: -1 })
      expect(negative.success).toBe(false)
    })
  })

  describe('Result Schemas Integrity', () => {
    it('validates a complete SystemHealthTelemetry object', () => {
      const telemetry = {
        os: {
          platform: 'win32',
          release: '10.0.19045',
          type: 'Windows_NT',
          arch: 'x64',
          logicalCpuCount: 8,
          nodeVersion: '20.18.0',
          electronVersion: '33.2.0'
        },
        cpu: {
          utilizationPercent: 24.5,
          logicalCores: 8,
          sampleDurationMs: 100,
          status: 'available' as const
        },
        memory: {
          hostTotalBytes: 34359738368,
          hostFreeBytes: 17179869184,
          hostUsedBytes: 17179869184,
          hostUsagePercent: 50.0,
          processRssBytes: 157286400,
          processHeapTotalBytes: 83886080,
          processHeapUsedBytes: 52428800,
          status: 'available' as const
        },
        uptime: {
          systemSeconds: 86400,
          processSeconds: 300
        },
        storage: {
          driveOrVolume: 'C:\\',
          totalBytes: 512000000000,
          availableBytes: 256000000000,
          usedBytes: 256000000000,
          usagePercent: 50.0,
          status: 'available' as const
        },
        acquiredAt: Date.now()
      }

      const parsed = SystemHealthTelemetrySchema.safeParse(telemetry)
      expect(parsed.success).toBe(true)
    })

    it('validates an InstalledAppsResult object', () => {
      const result = {
        status: 'completed' as const,
        apps: [
          {
            id: 'app_system_chrome',
            displayName: 'Google Chrome',
            publisher: 'Google',
            category: 'Browser',
            installScope: 'system' as const,
            locationHint: 'Google'
          }
        ],
        totalCount: 1,
        isComplete: true,
        source: 'windows_start_menu' as const,
        acquiredAt: Date.now(),
        cached: false
      }

      const parsed = InstalledAppsResultSchema.safeParse(result)
      expect(parsed.success).toBe(true)
    })

    it('validates a WindowDiscoveryResult object', () => {
      const result = {
        status: 'completed' as const,
        windows: [
          {
            id: 'win_helioxen_1',
            title: 'HELIOXEN Assistant',
            appAssociation: 'HELIOXEN AI',
            isVisible: true,
            isMinimized: false,
            isActive: true,
            isSelfApp: true,
            bounds: { x: 0, y: 0, width: 1024, height: 768 }
          }
        ],
        totalCount: 1,
        activeWindowId: 'win_helioxen_1',
        limitation: 'Desktop capturer window enumeration',
        acquiredAt: Date.now()
      }

      const parsed = WindowDiscoveryResultSchema.safeParse(result)
      expect(parsed.success).toBe(true)
    })
  })
})

