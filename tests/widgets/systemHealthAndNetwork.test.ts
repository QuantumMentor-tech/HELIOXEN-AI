/**
 * HELIOXEN AI — Step 39 Test Suite
 * System Health & Network Monitor Tests.
 * Verifies host vs process metric distinction, battery/power detection,
 * honest sensor reporting, bounded HTTPS testing, SSRF rejection, and cancellation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  SystemHealthService,
  NetworkMonitorService
} from '../../src/main/widgets'
import {
  validateDiagnosticTargetUrl,
  APPROVED_NETWORK_ENDPOINTS
} from '../../src/shared/widgets/contracts'

describe('Step 39 — System Health Service', () => {
  let currentTime = 1762260000000

  beforeEach(() => {
    currentTime = 1762260000000
  })

  it('collects host system metrics and separates them from HELIOXEN process metrics', async () => {
    const service = new SystemHealthService({
      nowFn: () => currentTime,
      getAppMetricsFn: () => [
        { pid: 1234, type: 'Browser', cpu: { percentCPUUsage: 8.5 } },
        { pid: 5678, type: 'Utility', cpu: { percentCPUUsage: 2.1 } }
      ]
    })

    const snapshot = await service.getSnapshot(50)

    // 1. Host OS Metrics
    expect(snapshot.host).toBeDefined()
    expect(snapshot.host.totalMemoryBytes).toBeGreaterThan(0)
    expect(snapshot.host.freeMemoryBytes).toBeGreaterThanOrEqual(0)
    expect(snapshot.host.usedMemoryBytes).toBeGreaterThanOrEqual(0)
    expect(snapshot.host.memoryUsagePercent).toBeGreaterThanOrEqual(0)
    expect(snapshot.host.memoryUsagePercent).toBeLessThanOrEqual(100)
    expect(snapshot.host.systemUptimeSeconds).toBeGreaterThanOrEqual(0)
    expect(snapshot.host.logicalCores).toBeGreaterThanOrEqual(1)
    expect(snapshot.host.status).toBe('available')

    // 2. HELIOXEN Process Metrics (distinct from host)
    expect(snapshot.helioxenProcess).toBeDefined()
    expect(snapshot.helioxenProcess.pid).toBe(process.pid)
    expect(snapshot.helioxenProcess.memoryRssBytes).toBeGreaterThan(0)
    expect(snapshot.helioxenProcess.heapTotalBytes).toBeGreaterThan(0)
    expect(snapshot.helioxenProcess.heapUsedBytes).toBeGreaterThan(0)
    expect(snapshot.helioxenProcess.cpuUtilizationPercent).toBe(10.6) // 8.5 + 2.1
    expect(['nominal', 'elevated', 'high']).toContain(snapshot.helioxenProcess.healthStatus)
    expect(snapshot.helioxenProcess.healthAssessment).toContain('Process heap and CPU')
  })

  it('queries battery and AC power state through powerMonitor without fabricating sensors', async () => {
    // Simulated laptop on battery power
    const serviceOnBattery = new SystemHealthService({
      nowFn: () => currentTime,
      getPowerMonitorFn: () => ({
        isOnBatteryPower: () => true,
        getCurrentThermalState: () => 'unknown'
      })
    })

    const snapshotBattery = await serviceOnBattery.getSnapshot(50)
    expect(snapshotBattery.powerAndSensors.powerSource).toBe('battery')
    expect(snapshotBattery.powerAndSensors.onBattery).toBe(true)
    expect(snapshotBattery.powerAndSensors.isCharging).toBe(false)
    expect(snapshotBattery.powerAndSensors.batterySupported).toBe(true)

    // Hardware sensors must be reported as unsupported, never fabricated
    expect(snapshotBattery.powerAndSensors.fanSpeedRpm.status).toBe('unsupported')
    expect(snapshotBattery.powerAndSensors.fanSpeedRpm.value).toBeNull()
    expect(snapshotBattery.powerAndSensors.fanSpeedRpm.note).toContain('unapproved privileged kernel drivers')

    expect(snapshotBattery.powerAndSensors.gpuTemperatureCelsius.status).toBe('unsupported')
    expect(snapshotBattery.powerAndSensors.gpuTemperatureCelsius.value).toBeNull()
    expect(snapshotBattery.powerAndSensors.gpuTemperatureCelsius.note).toContain('vendor libraries')
  })

  it('correctly reports AC connected state on desktop workstations', async () => {
    const serviceAc = new SystemHealthService({
      nowFn: () => currentTime,
      getPowerMonitorFn: () => ({
        isOnBatteryPower: () => false
      })
    })

    const snapshotAc = await serviceAc.getSnapshot(50)
    expect(snapshotAc.powerAndSensors.powerSource).toBe('ac_power')
    expect(snapshotAc.powerAndSensors.onBattery).toBe(false)
    expect(snapshotAc.powerAndSensors.isCharging).toBe(true)
  })

  it('caches snapshot for 1.5 seconds to prevent CPU churn during rapid UI polling', async () => {
    let callCount = 0
    const service = new SystemHealthService({
      nowFn: () => currentTime + callCount * 300,
      getAppMetricsFn: () => {
        callCount++
        return []
      }
    })

    const snap1 = await service.getSnapshot(50)
    const snap2 = await service.getSnapshot(50)

    expect(snap1.acquiredAt).toBe(snap2.acquiredAt)
  })
})

describe('Step 39 — Network Monitor Service & Security Boundaries', () => {
  let currentTime = 1762260000000

  beforeEach(() => {
    currentTime = 1762260000000
  })

  it('enforces strict URL validation: requires HTTPS and rejects unsafe schemes and SSRF/private networks', () => {
    // 1. Unsafe protocols
    expect(validateDiagnosticTargetUrl('http://insecure.example.com').valid).toBe(false)
    expect(validateDiagnosticTargetUrl('javascript:alert(1)').valid).toBe(false)
    expect(validateDiagnosticTargetUrl('file:///C:/Windows').valid).toBe(false)
    expect(validateDiagnosticTargetUrl('data:text/plain;base64,AAAA').valid).toBe(false)

    // 2. Local, loopback and private network targets (SSRF defense)
    expect(validateDiagnosticTargetUrl('https://127.0.0.1:8080/test').valid).toBe(false)
    expect(validateDiagnosticTargetUrl('https://localhost/trace').valid).toBe(false)
    expect(validateDiagnosticTargetUrl('https://192.168.1.1/router').valid).toBe(false)
    expect(validateDiagnosticTargetUrl('https://10.0.0.5/api').valid).toBe(false)
    expect(validateDiagnosticTargetUrl('https://169.254.169.254/latest/meta-data').valid).toBe(false)
    expect(validateDiagnosticTargetUrl('https://app.local/status').valid).toBe(false)

    // 3. Valid public HTTPS targets
    const valid = validateDiagnosticTargetUrl('https://cloudflare.com/cdn-cgi/trace')
    expect(valid.valid).toBe(true)
    expect(valid.host).toBe('cloudflare.com')
  })

  it('runs bounded connection diagnostic test against an approved endpoint and reports round-trip time', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      // Simulate 45ms network elapsed time
      currentTime += 45
      return {
        ok: true,
        status: 200,
        text: async () => 'fl=123\nh=cloudflare.com\nip=1.2.3.4'
      }
    })

    const service = new NetworkMonitorService({
      nowFn: () => currentTime,
      fetchFn: mockFetch as any,
      getIsOnlineFn: () => true
    })

    const result = await service.runDiagnostic({
      targetUrl: APPROVED_NETWORK_ENDPOINTS[0].url,
      timeoutMs: 3000
    })

    expect(result.status).toBe('success')
    expect(result.statusCode).toBe(200)
    expect(result.roundTripTimeMs).toBe(45)
    expect(result.targetHost).toBe('cloudflare.com')
    expect(result.diagnosticBasis).toContain('Successfully reached cloudflare.com (HTTP 200) in 45 ms')
    // Limitations must be clearly stated
    expect(result.disclaimer).toContain('Diagnostic measures request round-trip time to the tested endpoint only')
    expect(result.disclaimer).toContain('does not measure ICMP ping')
  })

  it('handles HTTP error responses truthfully without claiming total network failure', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      currentTime += 30
      return {
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable'
      }
    })

    const service = new NetworkMonitorService({
      nowFn: () => currentTime,
      fetchFn: mockFetch as any
    })

    const result = await service.runDiagnostic({
      targetUrl: 'https://httpbin.org/status/200'
    })

    expect(result.status).toBe('http_error')
    expect(result.statusCode).toBe(503)
    expect(result.diagnosticBasis).toContain('Endpoint httpbin.org responded with HTTP 503')
  })

  it('supports explicit user cancellation of an in-flight diagnostic test', async () => {
    let cancelCalled = false
    const mockFetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          cancelCalled = true
          const abortError = new Error('The user aborted a request.')
          abortError.name = 'AbortError'
          reject(abortError)
        })
      })
    })

    const service = new NetworkMonitorService({
      nowFn: () => currentTime,
      fetchFn: mockFetch as any
    })

    const promise = service.runDiagnostic({
      targetUrl: APPROVED_NETWORK_ENDPOINTS[0].url
    })

    // Immediately cancel
    expect(service.cancelDiagnostic()).toBe(true)

    const result = await promise
    expect(result.status).toBe('cancelled')
    expect(result.diagnosticBasis).toContain('aborted before completion')
    expect(result.roundTripTimeMs).toBeNull()
    expect(cancelCalled).toBe(true)

    service.dispose()
  })
})

