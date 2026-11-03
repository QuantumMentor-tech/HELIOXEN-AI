/**
 * HELIOXEN AI — Step 29: Reversible File Organization Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { FileOrganizationManager } from '../../src/main/filesystem/FileOrganizationManager'

describe('Step 29: Reversible File Organization', () => {
  let tempBaseDir: string
  let manager: FileOrganizationManager

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-org-test-'))
    manager = new FileOrganizationManager()

    // Populate test files
    fs.writeFileSync(path.join(tempBaseDir, 'doc1.pdf'), 'PDF document')
    fs.writeFileSync(path.join(tempBaseDir, 'doc2.txt'), 'Text document')
    fs.writeFileSync(path.join(tempBaseDir, 'photo.png'), 'PNG image')
    fs.writeFileSync(path.join(tempBaseDir, 'script.py'), 'Python script')
  })

  afterEach(() => {
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('generates a preview plan without modifying any filesystem files', async () => {
    const plan = await manager.createOrganizationPlan({
      rootPath: tempBaseDir,
      strategy: 'by_extension'
    })

    expect(plan.id).toBeDefined()
    expect(plan.totalFiles).toBe(4)
    expect(plan.operations.length).toBe(4)
    expect(plan.collisionCount).toBe(0)
    expect(plan.reversibleCount).toBe(4)

    // Verify all original files STILL exist untouched in root
    expect(fs.existsSync(path.join(tempBaseDir, 'doc1.pdf'))).toBe(true)
    expect(fs.existsSync(path.join(tempBaseDir, 'doc2.txt'))).toBe(true)
    expect(fs.existsSync(path.join(tempBaseDir, 'photo.png'))).toBe(true)
    expect(fs.existsSync(path.join(tempBaseDir, 'script.py'))).toBe(true)

    // Verify proposed destinations
    const pdfOp = plan.operations.find((op) => op.relativeSource === 'doc1.pdf')
    expect(pdfOp?.relativeDestination).toBe(path.join('Documents', 'doc1.pdf'))

    const pngOp = plan.operations.find((op) => op.relativeSource === 'photo.png')
    expect(pngOp?.relativeDestination).toBe(path.join('Images', 'photo.png'))
  })

  it('detects destination collisions during planning', async () => {
    // Create pre-existing destination file
    const docDir = path.join(tempBaseDir, 'Documents')
    fs.mkdirSync(docDir, { recursive: true })
    fs.writeFileSync(path.join(docDir, 'doc2.txt'), 'Pre-existing document in subfolder')

    const plan = await manager.createOrganizationPlan({
      rootPath: tempBaseDir,
      strategy: 'by_extension'
    })

    const collidingOp = plan.operations.find((op) => op.relativeSource === 'doc2.txt')
    expect(collidingOp?.collision).toBe(true)
    expect(collidingOp?.isReversible).toBe(false)
    expect(plan.collisionCount).toBe(1)
  })

  it('applies an approved plan and records a verified transaction manifest', async () => {
    const plan = await manager.createOrganizationPlan({
      rootPath: tempBaseDir,
      strategy: 'by_extension'
    })

    const applyResult = await manager.applyOrganizationPlan({ plan })

    expect(applyResult.status).toBe('applied')
    expect(applyResult.appliedCount).toBe(4)
    expect(applyResult.failedCount).toBe(0)

    // Verify files were moved to organized subdirectories
    expect(fs.existsSync(path.join(tempBaseDir, 'doc1.pdf'))).toBe(false)
    expect(fs.existsSync(path.join(tempBaseDir, 'Documents', 'doc1.pdf'))).toBe(true)
    expect(fs.existsSync(path.join(tempBaseDir, 'Documents', 'doc2.txt'))).toBe(true)
    expect(fs.existsSync(path.join(tempBaseDir, 'Images', 'photo.png'))).toBe(true)
    expect(fs.existsSync(path.join(tempBaseDir, 'Code', 'script.py'))).toBe(true)

    // Verify manifest was recorded
    const manifest = manager.getTransaction(applyResult.transactionId)
    expect(manifest).toBeDefined()
    expect(manifest?.state).toBe('applied')
    expect(manifest?.operations.length).toBe(4)
  })

  it('reverses (undoes) an applied transaction, restoring files to original paths', async () => {
    const plan = await manager.createOrganizationPlan({
      rootPath: tempBaseDir,
      strategy: 'by_extension'
    })

    const applyResult = await manager.applyOrganizationPlan({ plan })
    expect(applyResult.status).toBe('applied')

    // Perform undo
    const undoResult = await manager.undoOrganization({
      transactionId: applyResult.transactionId
    })

    expect(undoResult.status).toBe('undone')
    expect(undoResult.restoredCount).toBe(4)
    expect(undoResult.failedCount).toBe(0)

    // Verify files are restored back to root!
    expect(fs.existsSync(path.join(tempBaseDir, 'doc1.pdf'))).toBe(true)
    expect(fs.existsSync(path.join(tempBaseDir, 'doc2.txt'))).toBe(true)
    expect(fs.existsSync(path.join(tempBaseDir, 'photo.png'))).toBe(true)
    expect(fs.existsSync(path.join(tempBaseDir, 'script.py'))).toBe(true)

    // Check manifest state updated
    const manifest = manager.getTransaction(applyResult.transactionId)
    expect(manifest?.state).toBe('undone')
  })

  it('refuses to undo if original source path has been re-occupied by another file', async () => {
    const plan = await manager.createOrganizationPlan({
      rootPath: tempBaseDir,
      strategy: 'by_extension'
    })

    const applyResult = await manager.applyOrganizationPlan({ plan })

    // Create a new unexpected file at original path of doc1.pdf
    fs.writeFileSync(path.join(tempBaseDir, 'doc1.pdf'), 'Unexpected newly created file')

    const undoResult = await manager.undoOrganization({
      transactionId: applyResult.transactionId
    })

    // Undo should protect the newly created file from being clobbered
    expect(undoResult.status).toBe('partially_undone')
    expect(undoResult.failedCount).toBe(1)
    expect(undoResult.restoredCount).toBe(3)
    expect(undoResult.errors?.[0]).toContain('already exists at original path')
  })
})

