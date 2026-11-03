/**
 * HELIOXEN AI — Step 29: Path Validator Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { PathValidator } from '../../src/shared/filesystem/PathValidator'

describe('Step 29: Path Validator & Containment', () => {
  let tempBaseDir: string

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-path-test-'))
  })

  afterEach(() => {
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('validates paths contained within authorized root', () => {
    const validSubfile = path.join(tempBaseDir, 'docs', 'readme.txt')
    const result = PathValidator.validateContainment(validSubfile, tempBaseDir)

    expect(result.valid).toBe(true)
    expect(result.canonicalPath).toBe(path.normalize(validSubfile))
    expect(result.relativePath).toBe(path.join('docs', 'readme.txt'))
  })

  it('rejects path traversal attempting to escape root using ..', () => {
    const traversalPath = path.join(tempBaseDir, '..', 'other_folder', 'secret.txt')
    const result = PathValidator.validateContainment(traversalPath, tempBaseDir)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('Path traversal detected')
  })

  it('rejects sibling directory prefix confusion attack', () => {
    // E.g. root is /tmp/root, target is /tmp/root_evil/file.txt
    const siblingPath = `${tempBaseDir}_evil${path.sep}file.txt`
    const result = PathValidator.validateContainment(siblingPath, tempBaseDir)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('Path traversal detected')
  })

  it('rejects protected operating system directories', () => {
    const winDir = process.platform === 'win32'
      ? (process.env.SystemRoot || 'C:\\Windows')
      : '/etc'

    const targetSysPath = path.join(winDir, 'system.ini')
    const result = PathValidator.validateContainment(targetSysPath, winDir)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('protected system directory')
  })

  it('rejects Windows reserved device names in filenames', () => {
    const reservedPath = path.join(tempBaseDir, 'CON.txt')
    const result = PathValidator.validateContainment(reservedPath, tempBaseDir)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('reserved operating system device name')
  })

  it('rejects illegal characters in filenames', () => {
    const illegalPath = path.join(tempBaseDir, 'bad*name?.txt')
    const result = PathValidator.validateContainment(illegalPath, tempBaseDir)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('contains prohibited characters')
  })

  it('rejects symbolic links that resolve outside authorized root', () => {
    const externalTargetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-ext-'))
    const externalFile = path.join(externalTargetDir, 'secret.txt')
    fs.writeFileSync(externalFile, 'secret data')

    const symlinkPath = path.join(tempBaseDir, 'link_to_external.txt')
    try {
      fs.symlinkSync(externalFile, symlinkPath)
    } catch {
      // Symlinks may require admin privilege on Windows, skip if unsupported
      return
    }

    const result = PathValidator.validateContainment(symlinkPath, tempBaseDir)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Symlink escape detected')

    fs.rmSync(externalTargetDir, { recursive: true, force: true })
  })
})

