/**
 * HELIOXEN AI — Step 30: Predefined System Operations Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  SystemOperationManager,
  SystemOperationAdapter
} from '../../src/main/interaction/SystemOperationManager'

describe('Step 30: Predefined System Operations', () => {
  let tempDir: string
  let testFile: string
  let openedPaths: string[]
  let revealedPaths: string[]
  let openedUrls: string[]
  let beeps: number

  const mockAdapter: SystemOperationAdapter = {
    openPath: async (targetPath: string) => {
      openedPaths.push(targetPath)
      return ''
    },
    showItemInFolder: (targetPath: string) => {
      revealedPaths.push(targetPath)
    },
    openExternal: async (url: string) => {
      openedUrls.push(url)
    },
    beep: () => {
      beeps++
    },
    getPrimaryDisplay: () => ({
      id: 1,
      bounds: { x: 0, y: 0, width: 2560, height: 1440 },
      workArea: { x: 0, y: 0, width: 2560, height: 1400 },
      scaleFactor: 1.25
    }),
    getAllDisplays: () => [
      { id: 1, bounds: { x: 0, y: 0, width: 2560, height: 1440 } }
    ]
  }

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-sys-test-'))
    testFile = path.join(tempDir, 'sample.txt')
    fs.writeFileSync(testFile, 'test content')

    openedPaths = []
    revealedPaths = []
    openedUrls = []
    beeps = 0
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('opens an existing authorized path in default system application', async () => {
    const manager = new SystemOperationManager(mockAdapter)
    const result = await manager.openPath({ targetPath: testFile })

    expect(result.success).toBe(true)
    expect(result.targetPath).toBe(path.resolve(testFile))
    expect(openedPaths).toEqual([path.resolve(testFile)])
  })

  it('rejects attempts to open protected Windows system directories', async () => {
    const manager = new SystemOperationManager(mockAdapter)

    await expect(
      manager.openPath({ targetPath: 'C:\\Windows\\System32\\cmd.exe' })
    ).rejects.toThrow(/Direct access to protected system path.*is prohibited/)

    await expect(
      manager.openPath({ targetPath: 'C:\\Program Files\\malware.exe' })
    ).rejects.toThrow(/Direct access to protected system path.*is prohibited/)

    expect(openedPaths.length).toBe(0)
  })

  it('rejects access referencing reserved Windows device names', async () => {
    const manager = new SystemOperationManager(mockAdapter)

    await expect(
      manager.openPath({ targetPath: 'CON' })
    ).rejects.toThrow(/Path references reserved device name/)

    await expect(
      manager.openPath({ targetPath: 'NUL' })
    ).rejects.toThrow(/Path references reserved device name/)

    await expect(
      manager.openPath({ targetPath: 'COM1' })
    ).rejects.toThrow(/Path references reserved device name/)
  })

  it('reveals a verified file in Windows File Explorer', async () => {
    const manager = new SystemOperationManager(mockAdapter)
    const result = await manager.showInFolder({ targetPath: testFile })

    expect(result.success).toBe(true)
    expect(result.targetPath).toBe(path.resolve(testFile))
    expect(revealedPaths).toEqual([path.resolve(testFile)])
  })

  it('opens validated HTTPS and HTTP URLs in default browser', async () => {
    const manager = new SystemOperationManager(mockAdapter)
    const result = await manager.openExternalUrl({ url: 'https://www.google.com/search?q=helioxen' })

    expect(result.success).toBe(true)
    expect(result.url).toBe('https://www.google.com/search?q=helioxen')
    expect(result.domain).toBe('www.google.com')
    expect(openedUrls).toEqual(['https://www.google.com/search?q=helioxen'])
  })

  it('strictly rejects non-web or dangerous URL schemes', async () => {
    const manager = new SystemOperationManager(mockAdapter)

    // file: protocol
    await expect(
      manager.openExternalUrl({ url: 'file:///C:/Windows/System32/calc.exe' })
    ).rejects.toThrow(/Only http: and https: protocols are permitted/)

    // javascript: protocol
    await expect(
      manager.openExternalUrl({ url: 'javascript:alert(1)' })
    ).rejects.toThrow(/Only http: and https: protocols are permitted/)

    // data: protocol
    await expect(
      manager.openExternalUrl({ url: 'data:text/html,<script>evil()</script>' })
    ).rejects.toThrow(/Only http: and https: protocols are permitted/)

    expect(openedUrls.length).toBe(0)
  })

  it('emits a standard system alert sound', () => {
    const manager = new SystemOperationManager(mockAdapter)
    const result = manager.systemAlertBeep()

    expect(result.success).toBe(true)
    expect(beeps).toBe(1)
  })

  it('queries display metrics with safe screen boundaries and scale factor', () => {
    const manager = new SystemOperationManager(mockAdapter)
    const result = manager.getDisplayMetrics()

    expect(result.primaryDisplay.bounds.width).toBe(2560)
    expect(result.primaryDisplay.scaleFactor).toBe(1.25)
    expect(result.allDisplaysCount).toBe(1)
  })
})

