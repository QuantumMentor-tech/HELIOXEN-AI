/**
 * HELIOXEN AI — Step 29: File Operations Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { FileOperationsManager } from '../../src/main/filesystem/FileOperationsManager'

describe('Step 29: File Operations Manager', () => {
  let tempBaseDir: string
  let manager: FileOperationsManager

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-ops-test-'))
    manager = new FileOperationsManager()

    // Populate test files
    fs.writeFileSync(path.join(tempBaseDir, 'notes.txt'), 'Hello world notes')
    fs.writeFileSync(path.join(tempBaseDir, 'report.md'), '# Title\nMarkdown content')

    const subDir = path.join(tempBaseDir, 'subfolder')
    fs.mkdirSync(subDir, { recursive: true })
    fs.writeFileSync(path.join(subDir, 'nested.json'), '{"key":"value"}')
  })

  afterEach(() => {
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe('listDirectory & getFileMetadata', () => {
    it('lists files and directories within authorized root', async () => {
      const result = await manager.listDirectory({ rootPath: tempBaseDir, maxDepth: 2 })

      expect(result.rootPath).toBe(path.normalize(tempBaseDir))
      expect(result.items.length).toBeGreaterThanOrEqual(3)

      const names = result.items.map((i) => i.name)
      expect(names).toContain('notes.txt')
      expect(names).toContain('report.md')
      expect(names).toContain('subfolder')
    })

    it('retrieves accurate file metadata', async () => {
      const meta = await manager.getFileMetadata(tempBaseDir, path.join(tempBaseDir, 'notes.txt'))

      expect(meta.name).toBe('notes.txt')
      expect(meta.type).toBe('file')
      expect(meta.extension).toBe('txt')
      expect(meta.sizeBytes).toBeGreaterThan(0)
      expect(meta.modifiedAt).toBeGreaterThan(0)
    })
  })

  describe('searchFiles', () => {
    it('searches files matching query substring and extension', async () => {
      const searchRes = await manager.searchFiles({
        rootPath: tempBaseDir,
        query: 'report',
        extension: 'md'
      })

      expect(searchRes.totalMatches).toBe(1)
      expect(searchRes.matches[0].name).toBe('report.md')
    })
  })

  describe('readTextFile', () => {
    it('reads UTF-8 text file content with size bounding', async () => {
      const readRes = await manager.readTextFile({
        rootPath: tempBaseDir,
        filePath: path.join(tempBaseDir, 'notes.txt')
      })

      expect(readRes.content).toBe('Hello world notes')
      expect(readRes.byteLength).toBe(17)
      expect(readRes.isTruncated).toBe(false)
      expect(readRes.encoding).toBe('utf8')
    })

    it('truncates content when file size exceeds maxBytes limit', async () => {
      const readRes = await manager.readTextFile({
        rootPath: tempBaseDir,
        filePath: path.join(tempBaseDir, 'notes.txt'),
        maxBytes: 5
      })

      expect(readRes.content).toBe('Hello')
      expect(readRes.byteLength).toBe(5)
      expect(readRes.isTruncated).toBe(true)
    })
  })

  describe('createFile', () => {
    it('safely creates new file in authorized root via atomic write', async () => {
      const newPath = path.join(tempBaseDir, 'created.txt')
      const created = await manager.createFile({
        rootPath: tempBaseDir,
        filePath: newPath,
        content: 'Brand new file content'
      })

      expect(created.filePath).toBe(path.normalize(newPath))
      expect(fs.existsSync(newPath)).toBe(true)
      expect(fs.readFileSync(newPath, 'utf8')).toBe('Brand new file content')
    })

    it('rejects file creation if target already exists without overwrite flag', async () => {
      const existingPath = path.join(tempBaseDir, 'notes.txt')

      await expect(
        manager.createFile({
          rootPath: tempBaseDir,
          filePath: existingPath,
          content: 'Conflicting content'
        })
      ).rejects.toThrow(/already exists/)
    })

    it('overwrites existing file when overwrite: true is explicitly provided', async () => {
      const existingPath = path.join(tempBaseDir, 'notes.txt')
      await manager.createFile({
        rootPath: tempBaseDir,
        filePath: existingPath,
        content: 'Replaced content',
        overwrite: true
      })

      expect(fs.readFileSync(existingPath, 'utf8')).toBe('Replaced content')
    })
  })

  describe('copyFile and moveFile', () => {
    it('copies file to destination and preserves source', async () => {
      const src = path.join(tempBaseDir, 'notes.txt')
      const dst = path.join(tempBaseDir, 'notes_backup.txt')

      const copyRes = await manager.copyFile({
        rootPath: tempBaseDir,
        sourcePath: src,
        destinationPath: dst
      })

      expect(copyRes.destinationPath).toBe(path.normalize(dst))
      expect(fs.existsSync(src)).toBe(true)
      expect(fs.existsSync(dst)).toBe(true)
      expect(fs.readFileSync(dst, 'utf8')).toBe('Hello world notes')
    })

    it('rejects move if destination already exists without overwrite', async () => {
      const src = path.join(tempBaseDir, 'notes.txt')
      const dst = path.join(tempBaseDir, 'report.md')

      await expect(
        manager.moveFile({
          rootPath: tempBaseDir,
          sourcePath: src,
          destinationPath: dst
        })
      ).rejects.toThrow(/already exists/)
    })

    it('moves file to new location successfully', async () => {
      const src = path.join(tempBaseDir, 'notes.txt')
      const dst = path.join(tempBaseDir, 'renamed_notes.txt')

      await manager.moveFile({
        rootPath: tempBaseDir,
        sourcePath: src,
        destinationPath: dst
      })

      expect(fs.existsSync(src)).toBe(false)
      expect(fs.existsSync(dst)).toBe(true)
      expect(fs.readFileSync(dst, 'utf8')).toBe('Hello world notes')
    })
  })
})

