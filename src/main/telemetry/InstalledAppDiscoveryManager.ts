/**
 * HELIOXEN AI — Step 28: Installed Application Discovery Manager
 * Secure, read-only desktop application inventory enumeration.
 * Scans standard Start Menu registration directories on Windows with bounded depth and in-memory caching.
 * Never executes installers, launches processes, or performs broad filesystem scans.
 */

import fs from 'fs'
import path from 'path'
import {
  InstalledApplicationEntry,
  InstalledAppsRequest,
  InstalledAppsResult
} from '../../shared/telemetry/types'

export interface AppDiscoveryOptions {
  readonly cacheTtlMs?: number
  readonly maxAppsLimit?: number
  readonly customSystemProgramsDir?: string
  readonly customUserProgramsDir?: string
}

export class InstalledAppDiscoveryManager {
  private cachedResult: InstalledAppsResult | null = null
  private lastScanTimestamp = 0
  private readonly cacheTtlMs: number
  private readonly maxAppsLimit: number
  private readonly customSystemDir?: string
  private readonly customUserDir?: string

  constructor(options: AppDiscoveryOptions = {}) {
    this.cacheTtlMs = options.cacheTtlMs ?? 60_000 // 60s cache
    this.maxAppsLimit = options.maxAppsLimit ?? 200
    this.customSystemDir = options.customSystemProgramsDir
    this.customUserDir = options.customUserProgramsDir
  }

  /**
   * Retrieves installed applications with optional filtering and cache control.
   */
  public async getInstalledApps(request: InstalledAppsRequest = {}): Promise<InstalledAppsResult> {
    const now = Date.now()
    const isCacheValid = Boolean(
      this.cachedResult &&
      !request.forceRefresh &&
      now - this.lastScanTimestamp < this.cacheTtlMs
    )

    let fullResult: InstalledAppsResult

    if (isCacheValid && this.cachedResult) {
      fullResult = this.cachedResult
    } else {
      fullResult = await this.scanInstalledApplications()
      this.cachedResult = fullResult
      this.lastScanTimestamp = now
    }

    // Apply filtering and limits
    let filteredApps = [...fullResult.apps]

    if (request.scope && request.scope !== 'all') {
      filteredApps = filteredApps.filter((app) => app.installScope === request.scope)
    }

    if (request.query && request.query.trim()) {
      const q = request.query.trim().toLowerCase()
      filteredApps = filteredApps.filter(
        (app) =>
          app.displayName.toLowerCase().includes(q) ||
          (app.publisher && app.publisher.toLowerCase().includes(q)) ||
          (app.category && app.category.toLowerCase().includes(q))
      )
    }

    const limit = request.limit ?? this.maxAppsLimit
    const boundedApps = filteredApps.slice(0, Math.min(limit, this.maxAppsLimit))

    return {
      status: fullResult.status,
      apps: boundedApps,
      totalCount: boundedApps.length,
      isComplete: fullResult.isComplete,
      source: fullResult.source,
      acquiredAt: fullResult.acquiredAt,
      cached: isCacheValid,
      error: fullResult.error
    }
  }

  /**
   * Searches the cached application inventory.
   */
  public async searchInstalledApps(query: string, limit = 50): Promise<InstalledApplicationEntry[]> {
    const result = await this.getInstalledApps({ query, limit })
    return [...result.apps]
  }

  /**
   * Clears the in-memory application inventory cache.
   */
  public clearCache(): void {
    this.cachedResult = null
    this.lastScanTimestamp = 0
  }

  /**
   * Scans system and user Start Menu directories for registered desktop applications.
   */
  private async scanInstalledApplications(): Promise<InstalledAppsResult> {
    const appsMap = new Map<string, InstalledApplicationEntry>()
    const isWindows = process.platform === 'win32' || Boolean(this.customSystemDir || this.customUserDir)

    if (!isWindows) {
      return {
        status: 'unsupported',
        apps: [],
        totalCount: 0,
        isComplete: false,
        source: 'windows_start_menu',
        acquiredAt: Date.now(),
        cached: false,
        error: 'Installed application discovery via Start Menu is only supported on Windows'
      }
    }

    let hasErrors = false
    let errorMsg: string | undefined

    // 1. Scan System-wide applications
    const systemDir =
      this.customSystemDir ||
      (process.env.ProgramData
        ? path.join(process.env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs')
        : 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs')

    try {
      await this.scanDirectory(systemDir, 'system', appsMap)
    } catch (err) {
      hasErrors = true
      errorMsg = err instanceof Error ? err.message : String(err)
    }

    // 2. Scan User-specific applications
    const userDir =
      this.customUserDir ||
      (process.env.APPDATA
        ? path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs')
        : '')

    if (userDir) {
      try {
        await this.scanDirectory(userDir, 'user', appsMap)
      } catch (err) {
        hasErrors = true
        if (!errorMsg) errorMsg = err instanceof Error ? err.message : String(err)
      }
    }

    const apps = Array.from(appsMap.values()).slice(0, this.maxAppsLimit)

    return {
      status: hasErrors && apps.length === 0 ? 'failed' : hasErrors ? 'partial' : 'completed',
      apps,
      totalCount: apps.length,
      isComplete: !hasErrors,
      source: 'windows_start_menu',
      acquiredAt: Date.now(),
      cached: false,
      error: errorMsg
    }
  }

  /**
   * Recursively scans directory up to max depth 2 for .lnk shortcut files.
   */
  private async scanDirectory(
    dirPath: string,
    scope: 'system' | 'user',
    outMap: Map<string, InstalledApplicationEntry>,
    depth = 0
  ): Promise<void> {
    if (depth > 2 || outMap.size >= this.maxAppsLimit) return
    if (!fs.existsSync(dirPath)) return

    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (outMap.size >= this.maxAppsLimit) break

      const entryName = entry.name
      // Skip hidden files, system files, and uninstall links
      if (
        entryName.startsWith('.') ||
        entryName.toLowerCase() === 'desktop.ini' ||
        entryName.toLowerCase().includes('uninstall') ||
        entryName.toLowerCase().includes('uninstaller')
      ) {
        continue
      }

      const fullPath = path.join(dirPath, entryName)

      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath, scope, outMap, depth + 1)
      } else if (entry.isFile() && entryName.toLowerCase().endsWith('.lnk')) {
        const rawName = entryName.slice(0, -4).trim()
        if (!rawName) continue

        const parentFolderName = path.basename(dirPath)
        const isParentPrograms = parentFolderName.toLowerCase() === 'programs'
        const publisher = !isParentPrograms ? parentFolderName : undefined

        const slugId = `app_${scope}_${rawName.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 48)}`

        // Deduplicate: if already exists, user scope overrides or keeps existing
        if (!outMap.has(slugId)) {
          outMap.set(slugId, {
            id: slugId,
            displayName: rawName,
            publisher,
            category: this.inferCategory(rawName, publisher),
            installScope: scope,
            locationHint: publisher
          })
        }
      }
    }
  }

  private inferCategory(appName: string, publisher?: string): string {
    const text = `${appName} ${publisher || ''}`.toLowerCase()
    if (text.includes('chrome') || text.includes('edge') || text.includes('firefox') || text.includes('browser')) {
      return 'Browser'
    }
    if (text.includes('code') || text.includes('studio') || text.includes('terminal') || text.includes('git')) {
      return 'Developer Tools'
    }
    if (text.includes('word') || text.includes('excel') || text.includes('powerpoint') || text.includes('office')) {
      return 'Productivity'
    }
    if (text.includes('media') || text.includes('player') || text.includes('music') || text.includes('video')) {
      return 'Multimedia'
    }
    if (text.includes('tool') || text.includes('settings') || text.includes('system') || text.includes('maintenance')) {
      return 'Utilities'
    }
    return 'General'
  }
}
