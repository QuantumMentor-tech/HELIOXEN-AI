/**
 * HELIOXEN AI — Step 28: System Health Telemetry Manager
 * Collects read-only host-wide and process-level health metrics.
 * Bounded CPU sampling, safe memory calculation, and isolated volume capacity inspection.
 */

import os from 'os'
import fs from 'fs'
import {
  SystemHealthTelemetry,
  SystemHealthRequest,
  CpuMetrics,
  MemoryMetrics,
  StorageMetrics,
  OsDiagnostics
} from '../../shared/telemetry/types'

export class SystemTelemetryManager {
  private lastCpuSample: { time: number; totalTicks: number; idleTicks: number } | null = null
  private samplingPromise: Promise<CpuMetrics> | null = null

  /**
   * Retrieves a comprehensive, read-only system health snapshot.
   */
  public async getSystemHealth(request: SystemHealthRequest = {}): Promise<SystemHealthTelemetry> {
    const sampleDurationMs = request.sampleDurationMs ?? 100
    const [cpu, storage] = await Promise.all([
      this.measureCpuUtilization(sampleDurationMs),
      this.getStorageMetrics()
    ])

    return {
      os: this.getOsDiagnostics(),
      cpu,
      memory: this.getMemoryMetrics(),
      uptime: {
        systemSeconds: Math.floor(os.uptime()),
        processSeconds: Math.floor(process.uptime())
      },
      storage,
      acquiredAt: Date.now()
    }
  }

  /**
   * Retrieves basic operating system and runtime diagnostics.
   */
  public getOsDiagnostics(): OsDiagnostics {
    return {
      platform: os.platform(),
      release: os.release(),
      type: os.type(),
      arch: os.arch(),
      logicalCpuCount: os.cpus().length,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron || 'unknown'
    }
  }

  /**
   * Measures CPU utilization over a bounded sample window.
   * Compares total tick deltas against idle tick deltas.
   * Deduplicates concurrent sampling requests.
   */
  public async measureCpuUtilization(durationMs = 100): Promise<CpuMetrics> {
    // If a sampling operation is already in flight, reuse it
    if (this.samplingPromise) {
      return this.samplingPromise
    }

    const cpus = os.cpus()
    if (!cpus || cpus.length === 0) {
      return {
        utilizationPercent: 0,
        logicalCores: 1,
        sampleDurationMs: durationMs,
        status: 'unavailable',
        error: 'os.cpus() returned empty set'
      }
    }

    this.samplingPromise = (async () => {
      try {
        const startSample = this.calculateTotalTicks(cpus)
        await new Promise((resolve) => setTimeout(resolve, Math.max(50, Math.min(durationMs, 1000))))
        const endCpus = os.cpus()
        const endSample = this.calculateTotalTicks(endCpus)

        const totalDelta = endSample.total - startSample.total
        const idleDelta = endSample.idle - startSample.idle

        let utilizationPercent = 0
        if (totalDelta > 0) {
          const usedDelta = totalDelta - idleDelta
          utilizationPercent = Number(Math.max(0, Math.min(100, (usedDelta / totalDelta) * 100)).toFixed(1))
        }

        return {
          utilizationPercent,
          logicalCores: endCpus.length,
          sampleDurationMs: durationMs,
          status: 'available'
        }
      } catch (err) {
        return {
          utilizationPercent: 0,
          logicalCores: cpus.length,
          sampleDurationMs: durationMs,
          status: 'unavailable',
          error: err instanceof Error ? err.message : String(err)
        }
      } finally {
        this.samplingPromise = null
      }
    })()

    return this.samplingPromise
  }

  /**
   * Calculates instantaneous host memory and process heap/rss memory.
   */
  public getMemoryMetrics(): MemoryMetrics {
    const hostTotalBytes = os.totalmem()
    const hostFreeBytes = os.freemem()
    const hostUsedBytes = Math.max(0, hostTotalBytes - hostFreeBytes)
    const hostUsagePercent = hostTotalBytes > 0
      ? Number(((hostUsedBytes / hostTotalBytes) * 100).toFixed(1))
      : 0

    const memUsage = process.memoryUsage()

    return {
      hostTotalBytes,
      hostFreeBytes,
      hostUsedBytes,
      hostUsagePercent,
      processRssBytes: memUsage.rss,
      processHeapTotalBytes: memUsage.heapTotal,
      processHeapUsedBytes: memUsage.heapUsed,
      status: 'available'
    }
  }

  /**
   * Retrieves bounded primary volume capacity statistics via fs.statfs.
   * Never enumerates files or traverses directories.
   */
  public async getStorageMetrics(targetPath?: string): Promise<StorageMetrics> {
    const rootPath = targetPath || (process.platform === 'win32' ? (process.env.SystemDrive || 'C:\\') : '/')
    try {
      if (typeof fs.promises.statfs !== 'function') {
        return {
          driveOrVolume: rootPath,
          totalBytes: 0,
          availableBytes: 0,
          usedBytes: 0,
          usagePercent: 0,
          status: 'unavailable',
          error: 'fs.statfs is not supported in current runtime environment'
        }
      }

      const stats = await fs.promises.statfs(rootPath)
      const bsize = stats.bsize || 4096
      const totalBytes = stats.blocks * bsize
      const availableBytes = stats.bavail * bsize
      const usedBytes = Math.max(0, (stats.blocks - stats.bavail) * bsize)
      const usagePercent = totalBytes > 0
        ? Number(((usedBytes / totalBytes) * 100).toFixed(1))
        : 0

      return {
        driveOrVolume: rootPath,
        totalBytes,
        availableBytes,
        usedBytes,
        usagePercent,
        status: 'available'
      }
    } catch (err) {
      return {
        driveOrVolume: rootPath,
        totalBytes: 0,
        availableBytes: 0,
        usedBytes: 0,
        usagePercent: 0,
        status: 'unavailable',
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }

  private calculateTotalTicks(cpus: os.CpuInfo[]): { total: number; idle: number } {
    let total = 0
    let idle = 0
    for (const cpu of cpus) {
      const times = cpu.times
      const cpuTotal = times.user + times.nice + times.sys + times.idle + times.irq
      total += cpuTotal
      idle += times.idle
    }
    return { total, idle }
  }
}

