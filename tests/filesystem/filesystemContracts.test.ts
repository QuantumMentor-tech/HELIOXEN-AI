/**
 * HELIOXEN AI — Step 29: Filesystem Contracts & Schema Validation Tests
 */

import { describe, it, expect } from 'vitest'
import {
  DirectoryListingRequestSchema,
  DirectoryListingResultSchema,
  FileSearchRequestSchema,
  FileSearchResultSchema,
  ReadTextFileRequestSchema,
  ReadTextFileResultSchema,
  CreateFileRequestSchema,
  CreateFileResultSchema,
  CopyFileRequestSchema,
  CopyFileResultSchema,
  MoveFileRequestSchema,
  MoveFileResultSchema,
  OrganizationPlanRequestSchema,
  OrganizationPlanSchema,
  OrganizationApplyRequestSchema,
  OrganizationApplyResultSchema,
  OrganizationUndoRequestSchema,
  OrganizationUndoResultSchema,
  ClipboardWriteTextRequestSchema,
  ClipboardWriteTextResultSchema,
  ClipboardReadTextResultSchema,
  ClipboardReadImageResultSchema
} from '../../src/shared/filesystem/contracts'

describe('Step 29: Filesystem Contracts Validation', () => {
  it('validates DirectoryListingRequestSchema and rejects unknown keys', () => {
    const valid = DirectoryListingRequestSchema.safeParse({ rootPath: 'C:\\Users\\test', maxDepth: 2, limit: 100 })
    expect(valid.success).toBe(true)

    const invalid = DirectoryListingRequestSchema.safeParse({ rootPath: 'C:\\Users\\test', unauthorizedExtra: 123 })
    expect(invalid.success).toBe(false)
  })

  it('validates FileSearchRequestSchema and bounds limit', () => {
    const valid = FileSearchRequestSchema.safeParse({ rootPath: 'C:\\Users\\test', query: 'notes', limit: 50 })
    expect(valid.success).toBe(true)

    const tooHigh = FileSearchRequestSchema.safeParse({ rootPath: 'C:\\Users\\test', limit: 500 })
    expect(tooHigh.success).toBe(false)
  })

  it('validates ReadTextFileRequestSchema and bounds maxBytes', () => {
    const valid = ReadTextFileRequestSchema.safeParse({ rootPath: 'C:\\root', filePath: 'C:\\root\\file.txt', maxBytes: 1024 })
    expect(valid.success).toBe(true)

    const tooBig = ReadTextFileRequestSchema.safeParse({ rootPath: 'C:\\root', filePath: 'C:\\root\\file.txt', maxBytes: 20 * 1024 * 1024 })
    expect(tooBig.success).toBe(false)
  })

  it('validates CreateFileRequestSchema, CopyFileRequestSchema, MoveFileRequestSchema', () => {
    const validCreate = CreateFileRequestSchema.safeParse({ rootPath: 'C:\\root', filePath: 'C:\\root\\file.txt', content: 'hello' })
    expect(validCreate.success).toBe(true)

    const validCopy = CopyFileRequestSchema.safeParse({ rootPath: 'C:\\root', sourcePath: 'C:\\root\\a.txt', destinationPath: 'C:\\root\\b.txt' })
    expect(validCopy.success).toBe(true)

    const validMove = MoveFileRequestSchema.safeParse({ rootPath: 'C:\\root', sourcePath: 'C:\\root\\a.txt', destinationPath: 'C:\\root\\c.txt' })
    expect(validMove.success).toBe(true)
  })

  it('validates OrganizationPlanRequestSchema and OrganizationPlanSchema', () => {
    const validReq = OrganizationPlanRequestSchema.safeParse({ rootPath: 'C:\\root', strategy: 'by_extension' })
    expect(validReq.success).toBe(true)

    const invalidStrategy = OrganizationPlanRequestSchema.safeParse({ rootPath: 'C:\\root', strategy: 'random' as any })
    expect(invalidStrategy.success).toBe(false)

    const validPlan = OrganizationPlanSchema.safeParse({
      id: 'plan_123',
      rootPath: 'C:\\root',
      strategy: 'by_extension',
      operations: [
        {
          id: 'op_1',
          type: 'move',
          sourcePath: 'C:\\root\\doc.pdf',
          destinationPath: 'C:\\root\\Documents\\doc.pdf',
          relativeSource: 'doc.pdf',
          relativeDestination: 'Documents\\doc.pdf',
          reason: 'Organize by extension',
          isReversible: true,
          collision: false
        }
      ],
      totalFiles: 1,
      reversibleCount: 1,
      collisionCount: 0,
      createdAt: Date.now()
    })
    expect(validPlan.success).toBe(true)
  })

  it('validates Clipboard schemas', () => {
    const validWrite = ClipboardWriteTextRequestSchema.safeParse({ text: 'sample' })
    expect(validWrite.success).toBe(true)

    const validReadText = ClipboardReadTextResultSchema.safeParse({
      text: 'sample',
      charCount: 6,
      isTruncated: false,
      timestamp: Date.now()
    })
    expect(validReadText.success).toBe(true)

    const validReadImg = ClipboardReadImageResultSchema.safeParse({
      hasImage: true,
      dataUrl: 'data:image/png;base64,abc',
      width: 100,
      height: 100,
      sizeBytes: 256,
      timestamp: Date.now()
    })
    expect(validReadImg.success).toBe(true)
  })
})

