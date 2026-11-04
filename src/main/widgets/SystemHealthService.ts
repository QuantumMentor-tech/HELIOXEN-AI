/**
 * HELIOXEN AI — Step 39: System Health Service
 * Main-process system and application resource observability.
 * Clearly separates host OS metrics from HELIOXEN-specific process metrics,
 * queries Electron powerMonitor for battery/AC state, and reports unsupported
 * hardware sensors honestly without fabrication.
 */

import os from 'os'
import fs from 'fs'
import {
  HelioxenProcessMetrics,
  HostSystemMetrics,
  PowerAndSensorMetrics,
  PrimaryStorageMetric,
  SystemHealthSnapshot,
  ThermalState
} from '../../shared/widgets/types'

export interface SystemHealthServiceOptions {
  readonly getPowerMonitorFn?: () => any
  readonly getAppMetricsFn?: () => any[]
  readonly nowFn?: () => number
}

export class SystemHealthService {
  private lastCpuSample: { time: number; totalTicks: number; idleTicks: number } | null = null
  private lastProcessCpuSample: { time: number; cpuUsage: NodeJS.CpuUsage } | null = null
  private cachedSnapshot: { snapshot: SystemHealthSnapshot; expiresAt: number } | null = null
  private readonly getPowerMonitorFn: () => any
  private readonly getAppMetricsFn: () => any[]
  private readonly nowFn: () => number

  constructor(options: SystemHealthServiceOptions = {}) {
    this.nowFn = options.nowFn ?? (() => Date.now())

    this.getPowerMonitorFn =
      options.getPowerMonitorFn ??
      (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { powerMonitor } = require('electron')
          return powerMonitor
        } catch {
          return null
        }
      })

    this.getAppMetricsFn =
      options.getAppMetricsFn ??
      (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { app } = require('electron')
          if (app && typeof app.getAppMetrics === 'function') {
            return app.getAppMetrics()
          }
        } catch {
          // Ignore outside Electron
        }
        return []
      })
  }

  /**
   * Retrieves a comprehensive system health snapshot.
   * Differentiates host OS metrics from HELIOXEN process metrics.
   */
  public async getSnapshot(sampleDurationMs = 100): Promise<SystemHealthSnapshot> {
    const now = this.nowFn()
    if (this.cachedSnapshot && now < this.cachedSnapshot.expiresAt) {
      return this.cachedSnapshot.snapshot
    }

    const [hostCpuPercent, storage] = await Promise.all([
      this.measureHostCpu(sampleDurationMs),
      this.getStorageMetrics()
    ])

    const hostMetrics = this.getHostMetrics(hostCpuPercent)
    const processMetrics = this.getHelioxenProcessMetrics()
    const powerAndSensors = this.getPowerAndSensorMetrics()

    const snapshot: SystemHealthSnapshot = {
      acquiredAt: now,
      host: hostMetrics,
      helioxenProcess: processMetrics,
      powerAndSensors,
      storage,
      samplingIntervalMs: sampleDurationMs
    }

    this.cachedSnapshot = {
      snapshot,
      expiresAt: now + 1500 // 1.5s cache prevents CPU churn on concurrent UI reads
    }

    return snapshot
  }

  // --------------------------------------------------------------------------
  // 1. Host OS Metrics
  // --------------------------------------------------------------------------

  private getHostMetrics(cpuPercent: number): HostSystemMetrics {
    const totalMemoryBytes = os.totalmem()
    const freeMemoryBytes = os.freemem()
    const usedMemoryBytes = Math.max(0, totalMemoryBytes - freeMemoryBytes)
    const memoryUsagePercent =
      totalMemoryBytes > 0 ? Number(((usedMemoryBytes / totalMemoryBytes) * 100).toFixed(1)) : 0

    return {
      totalMemoryBytes,
      freeMemoryBytes,
      usedMemoryBytes,
      memoryUsagePercent,
      systemUptimeSeconds: Math.floor(os.uptime()),
      cpuUtilizationPercent: cpuPercent,
      logicalCores: os.cpus()?.length || 1,
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      status: 'available'
    }
  }

  private async measureHostCpu(durationMs: number): Promise<number> {
    const cpus = os.cpus()
    if (!cpus || cpus.length === 0) return 0

    const calculateTicks = (cpuList: os.CpuInfo[]) => {
      let total = 0
      let idle = 0
      for (const cpu of cpuList) {
        const { user, nice, sys, idle: idl, irq } = cpu.times
        total += user + nice + sys + idl + irq
        idle += idl
      }
      return { total, idle }
    }

    const start = calculateTicks(cpus)
    await new Promise((resolve) => setTimeout(resolve, Math.max(30, Math.min(durationMs, 500))))
    const end = calculateTicks(os.cpus())

    const totalDelta = end.total - start.total
    const idleDelta = end.idle - start.idle

    if (totalDelta <= 0) return 0
    const usedDelta = totalDelta - idleDelta
    return Number(Math.max(0, Math.min(100, (usedDelta / totalDelta) * 100)).toFixed(1))
  }

  // --------------------------------------------------------------------------
  // 2. HELIOXEN Process Metrics
  // --------------------------------------------------------------------------

  private getHelioxenProcessMetrics(): HelioxenProcessMetrics {
    const memUsage = process.memoryUsage()
    const processUptime = Math.floor(process.uptime())

    // Attempt to read CPU usage from Electron app.getAppMetrics() first
    let processCpuPercent = 0
    const appMetrics = this.getAppMetricsFn()
    if (Array.isArray(appMetrics) && appMetrics.length > 0) {
      // Sum cpu usage across main and helper processes
      const totalCpu = appMetrics.reduce((sum, item) => sum + (item?.cpu?.percentCPUUsage ?? 0), 0)
      processCpuPercent = Number(Math.max(0, Math.min(100, totalCpu)).toFixed(1))
    } else {
      // Fallback: estimate via process.cpuUsage() delta
      const now = this.nowFn()
      const currentUsage = process.cpuUsage()
      if (this.lastProcessCpuSample) {
        const timeDeltaMs = now - this.lastProcessCpuSample.time
        if (timeDeltaMs > 100) {
          const userDeltaMicros = currentUsage.user - this.lastProcessCpuSample.cpuUsage.user
          const systemDeltaMicros = currentUsage.system - this.lastProcessCpuSample.cpuUsage.system
          const totalMicros = userDeltaMicros + systemDeltaMicros
          const percent = (totalMicros / (timeDeltaMs * 1000)) * 100
          processCpuPercent = Number(Math.max(0, Math.min(100, percent)).toFixed(1))
        }
      }
      this.lastProcessCpuSample = { time: now, cpuUsage: currentUsage }
    }

    // Process Health Assessment based on heap and CPU thresholds
    const heapUsedMb = memUsage.heapUsed / (1024 * 1024)
    let healthStatus: HelioxenProcessMetrics['healthStatus'] = 'nominal'
    let healthAssessment = 'Process heap and CPU consumption are within normal bounds.'

    if (heapUsedMb > 1024 || processCpuPercent > 75) {
      healthStatus = 'high'
      healthAssessment = `Elevated consumption: Heap ${heapUsedMb.toFixed(0)} MB, CPU ${processCpuPercent}%.`
    } else if (heapUsedMb > 512 || processCpuPercent > 40) {
      healthStatus = 'elevated'
      healthAssessment = `Moderate load: Heap ${heapUsedMb.toFixed(0)} MB, CPU ${processCpuPercent}%.`
    }

    return {
      pid: process.pid,
      processUptimeSeconds: processUptime,
      cpuUtilizationPercent: processCpuPercent,
      memoryRssBytes: memUsage.rss,
      heapTotalBytes: memUsage.heapTotal,
      heapUsedBytes: memUsage.heapUsed,
      healthStatus,
      healthAssessment,
      status: 'available'
    }
  }

  // --------------------------------------------------------------------------
  // 3. Power & Sensor Metrics
  // --------------------------------------------------------------------------

  private getPowerAndSensorMetrics(): PowerAndSensorMetrics {
    const pm = this.getPowerMonitorFn()
    let onBattery = false
    let batterySupported = false

    if (pm && typeof pm.isOnBatteryPower === 'function') {
      try {
        onBattery = Boolean(pm.isOnBatteryPower())
        batterySupported = true
      } catch {
        batterySupported = false
      }
    }

    // Thermal State (only supported on macOS in Electron powerMonitor)
    let thermalState: ThermalState = 'unsupported'
    let thermalStateSupported = false
    let thermalNote = 'Thermal state sensors are not exposed by the operating system API on this platform without kernel drivers.'

    if (pm && typeof pm.getCurrentThermalState === 'function') {
      try {
        const state = pm.getCurrentThermalState()
        if (state && state !== 'unknown') {
          thermalState = state as ThermalState
          thermalStateSupported = true
          thermalNote = `Operating system reported thermal state: ${state}.`
        }
      } catch {
        // Keep unsupported
      }
    }

    return {
      powerSource: batterySupported ? (onBattery ? 'battery' : 'ac_power') : 'unknown',
      onBattery,
      isCharging: batterySupported ? !onBattery : null,
      batterySupported,
      thermalState,
      thermalStateSupported,
      thermalNote,
      fanSpeedRpm: {
        value: null,
        status: 'unsupported',
        note: 'Hardware fan sensors require unapproved privileged kernel drivers; metric is omitted to prevent fabrication.'
      },
      gpuTemperatureCelsius: {
        value: null,
        status: 'unsupported',
        note: 'GPU temperature sensor requires proprietary native vendor libraries; metric is omitted to prevent fabrication.'
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. Primary Storage Metric
  // --------------------------------------------------------------------------

  private async getStorageMetrics(): Promise<PrimaryStorageMetric> {
    const rootPath = process.platform === 'win32' ? (process.env.SystemDrive || 'C:\\') : '/'
    try {
      if (typeof fs.promises.statfs !== 'function') {
        return {
          driveOrVolume: rootPath,
          totalBytes: 0,
          availableBytes: 0,
          usedBytes: 0,
          usagePercent: 0,
          status: 'unsupported',
          error: 'fs.statfs is not supported in this runtime environment.'
        }
      }

      const stats = await fs.promises.statfs(rootPath)
      const bsize = stats.bsize || 4096
      const totalBytes = stats.blocks * bsize
      const availableBytes = stats.bavail * bsize
      const usedBytes = Math.max(0, (stats.blocks - stats.bavail) * bsize)
      const usagePercent =
        totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(1)) : 0

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
}

