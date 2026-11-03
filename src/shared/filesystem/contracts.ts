/**
 * HELIOXEN AI — Step 29: Filesystem and Clipboard Zod Schemas
 * Strict input and output validation contracts.
 */

import { z } from 'zod'

export const FileItemTypeSchema = z.enum(['file', 'directory', 'symlink', 'other'])

export const FileMetadataSchema = z.object({
  name: z.string().min(1).max(256),
  path: z.string().min(1).max(1024),
  relativePath: z.string().max(1024),
  type: FileItemTypeSchema,
  sizeBytes: z.number().int().nonnegative(),
  modifiedAt: z.number().int().positive(),
  createdAt: z.number().int().positive(),
  extension: z.string().max(32).optional(),
  isReadOnly: z.boolean()
})

export const DirectoryListingRequestSchema = z
  .object({
    rootPath: z.string().min(1).max(1024),
    relativePath: z.string().max(1024).optional(),
    maxDepth: z.number().int().min(0).max(5).optional(),
    limit: z.number().int().min(1).max(500).optional()
  })
  .strict()

export const DirectoryListingResultSchema = z.object({
  rootPath: z.string().min(1).max(1024),
  items: z.array(FileMetadataSchema).max(500),
  totalCount: z.number().int().nonnegative(),
  isTruncated: z.boolean(),
  acquiredAt: z.number().int().positive()
})

export const FileSearchRequestSchema = z
  .object({
    rootPath: z.string().min(1).max(1024),
    query: z.string().max(128).optional(),
    extension: z.string().max(32).optional(),
    minSizeBytes: z.number().int().nonnegative().optional(),
    maxSizeBytes: z.number().int().nonnegative().optional(),
    limit: z.number().int().min(1).max(200).optional()
  })
  .strict()

export const FileSearchResultSchema = z.object({
  rootPath: z.string().min(1).max(1024),
  matches: z.array(FileMetadataSchema).max(200),
  totalMatches: z.number().int().nonnegative(),
  acquiredAt: z.number().int().positive()
})

export const ReadTextFileRequestSchema = z
  .object({
    rootPath: z.string().min(1).max(1024),
    filePath: z.string().min(1).max(1024),
    maxBytes: z.number().int().min(1).max(10 * 1024 * 1024).optional() // Max 10MB
  })
  .strict()

export const ReadTextFileResultSchema = z.object({
  filePath: z.string().min(1).max(1024),
  content: z.string(),
  byteLength: z.number().int().nonnegative(),
  isTruncated: z.boolean(),
  encoding: z.string().max(32),
  readAt: z.number().int().positive()
})

export const CreateFileRequestSchema = z
  .object({
    rootPath: z.string().min(1).max(1024),
    filePath: z.string().min(1).max(1024),
    content: z.string().max(5 * 1024 * 1024), // Max 5MB
    overwrite: z.boolean().optional()
  })
  .strict()

export const CreateFileResultSchema = z.object({
  filePath: z.string().min(1).max(1024),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.number().int().positive()
})

export const CopyFileRequestSchema = z
  .object({
    rootPath: z.string().min(1).max(1024),
    sourcePath: z.string().min(1).max(1024),
    destinationPath: z.string().min(1).max(1024),
    overwrite: z.boolean().optional()
  })
  .strict()

export const CopyFileResultSchema = z.object({
  sourcePath: z.string().min(1).max(1024),
  destinationPath: z.string().min(1).max(1024),
  sizeBytes: z.number().int().nonnegative(),
  copiedAt: z.number().int().positive()
})

export const MoveFileRequestSchema = z
  .object({
    rootPath: z.string().min(1).max(1024),
    sourcePath: z.string().min(1).max(1024),
    destinationPath: z.string().min(1).max(1024),
    overwrite: z.boolean().optional()
  })
  .strict()

export const MoveFileResultSchema = z.object({
  sourcePath: z.string().min(1).max(1024),
  destinationPath: z.string().min(1).max(1024),
  movedAt: z.number().int().positive()
})

export const OrganizationStrategySchema = z.enum(['by_extension', 'by_date', 'by_category'])

export const OrganizationPlanOperationSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(['move', 'rename']),
  sourcePath: z.string().min(1).max(1024),
  destinationPath: z.string().min(1).max(1024),
  relativeSource: z.string().max(1024),
  relativeDestination: z.string().max(1024),
  reason: z.string().max(256),
  isReversible: z.boolean(),
  collision: z.boolean()
})

export const OrganizationPlanSchema = z.object({
  id: z.string().min(1).max(64),
  rootPath: z.string().min(1).max(1024),
  strategy: OrganizationStrategySchema,
  operations: z.array(OrganizationPlanOperationSchema).max(200),
  totalFiles: z.number().int().nonnegative(),
  reversibleCount: z.number().int().nonnegative(),
  collisionCount: z.number().int().nonnegative(),
  createdAt: z.number().int().positive()
})

export const OrganizationPlanRequestSchema = z
  .object({
    rootPath: z.string().min(1).max(1024),
    strategy: OrganizationStrategySchema
  })
  .strict()

export const OrganizationApplyRequestSchema = z
  .object({
    plan: OrganizationPlanSchema
  })
  .strict()

export const OrganizationApplyResultSchema = z.object({
  transactionId: z.string().min(1).max(64),
  status: z.enum(['applied', 'partially_applied', 'failed']),
  appliedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  errors: z.array(z.string()).optional(),
  appliedAt: z.number().int().positive()
})

export const OrganizationUndoRequestSchema = z
  .object({
    transactionId: z.string().min(1).max(64)
  })
  .strict()

export const OrganizationUndoResultSchema = z.object({
  transactionId: z.string().min(1).max(64),
  status: z.enum(['undone', 'partially_undone', 'undo_failed']),
  restoredCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  errors: z.array(z.string()).optional(),
  undoneAt: z.number().int().positive()
})

export const ClipboardReadTextResultSchema = z.object({
  text: z.string(),
  charCount: z.number().int().nonnegative(),
  isTruncated: z.boolean(),
  timestamp: z.number().int().positive()
})

export const ClipboardWriteTextRequestSchema = z
  .object({
    text: z.string().max(1000000)
  })
  .strict()

export const ClipboardWriteTextResultSchema = z.object({
  success: z.boolean(),
  charCount: z.number().int().nonnegative(),
  timestamp: z.number().int().positive()
})

export const ClipboardReadImageResultSchema = z.object({
  hasImage: z.boolean(),
  dataUrl: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  timestamp: z.number().int().positive()
})

