/**
 * HELIOXEN AI — Step 28: Installed Application Discovery Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { InstalledAppDiscoveryManager } from '../../src/main/telemetry/InstalledAppDiscoveryManager'
import { InstalledAppsResultSchema } from '../../src/shared/telemetry/contracts'

describe('Step 28: Installed Application Discovery', () => {
  let tempBaseDir: string
  let mockSystemDir: string
  let mockUserDir: string

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-apps-test-'))
    mockSystemDir = path.join(tempBaseDir, 'system_programs')
    mockUserDir = path.join(tempBaseDir, 'user_programs')

    fs.mkdirSync(mockSystemDir, { recursive: true })
    fs.mkdirSync(mockUserDir, { recursive: true })

    // Create mock shortcuts in system directory
    fs.writeFileSync(path.join(mockSystemDir, 'Google Chrome.lnk'), 'dummy lnk content')
    fs.writeFileSync(path.join(mockSystemDir, 'Microsoft Edge.lnk'), 'dummy lnk content')

    // Create subfolder with publisher
    const codeFolder = path.join(mockSystemDir, 'Visual Studio Code')
    fs.mkdirSync(codeFolder, { recursive: true })
    fs.writeFileSync(path.join(codeFolder, 'Visual Studio Code.lnk'), 'dummy lnk content')

    // Create user shortcut
    fs.writeFileSync(path.join(mockUserDir, 'Spotify.lnk'), 'dummy lnk content')

    // Create desktop.ini and uninstall shortcut to verify filtering
    fs.writeFileSync(path.join(mockSystemDir, 'desktop.ini'), 'system file')
    fs.writeFileSync(path.join(mockSystemDir, 'Uninstall Chrome.lnk'), 'uninstaller')
  })

  afterEach(() => {
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error
    }
  })

  it('enumerates registered applications from system and user directories', async () => {
    const manager = new InstalledAppDiscoveryManager({
      customSystemProgramsDir: mockSystemDir,
      customUserProgramsDir: mockUserDir,
      cacheTtlMs: 10_000
    })

    const result = await manager.getInstalledApps()

    expect(result.status).toBe('completed')
    expect(result.isComplete).toBe(true)
    expect(result.totalCount).toBe(4) // Chrome, Edge, VS Code, Spotify (desktop.ini and uninstall excluded)
    expect(result.source).toBe('windows_start_menu')

    const names = result.apps.map((a) => a.displayName)
    expect(names).toContain('Google Chrome')
    expect(names).toContain('Microsoft Edge')
    expect(names).toContain('Visual Studio Code')
    expect(names).toContain('Spotify')

    // Verify publisher and category inference
    const vsCode = result.apps.find((a) => a.displayName === 'Visual Studio Code')
    expect(vsCode?.publisher).toBe('Visual Studio Code')
    expect(vsCode?.category).toBe('Developer Tools')

    const chrome = result.apps.find((a) => a.displayName === 'Google Chrome')
    expect(chrome?.category).toBe('Browser')

    // Verify schema validation
    const parseResult = InstalledAppsResultSchema.safeParse(result)
    expect(parseResult.success).toBe(true)
  })

  it('filters applications by search query', async () => {
    const manager = new InstalledAppDiscoveryManager({
      customSystemProgramsDir: mockSystemDir,
      customUserProgramsDir: mockUserDir
    })

    const searchResult = await manager.getInstalledApps({ query: 'Chrome' })
    expect(searchResult.totalCount).toBe(1)
    expect(searchResult.apps[0].displayName).toBe('Google Chrome')

    const searchMethodResult = await manager.searchInstalledApps('Spotify')
    expect(searchMethodResult.length).toBe(1)
    expect(searchMethodResult[0].displayName).toBe('Spotify')
  })

  it('filters applications by installation scope', async () => {
    const manager = new InstalledAppDiscoveryManager({
      customSystemProgramsDir: mockSystemDir,
      customUserProgramsDir: mockUserDir
    })

    const userApps = await manager.getInstalledApps({ scope: 'user' })
    expect(userApps.totalCount).toBe(1)
    expect(userApps.apps[0].displayName).toBe('Spotify')
    expect(userApps.apps[0].installScope).toBe('user')

    const systemApps = await manager.getInstalledApps({ scope: 'system' })
    expect(systemApps.totalCount).toBe(3)
    expect(systemApps.apps.every((a) => a.installScope === 'system')).toBe(true)
  })

  it('respects in-memory cache TTL and forceRefresh flag', async () => {
    const manager = new InstalledAppDiscoveryManager({
      customSystemProgramsDir: mockSystemDir,
      customUserProgramsDir: mockUserDir,
      cacheTtlMs: 5_000
    })

    const first = await manager.getInstalledApps()
    expect(first.cached).toBe(false)

    const second = await manager.getInstalledApps()
    expect(second.cached).toBe(true)

    const forced = await manager.getInstalledApps({ forceRefresh: true })
    expect(forced.cached).toBe(false)
  })

  it('enforces maximum result limit', async () => {
    const manager = new InstalledAppDiscoveryManager({
      customSystemProgramsDir: mockSystemDir,
      customUserProgramsDir: mockUserDir
    })

    const limited = await manager.getInstalledApps({ limit: 2 })
    expect(limited.totalCount).toBe(2)
    expect(limited.apps.length).toBe(2)
  })
})

