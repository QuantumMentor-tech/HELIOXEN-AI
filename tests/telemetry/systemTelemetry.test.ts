/**
 * HELIOXEN AI — Step 28: System Health Telemetry Tests
 */

import { describe, it, expect } from 'vitest'
import { SystemTelemetryManager } from '../../src/main/telemetry/SystemTelemetryManager'
import { SystemHealthTelemetrySchema } from '../../src/shared/telemetry/contracts'

describe('Step 28: System Health Telemetry', () => {
  const manager = new SystemTelemetryManager()

  it('retrieves valid system health telemetry matching schema contract', async () => {
    const telemetry = await manager.getSystemHealth({ sampleDurationMs: 50 })

    expect(telemetry).toBeDefined()
    expect(telemetry.os).toBeDefined()
    expect(telemetry.cpu).toBeDefined()
    expect(telemetry.memory).toBeDefined()
    expect(telemetry.uptime).toBeDefined()
    expect(telemetry.storage).toBeDefined()
    expect(telemetry.acquiredAt).toBeGreaterThan(0)

    // Validate against strict Zod schema
    const parseResult = SystemHealthTelemetrySchema.safeParse(telemetry)
    expect(parseResult.success).toBe(true)
  })

  it('measures CPU utilization over a bounded sampling window', async () => {
    const cpu = await manager.measureCpuUtilization(50)

    expect(cpu.status).toBe('available')
    expect(cpu.utilizationPercent).toBeGreaterThanOrEqual(0)
    expect(cpu.utilizationPercent).toBeLessThanOrEqual(100)
    expect(cpu.logicalCores).toBeGreaterThan(0)
    expect(cpu.sampleDurationMs).toBe(50)
  })

  it('deduplicates concurrent CPU sampling requests', async () => {
    const [sample1, sample2] = await Promise.all([
      manager.measureCpuUtilization(60),
      manager.measureCpuUtilization(60)
    ])

    expect(sample1).toBeDefined()
    expect(sample2).toBeDefined()
    expect(sample1.utilizationPercent).toBe(sample2.utilizationPercent)
    expect(sample1.sampleDurationMs).toBe(sample2.sampleDurationMs)
  })

  it('calculates host and process memory metrics without false zero defaults', () => {
    const mem = manager.getMemoryMetrics()

    expect(mem.status).toBe('available')
    expect(mem.hostTotalBytes).toBeGreaterThan(0)
    expect(mem.hostFreeBytes).toBeGreaterThanOrEqual(0)
    expect(mem.hostUsedBytes).toBeGreaterThan(0)
    expect(mem.hostUsagePercent).toBeGreaterThanOrEqual(0)
    expect(mem.hostUsagePercent).toBeLessThanOrEqual(100)

    // Process memory
    expect(mem.processRssBytes).toBeGreaterThan(0)
    expect(mem.processHeapTotalBytes).toBeGreaterThan(0)
    expect(mem.processHeapUsedBytes).toBeGreaterThan(0)
  })

  it('retrieves storage capacity metrics using statfs or reports graceful unavailable status', async () => {
    const storage = await manager.getStorageMetrics()

    expect(storage.driveOrVolume).toBeDefined()
    if (storage.status === 'available') {
      expect(storage.totalBytes).toBeGreaterThan(0)
      expect(storage.availableBytes).toBeGreaterThanOrEqual(0)
      expect(storage.usedBytes).toBeGreaterThanOrEqual(0)
      expect(storage.usagePercent).toBeGreaterThanOrEqual(0)
      expect(storage.usagePercent).toBeLessThanOrEqual(100)
    } else {
      expect(storage.status).toBe('unavailable')
      expect(storage.error).toBeDefined()
    }
  })

  it('reports operating system and runtime diagnostics accurately', () => {
    const osDiag = manager.getOsDiagnostics()

    expect(osDiag.platform).toBe(process.platform)
    expect(osDiag.logicalCpuCount).toBeGreaterThan(0)
    expect(osDiag.nodeVersion).toBe(process.versions.node)
    expect(osDiag.arch).toBe(process.arch)
  })
})

