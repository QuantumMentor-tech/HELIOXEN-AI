/**
 * HELIOXEN AI — Step 29: File Operations Manager
 * Safe, validated, non-destructive file operations bounded by authorized directory roots.
 */

import fs from 'fs'
import path from 'path'
import { PathValidator } from '../../shared/filesystem/PathValidator'
import {
  DirectoryListingRequest,
  DirectoryListingResult,
  FileMetadata,
  FileSearchRequest,
  FileSearchResult,
  ReadTextFileRequest,
  ReadTextFileResult,
  CreateFileRequest,
  CreateFileResult,
  CopyFileRequest,
  CopyFileResult,
  MoveFileRequest,
  MoveFileResult
} from '../../shared/filesystem/types'

export class FileOperationsManager {
  /**
   * Bounded directory listing within an authorized root.
   */
  public async listDirectory(request: DirectoryListingRequest): Promise<DirectoryListingResult> {
    const targetDir = request.relativePath
      ? path.join(request.rootPath, request.relativePath)
      : request.rootPath

    const check = PathValidator.validateContainment(targetDir, request.rootPath)
    if (!check.valid || !check.canonicalPath) {
      throw new Error(check.error || 'Invalid directory path')
    }

    const maxDepth = request.maxDepth ?? 1
    const limit = Math.min(request.limit ?? 100, 500)
    const items: FileMetadata[] = []
    let isTruncated = false

    const traverse = async (currentDir: string, currentDepth: number): Promise<void> => {
      if (currentDepth > maxDepth || items.length >= limit) {
        if (items.length >= limit) isTruncated = true
        return
      }

      let dirents: fs.Dirent[]
      try {
        dirents = await fs.promises.readdir(currentDir, { withFileTypes: true })
      } catch {
        return
      }

      for (const dirent of dirents) {
        if (items.length >= limit) {
          isTruncated = true
          break
        }

        const fullPath = path.join(currentDir, dirent.name)
        const containment = PathValidator.validateContainment(fullPath, request.rootPath)
        if (!containment.valid || !containment.canonicalPath) continue

        let type: FileMetadata['type'] = 'other'
        if (dirent.isFile()) type = 'file'
        else if (dirent.isDirectory()) type = 'directory'
        else if (dirent.isSymbolicLink()) type = 'symlink'

        let stat: fs.Stats | undefined
        try {
          stat = await fs.promises.lstat(fullPath)
        } catch {
          // If lstat fails, skip entry
          continue
        }

        const ext = type === 'file' ? path.extname(dirent.name).slice(1).toLowerCase() : undefined

        items.push({
          name: dirent.name,
          path: containment.canonicalPath,
          relativePath: containment.relativePath || dirent.name,
          type,
          sizeBytes: stat.size,
          modifiedAt: Math.floor(stat.mtimeMs),
          createdAt: Math.floor(stat.birthtimeMs || stat.ctimeMs),
          extension: ext,
          isReadOnly: Boolean((stat.mode & 0o200) === 0)
        })

        if (type === 'directory' && currentDepth < maxDepth) {
          await traverse(fullPath, currentDepth + 1)
        }
      }
    }

    await traverse(check.canonicalPath, 0)

    return {
      rootPath: check.canonicalPath,
      items,
      totalCount: items.length,
      isTruncated,
      acquiredAt: Date.now()
    }
  }

  /**
   * Retrieves metadata for an authorized file.
   */
  public async getFileMetadata(rootPath: string, filePath: string): Promise<FileMetadata> {
    const check = PathValidator.validateContainment(filePath, rootPath)
    if (!check.valid || !check.canonicalPath) {
      throw new Error(check.error || 'Invalid file path')
    }

    const stat = await fs.promises.lstat(check.canonicalPath)
    let type: FileMetadata['type'] = 'other'
    if (stat.isFile()) type = 'file'
    else if (stat.isDirectory()) type = 'directory'
    else if (stat.isSymbolicLink()) type = 'symlink'

    const ext = type === 'file' ? path.extname(check.canonicalPath).slice(1).toLowerCase() : undefined

    return {
      name: path.basename(check.canonicalPath),
      path: check.canonicalPath,
      relativePath: check.relativePath || path.basename(check.canonicalPath),
      type,
      sizeBytes: stat.size,
      modifiedAt: Math.floor(stat.mtimeMs),
      createdAt: Math.floor(stat.birthtimeMs || stat.ctimeMs),
      extension: ext,
      isReadOnly: Boolean((stat.mode & 0o200) === 0)
    }
  }

  /**
   * Searches for files within an authorized root directory.
   */
  public async searchFiles(request: FileSearchRequest): Promise<FileSearchResult> {
    const check = PathValidator.validateContainment(request.rootPath, request.rootPath)
    if (!check.valid || !check.canonicalPath) {
      throw new Error(check.error || 'Invalid search root path')
    }

    const query = request.query ? request.query.toLowerCase() : undefined
    const extension = request.extension ? request.extension.toLowerCase().replace(/^\./, '') : undefined
    const limit = Math.min(request.limit ?? 50, 200)
    const matches: FileMetadata[] = []

    const searchDir = async (dir: string, depth: number): Promise<void> => {
      if (depth > 5 || matches.length >= limit) return

      let dirents: fs.Dirent[]
      try {
        dirents = await fs.promises.readdir(dir, { withFileTypes: true })
      } catch {
        return
      }

      for (const dirent of dirents) {
        if (matches.length >= limit) break

        const fullPath = path.join(dir, dirent.name)
        const containment = PathValidator.validateContainment(fullPath, request.rootPath)
        if (!containment.valid || !containment.canonicalPath) continue

        if (dirent.isDirectory()) {
          await searchDir(fullPath, depth + 1)
        } else if (dirent.isFile()) {
          const name = dirent.name.toLowerCase()
          const fileExt = path.extname(dirent.name).slice(1).toLowerCase()

          if (query && !name.includes(query)) continue
          if (extension && fileExt !== extension) continue

          const stat = await fs.promises.lstat(fullPath)
          if (request.minSizeBytes !== undefined && stat.size < request.minSizeBytes) continue
          if (request.maxSizeBytes !== undefined && stat.size > request.maxSizeBytes) continue

          matches.push({
            name: dirent.name,
            path: containment.canonicalPath,
            relativePath: containment.relativePath || dirent.name,
            type: 'file',
            sizeBytes: stat.size,
            modifiedAt: Math.floor(stat.mtimeMs),
            createdAt: Math.floor(stat.birthtimeMs || stat.ctimeMs),
            extension: fileExt,
            isReadOnly: Boolean((stat.mode & 0o200) === 0)
          })
        }
      }
    }

    await searchDir(check.canonicalPath, 0)

    return {
      rootPath: check.canonicalPath,
      matches,
      totalMatches: matches.length,
      acquiredAt: Date.now()
    }
  }

  /**
   * Safely reads content from an authorized text file with size bounding.
   */
  public async readTextFile(request: ReadTextFileRequest): Promise<ReadTextFileResult> {
    const check = PathValidator.validateContainment(request.filePath, request.rootPath)
    if (!check.valid || !check.canonicalPath) {
      throw new Error(check.error || 'Invalid file path')
    }

    const stat = await fs.promises.stat(check.canonicalPath)
    if (!stat.isFile()) {
      throw new Error(`Target "${check.canonicalPath}" is not a regular file`)
    }

    const maxBytes = Math.min(request.maxBytes ?? 1024 * 1024, 10 * 1024 * 1024) // Max 10MB
    const buffer = Buffer.alloc(Math.min(stat.size, maxBytes))

    const fd = await fs.promises.open(check.canonicalPath, 'r')
    try {
      const { bytesRead } = await fd.read(buffer, 0, buffer.length, 0)
      const content = buffer.subarray(0, bytesRead).toString('utf8')
      const isTruncated = stat.size > maxBytes

      return {
        filePath: check.canonicalPath,
        content,
        byteLength: bytesRead,
        isTruncated,
        encoding: 'utf8',
        readAt: Date.now()
      }
    } finally {
      await fd.close()
    }
  }

  /**
   * Safely creates a file via atomic write. Default overwrite policy is REJECT.
   */
  public async createFile(request: CreateFileRequest): Promise<CreateFileResult> {
    const check = PathValidator.validateContainment(request.filePath, request.rootPath)
    if (!check.valid || !check.canonicalPath) {
      throw new Error(check.error || 'Invalid target file path')
    }

    if (fs.existsSync(check.canonicalPath) && !request.overwrite) {
      throw new Error(`File collision: Destination file already exists: "${check.canonicalPath}"`)
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(check.canonicalPath)
    await fs.promises.mkdir(parentDir, { recursive: true })

    // Atomic write via temp sibling file
    const tempFile = path.join(
      parentDir,
      `.tmp_${path.basename(check.canonicalPath)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    )

    await fs.promises.writeFile(tempFile, request.content, 'utf8')
    await fs.promises.rename(tempFile, check.canonicalPath)

    const stat = await fs.promises.stat(check.canonicalPath)

    return {
      filePath: check.canonicalPath,
      sizeBytes: stat.size,
      createdAt: Math.floor(stat.birthtimeMs || stat.ctimeMs)
    }
  }

  /**
   * Safely copies an authorized file. Default overwrite policy is REJECT.
   */
  public async copyFile(request: CopyFileRequest): Promise<CopyFileResult> {
    const srcCheck = PathValidator.validateContainment(request.sourcePath, request.rootPath)
    if (!srcCheck.valid || !srcCheck.canonicalPath) {
      throw new Error(srcCheck.error || 'Invalid source path')
    }

    const dstCheck = PathValidator.validateContainment(request.destinationPath, request.rootPath)
    if (!dstCheck.valid || !dstCheck.canonicalPath) {
      throw new Error(dstCheck.error || 'Invalid destination path')
    }

    if (!fs.existsSync(srcCheck.canonicalPath)) {
      throw new Error(`Source file not found: "${srcCheck.canonicalPath}"`)
    }

    if (fs.existsSync(dstCheck.canonicalPath) && !request.overwrite) {
      throw new Error(`File collision: Destination file already exists: "${dstCheck.canonicalPath}"`)
    }

    const parentDir = path.dirname(dstCheck.canonicalPath)
    await fs.promises.mkdir(parentDir, { recursive: true })

    const flags = request.overwrite ? 0 : fs.constants.COPYFILE_EXCL
    await fs.promises.copyFile(srcCheck.canonicalPath, dstCheck.canonicalPath, flags)

    const stat = await fs.promises.stat(dstCheck.canonicalPath)

    return {
      sourcePath: srcCheck.canonicalPath,
      destinationPath: dstCheck.canonicalPath,
      sizeBytes: stat.size,
      copiedAt: Date.now()
    }
  }

  /**
   * Safely moves or renames an authorized file. Default overwrite policy is REJECT.
   */
  public async moveFile(request: MoveFileRequest): Promise<MoveFileResult> {
    const srcCheck = PathValidator.validateContainment(request.sourcePath, request.rootPath)
    if (!srcCheck.valid || !srcCheck.canonicalPath) {
      throw new Error(srcCheck.error || 'Invalid source path')
    }

    const dstCheck = PathValidator.validateContainment(request.destinationPath, request.rootPath)
    if (!dstCheck.valid || !dstCheck.canonicalPath) {
      throw new Error(dstCheck.error || 'Invalid destination path')
    }

    if (!fs.existsSync(srcCheck.canonicalPath)) {
      throw new Error(`Source file not found: "${srcCheck.canonicalPath}"`)
    }

    if (fs.existsSync(dstCheck.canonicalPath) && !request.overwrite) {
      throw new Error(`File collision: Destination file already exists: "${dstCheck.canonicalPath}"`)
    }

    const parentDir = path.dirname(dstCheck.canonicalPath)
    await fs.promises.mkdir(parentDir, { recursive: true })

    try {
      await fs.promises.rename(srcCheck.canonicalPath, dstCheck.canonicalPath)
    } catch (err: any) {
      // If cross-volume EXDEV, fallback to copy + unlink
      if (err.code === 'EXDEV') {
        await fs.promises.copyFile(srcCheck.canonicalPath, dstCheck.canonicalPath)
        await fs.promises.unlink(srcCheck.canonicalPath)
      } else {
        throw err
      }
    }

    return {
      sourcePath: srcCheck.canonicalPath,
      destinationPath: dstCheck.canonicalPath,
      movedAt: Date.now()
    }
  }
}

export const fileOperationsManager = new FileOperationsManager()

