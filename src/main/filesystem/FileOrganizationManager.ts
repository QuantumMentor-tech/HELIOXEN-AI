/**
 * HELIOXEN AI — Step 29: File Organization Manager
 * Reversible, transaction-tracked file organization workflow.
 * Proposes preview plans without changes, requires approval, and provides verified undo.
 */

import fs from 'fs'
import path from 'path'
import { PathValidator } from '../../shared/filesystem/PathValidator'
import {
  OrganizationPlan,
  OrganizationPlanRequest,
  OrganizationPlanOperation,
  OrganizationApplyRequest,
  OrganizationApplyResult,
  OrganizationUndoRequest,
  OrganizationUndoResult,
  TransactionManifest,
  TransactionRecordedOperation
} from '../../shared/filesystem/types'

const EXTENSION_CATEGORIES: Record<string, string> = {
  // Documents
  txt: 'Documents',
  md: 'Documents',
  pdf: 'Documents',
  docx: 'Documents',
  doc: 'Documents',
  xlsx: 'Documents',
  pptx: 'Documents',
  rtf: 'Documents',

  // Images
  png: 'Images',
  jpg: 'Images',
  jpeg: 'Images',
  gif: 'Images',
  webp: 'Images',
  svg: 'Images',
  bmp: 'Images',

  // Audio / Video
  mp3: 'Audio',
  wav: 'Audio',
  flac: 'Audio',
  mp4: 'Video',
  mkv: 'Video',
  mov: 'Video',

  // Archives
  zip: 'Archives',
  rar: 'Archives',
  '7z': 'Archives',
  tar: 'Archives',
  gz: 'Archives',

  // Code
  js: 'Code',
  ts: 'Code',
  py: 'Code',
  json: 'Code',
  html: 'Code',
  css: 'Code',
  cpp: 'Code',
  cs: 'Code'
}

export class FileOrganizationManager {
  private readonly transactions = new Map<string, TransactionManifest>()

  /**
   * Generates a preview plan for organizing files without modifying anything.
   */
  public async createOrganizationPlan(request: OrganizationPlanRequest): Promise<OrganizationPlan> {
    const rootCheck = PathValidator.validateContainment(request.rootPath, request.rootPath)
    if (!rootCheck.valid || !rootCheck.canonicalPath) {
      throw new Error(rootCheck.error || 'Invalid root path for organization')
    }

    const canonicalRoot = rootCheck.canonicalPath
    let dirents: fs.Dirent[]
    try {
      dirents = await fs.promises.readdir(canonicalRoot, { withFileTypes: true })
    } catch (err) {
      throw new Error(`Failed to read directory for organization: ${err instanceof Error ? err.message : String(err)}`)
    }

    const operations: OrganizationPlanOperation[] = []
    let collisionCount = 0
    let reversibleCount = 0

    for (const dirent of dirents) {
      if (operations.length >= 200) break
      // Only organize files at the root level, ignore existing directories
      if (!dirent.isFile()) continue

      const fileName = dirent.name
      // Skip system or hidden files
      if (fileName.startsWith('.') || fileName.toLowerCase() === 'desktop.ini') continue

      const srcPath = path.join(canonicalRoot, fileName)
      let targetSubfolder: string

      if (request.strategy === 'by_extension') {
        const ext = path.extname(fileName).slice(1).toLowerCase()
        targetSubfolder = EXTENSION_CATEGORIES[ext] || 'Other'
      } else if (request.strategy === 'by_date') {
        let mtime = Date.now()
        try {
          const stat = await fs.promises.stat(srcPath)
          mtime = stat.mtimeMs
        } catch {
          // ignore
        }
        const d = new Date(mtime)
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        targetSubfolder = `${year}-${month}`
      } else {
        // by_category
        const ext = path.extname(fileName).slice(1).toLowerCase()
        targetSubfolder = EXTENSION_CATEGORIES[ext] || 'Miscellaneous'
      }

      const dstDir = path.join(canonicalRoot, targetSubfolder)
      const dstPath = path.join(dstDir, fileName)

      // Containment validation
      const srcValid = PathValidator.validateContainment(srcPath, canonicalRoot)
      const dstValid = PathValidator.validateContainment(dstPath, canonicalRoot)
      if (!srcValid.valid || !dstValid.valid) continue

      const collision = fs.existsSync(dstPath)
      if (collision) {
        collisionCount += 1
      } else {
        reversibleCount += 1
      }

      operations.push({
        id: `op_${operations.length + 1}`,
        type: 'move',
        sourcePath: srcPath,
        destinationPath: dstPath,
        relativeSource: fileName,
        relativeDestination: path.join(targetSubfolder, fileName),
        reason: `Move to ${targetSubfolder} based on ${request.strategy} strategy`,
        isReversible: !collision,
        collision
      })
    }

    return {
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      rootPath: canonicalRoot,
      strategy: request.strategy,
      operations,
      totalFiles: operations.length,
      reversibleCount,
      collisionCount,
      createdAt: Date.now()
    }
  }

  /**
   * Applies an approved organization plan under transaction tracking.
   */
  public async applyOrganizationPlan(request: OrganizationApplyRequest): Promise<OrganizationApplyResult> {
    const plan = request.plan
    const rootCheck = PathValidator.validateContainment(plan.rootPath, plan.rootPath)
    if (!rootCheck.valid || !rootCheck.canonicalPath) {
      throw new Error(rootCheck.error || 'Invalid root path for organization')
    }

    const canonicalRoot = rootCheck.canonicalPath
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const recordedOps: TransactionRecordedOperation[] = []
    const errors: string[] = []
    let appliedCount = 0
    let failedCount = 0

    for (const op of plan.operations) {
      // Revalidate containment immediately before execution
      const srcCheck = PathValidator.validateContainment(op.sourcePath, canonicalRoot)
      const dstCheck = PathValidator.validateContainment(op.destinationPath, canonicalRoot)
      if (!srcCheck.valid || !srcCheck.canonicalPath || !dstCheck.valid || !dstCheck.canonicalPath) {
        errors.push(`Validation failed for operation "${op.id}"`)
        failedCount += 1
        recordedOps.push({
          id: op.id,
          type: op.type,
          sourcePath: op.sourcePath,
          destinationPath: op.destinationPath,
          originalMtime: 0,
          originalSizeBytes: 0,
          status: 'failed',
          error: 'Containment check failed'
        })
        break
      }

      // Check source exists
      if (!fs.existsSync(srcCheck.canonicalPath)) {
        errors.push(`Source file not found for operation "${op.id}": "${srcCheck.canonicalPath}"`)
        failedCount += 1
        recordedOps.push({
          id: op.id,
          type: op.type,
          sourcePath: srcCheck.canonicalPath,
          destinationPath: dstCheck.canonicalPath,
          originalMtime: 0,
          originalSizeBytes: 0,
          status: 'failed',
          error: 'Source not found'
        })
        break
      }

      // Check destination does not exist (no silent overwrites!)
      if (fs.existsSync(dstCheck.canonicalPath)) {
        errors.push(`Destination collision for operation "${op.id}": "${dstCheck.canonicalPath}"`)
        failedCount += 1
        recordedOps.push({
          id: op.id,
          type: op.type,
          sourcePath: srcCheck.canonicalPath,
          destinationPath: dstCheck.canonicalPath,
          originalMtime: 0,
          originalSizeBytes: 0,
          status: 'failed',
          error: 'Destination already exists'
        })
        break
      }

      let stat: fs.Stats
      try {
        stat = await fs.promises.stat(srcCheck.canonicalPath)
      } catch (err) {
        errors.push(`Stat failed for "${srcCheck.canonicalPath}"`)
        failedCount += 1
        break
      }

      // Ensure destination directory exists
      const dstDir = path.dirname(dstCheck.canonicalPath)
      await fs.promises.mkdir(dstDir, { recursive: true })

      try {
        await fs.promises.rename(srcCheck.canonicalPath, dstCheck.canonicalPath)
        appliedCount += 1
        recordedOps.push({
          id: op.id,
          type: op.type,
          sourcePath: srcCheck.canonicalPath,
          destinationPath: dstCheck.canonicalPath,
          originalMtime: Math.floor(stat.mtimeMs),
          originalSizeBytes: stat.size,
          status: 'applied',
          appliedAt: Date.now()
        })
      } catch (err: any) {
        errors.push(`Move failed for "${srcCheck.canonicalPath}": ${err.message}`)
        failedCount += 1
        recordedOps.push({
          id: op.id,
          type: op.type,
          sourcePath: srcCheck.canonicalPath,
          destinationPath: dstCheck.canonicalPath,
          originalMtime: Math.floor(stat.mtimeMs),
          originalSizeBytes: stat.size,
          status: 'failed',
          error: err.message
        })
        break // Stop on failure
      }
    }

    const state =
      failedCount > 0 && appliedCount > 0
        ? 'partially_applied'
        : failedCount > 0
          ? 'failed'
          : 'applied'

    const manifest: TransactionManifest = {
      transactionId,
      rootPath: canonicalRoot,
      planId: plan.id,
      strategy: plan.strategy,
      state,
      operations: recordedOps,
      createdAt: Date.now(),
      completedAt: Date.now()
    }

    this.transactions.set(transactionId, manifest)

    return {
      transactionId,
      status: state,
      appliedCount,
      failedCount,
      totalCount: plan.operations.length,
      errors: errors.length > 0 ? errors : undefined,
      appliedAt: Date.now()
    }
  }

  /**
   * Reverses an applied organization transaction.
   */
  public async undoOrganization(request: OrganizationUndoRequest): Promise<OrganizationUndoResult> {
    const manifest = this.transactions.get(request.transactionId)
    if (!manifest) {
      throw new Error(`Transaction manifest not found for id: "${request.transactionId}"`)
    }

    if (manifest.state !== 'applied' && manifest.state !== 'partially_applied') {
      throw new Error(`Transaction cannot be undone from state: "${manifest.state}"`)
    }

    let restoredCount = 0
    let failedCount = 0
    const errors: string[] = []

    // Process in reverse order
    const appliedOps = manifest.operations.filter((op) => op.status === 'applied')

    for (let i = appliedOps.length - 1; i >= 0; i--) {
      const op = appliedOps[i]

      // Revalidate containment
      const srcCheck = PathValidator.validateContainment(op.sourcePath, manifest.rootPath)
      const dstCheck = PathValidator.validateContainment(op.destinationPath, manifest.rootPath)
      if (!srcCheck.valid || !srcCheck.canonicalPath || !dstCheck.valid || !dstCheck.canonicalPath) {
        errors.push(`Undo containment failed for operation "${op.id}"`)
        failedCount += 1
        continue
      }

      // Check current file at destinationPath exists
      if (!fs.existsSync(dstCheck.canonicalPath)) {
        errors.push(`Undo blocked: File at destination no longer exists: "${dstCheck.canonicalPath}"`)
        failedCount += 1
        continue
      }

      // Check original source path is available (must not overwrite unexpected new file)
      if (fs.existsSync(srcCheck.canonicalPath)) {
        errors.push(`Undo blocked: File already exists at original path: "${srcCheck.canonicalPath}"`)
        failedCount += 1
        continue
      }

      // Verify file modified time or size has not drastically changed
      try {
        const curStat = await fs.promises.stat(dstCheck.canonicalPath)
        if (Math.abs(curStat.size - op.originalSizeBytes) > 0) {
          errors.push(`Undo conflict: File size changed since organization for "${dstCheck.canonicalPath}"`)
          failedCount += 1
          continue
        }
      } catch {
        // ignore
      }

      // Move file back from destination to source
      try {
        await fs.promises.rename(dstCheck.canonicalPath, srcCheck.canonicalPath)
        restoredCount += 1
      } catch (err: any) {
        errors.push(`Undo move failed for "${dstCheck.canonicalPath}": ${err.message}`)
        failedCount += 1
      }
    }

    const state =
      restoredCount === appliedOps.length
        ? 'undone'
        : failedCount > 0
          ? 'partially_undone'
          : 'undo_failed'

    // Update manifest
    const updatedManifest: TransactionManifest = {
      ...manifest,
      state,
      undoneAt: Date.now()
    }
    this.transactions.set(request.transactionId, updatedManifest)

    return {
      transactionId: request.transactionId,
      status: state,
      restoredCount,
      failedCount,
      totalCount: appliedOps.length,
      errors: errors.length > 0 ? errors : undefined,
      undoneAt: Date.now()
    }
  }

  /**
   * Retrieves a transaction manifest by id.
   */
  public getTransaction(transactionId: string): TransactionManifest | undefined {
    return this.transactions.get(transactionId)
  }
}

export const fileOrganizationManager = new FileOrganizationManager()

