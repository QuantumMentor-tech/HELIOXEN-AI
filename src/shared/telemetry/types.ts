/**
 * HELIOXEN AI — Step 28: System Telemetry, Installed Applications and Window Discovery
 * Authoritative type definitions for read-only desktop awareness.
 */

export interface OsDiagnostics {
  readonly platform: string
  readonly release: string
  readonly type: string
  readonly arch: string
  readonly logicalCpuCount: number
  readonly nodeVersion: string
  readonly electronVersion: string
}

export interface CpuMetrics {
  readonly utilizationPercent: number
  readonly logicalCores: number
  readonly sampleDurationMs: number
  readonly status: 'available' | 'unavailable'
  readonly error?: string
}

export interface MemoryMetrics {
  readonly hostTotalBytes: number
  readonly hostFreeBytes: number
  readonly hostUsedBytes: number
  readonly hostUsagePercent: number
  readonly processRssBytes: number
  readonly processHeapTotalBytes: number
  readonly processHeapUsedBytes: number
  readonly status: 'available' | 'unavailable'
}

export interface StorageMetrics {
  readonly driveOrVolume: string
  readonly totalBytes: number
  readonly availableBytes: number
  readonly usedBytes: number
  readonly usagePercent: number
  readonly status: 'available' | 'unavailable'
  readonly error?: string
}

export interface SystemHealthTelemetry {
  readonly os: OsDiagnostics
  readonly cpu: CpuMetrics
  readonly memory: MemoryMetrics
  readonly uptime: {
    readonly systemSeconds: number
    readonly processSeconds: number
  }
  readonly storage: StorageMetrics
  readonly acquiredAt: number
}

export interface SystemHealthRequest {
  readonly sampleDurationMs?: number
}

export interface InstalledApplicationEntry {
  readonly id: string
  readonly displayName: string
  readonly publisher?: string
  readonly category?: string
  readonly installScope: 'system' | 'user' | 'unknown'
  readonly locationHint?: string
}

export interface InstalledAppsRequest {
  readonly query?: string
  readonly scope?: 'all' | 'system' | 'user'
  readonly limit?: number
  readonly forceRefresh?: boolean
}

export interface InstalledAppsResult {
  readonly status: 'completed' | 'partial' | 'unsupported' | 'failed'
  readonly apps: readonly InstalledApplicationEntry[]
  readonly totalCount: number
  readonly isComplete: boolean
  readonly source: 'windows_start_menu' | 'registry' | 'mock'
  readonly acquiredAt: number
  readonly cached: boolean
  readonly error?: string
}

export interface WindowBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface WindowMetadataEntry {
  readonly id: string
  readonly title: string
  readonly appAssociation?: string
  readonly isVisible: boolean
  readonly isMinimized: boolean
  readonly isActive: boolean
  readonly isSelfApp: boolean
  readonly displayId?: string
  readonly bounds?: WindowBounds
}

export interface WindowDiscoveryRequest {
  readonly includeSelf?: boolean
  readonly redactSensitiveTitles?: boolean
  readonly limit?: number
}

export interface WindowDiscoveryResult {
  readonly status: 'completed' | 'partial' | 'unsupported' | 'failed'
  readonly windows: readonly WindowMetadataEntry[]
  readonly totalCount: number
  readonly activeWindowId?: string
  readonly limitation?: string
  readonly acquiredAt: number
  readonly error?: string
}

