/**
 * HELIOXEN AI — Step 28: Telemetry and Desktop Awareness Schemas & Validation Contracts
 * Strict runtime validation for system health, application discovery, and window enumeration.
 */

import { z } from 'zod'

export const OsDiagnosticsSchema = z.object({
  platform: z.string().min(1).max(32),
  release: z.string().min(1).max(64),
  type: z.string().min(1).max(64),
  arch: z.string().min(1).max(32),
  logicalCpuCount: z.number().int().positive(),
  nodeVersion: z.string().min(1).max(32),
  electronVersion: z.string().min(1).max(32)
})

export const CpuMetricsSchema = z.object({
  utilizationPercent: z.number().min(0).max(100),
  logicalCores: z.number().int().positive(),
  sampleDurationMs: z.number().int().nonnegative(),
  status: z.enum(['available', 'unavailable']),
  error: z.string().max(256).optional()
})

export const MemoryMetricsSchema = z.object({
  hostTotalBytes: z.number().int().positive(),
  hostFreeBytes: z.number().int().nonnegative(),
  hostUsedBytes: z.number().int().nonnegative(),
  hostUsagePercent: z.number().min(0).max(100),
  processRssBytes: z.number().int().nonnegative(),
  processHeapTotalBytes: z.number().int().nonnegative(),
  processHeapUsedBytes: z.number().int().nonnegative(),
  status: z.enum(['available', 'unavailable'])
})

export const StorageMetricsSchema = z.object({
  driveOrVolume: z.string().min(1).max(128),
  totalBytes: z.number().int().nonnegative(),
  availableBytes: z.number().int().nonnegative(),
  usedBytes: z.number().int().nonnegative(),
  usagePercent: z.number().min(0).max(100),
  status: z.enum(['available', 'unavailable']),
  error: z.string().max(256).optional()
})

export const SystemHealthTelemetrySchema = z.object({
  os: OsDiagnosticsSchema,
  cpu: CpuMetricsSchema,
  memory: MemoryMetricsSchema,
  uptime: z.object({
    systemSeconds: z.number().int().nonnegative(),
    processSeconds: z.number().int().nonnegative()
  }),
  storage: StorageMetricsSchema,
  acquiredAt: z.number().int().positive()
})

export const SystemHealthRequestSchema = z
  .object({
    sampleDurationMs: z.number().int().min(50).max(1000).optional()
  })
  .strict()

export const InstalledApplicationEntrySchema = z.object({
  id: z.string().min(1).max(128),
  displayName: z.string().min(1).max(256),
  publisher: z.string().max(128).optional(),
  category: z.string().max(64).optional(),
  installScope: z.enum(['system', 'user', 'unknown']),
  locationHint: z.string().max(128).optional()
})

export const InstalledAppsRequestSchema = z
  .object({
    query: z.string().max(100).optional(),
    scope: z.enum(['all', 'system', 'user']).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    forceRefresh: z.boolean().optional()
  })
  .strict()

export const InstalledAppsResultSchema = z.object({
  status: z.enum(['completed', 'partial', 'unsupported', 'failed']),
  apps: z.array(InstalledApplicationEntrySchema).max(200),
  totalCount: z.number().int().nonnegative(),
  isComplete: z.boolean(),
  source: z.enum(['windows_start_menu', 'registry', 'mock']),
  acquiredAt: z.number().int().positive(),
  cached: z.boolean(),
  error: z.string().max(256).optional()
})

export const WindowBoundsSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative()
})

export const WindowMetadataEntrySchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().max(512),
  appAssociation: z.string().max(128).optional(),
  isVisible: z.boolean(),
  isMinimized: z.boolean(),
  isActive: z.boolean(),
  isSelfApp: z.boolean(),
  displayId: z.string().max(64).optional(),
  bounds: WindowBoundsSchema.optional()
})

export const WindowDiscoveryRequestSchema = z
  .object({
    includeSelf: z.boolean().optional(),
    redactSensitiveTitles: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).optional()
  })
  .strict()

export const WindowDiscoveryResultSchema = z.object({
  status: z.enum(['completed', 'partial', 'unsupported', 'failed']),
  windows: z.array(WindowMetadataEntrySchema).max(100),
  totalCount: z.number().int().nonnegative(),
  activeWindowId: z.string().max(128).optional(),
  limitation: z.string().max(512).optional(),
  acquiredAt: z.number().int().positive(),
  error: z.string().max(256).optional()
})

