/**
 * HELIOXEN AI — Step 29: File Operations, Clipboard Processing & Reversible Organization
 * Authoritative type definitions for secure filesystem and clipboard interaction.
 */

export type FileItemType = 'file' | 'directory' | 'symlink' | 'other'

export interface FileMetadata {
  readonly name: string
  readonly path: string
  readonly relativePath: string
  readonly type: FileItemType
  readonly sizeBytes: number
  readonly modifiedAt: number
  readonly createdAt: number
  readonly extension?: string
  readonly isReadOnly: boolean
}

export interface DirectoryListingRequest {
  readonly rootPath: string
  readonly relativePath?: string
  readonly maxDepth?: number
  readonly limit?: number
}

export interface DirectoryListingResult {
  readonly rootPath: string
  readonly items: readonly FileMetadata[]
  readonly totalCount: number
  readonly isTruncated: boolean
  readonly acquiredAt: number
}

export interface FileSearchRequest {
  readonly rootPath: string
  readonly query?: string
  readonly extension?: string
  readonly minSizeBytes?: number
  readonly maxSizeBytes?: number
  readonly limit?: number
}

export interface FileSearchResult {
  readonly rootPath: string
  readonly matches: readonly FileMetadata[]
  readonly totalMatches: number
  readonly acquiredAt: number
}

export interface ReadTextFileRequest {
  readonly rootPath: string
  readonly filePath: string
  readonly maxBytes?: number
}

export interface ReadTextFileResult {
  readonly filePath: string
  readonly content: string
  readonly byteLength: number
  readonly isTruncated: boolean
  readonly encoding: string
  readonly readAt: number
}

export interface CreateFileRequest {
  readonly rootPath: string
  readonly filePath: string
  readonly content: string
  readonly overwrite?: boolean
}

export interface CreateFileResult {
  readonly filePath: string
  readonly sizeBytes: number
  readonly createdAt: number
}

export interface CopyFileRequest {
  readonly rootPath: string
  readonly sourcePath: string
  readonly destinationPath: string
  readonly overwrite?: boolean
}

export interface CopyFileResult {
  readonly sourcePath: string
  readonly destinationPath: string
  readonly sizeBytes: number
  readonly copiedAt: number
}

export interface MoveFileRequest {
  readonly rootPath: string
  readonly sourcePath: string
  readonly destinationPath: string
  readonly overwrite?: boolean
}

export interface MoveFileResult {
  readonly sourcePath: string
  readonly destinationPath: string
  readonly movedAt: number
}

export type OrganizationStrategy = 'by_extension' | 'by_date' | 'by_category'

export interface OrganizationPlanOperation {
  readonly id: string
  readonly type: 'move' | 'rename'
  readonly sourcePath: string
  readonly destinationPath: string
  readonly relativeSource: string
  readonly relativeDestination: string
  readonly reason: string
  readonly isReversible: boolean
  readonly collision: boolean
}

export interface OrganizationPlan {
  readonly id: string
  readonly rootPath: string
  readonly strategy: OrganizationStrategy
  readonly operations: readonly OrganizationPlanOperation[]
  readonly totalFiles: number
  readonly reversibleCount: number
  readonly collisionCount: number
  readonly createdAt: number
}

export interface OrganizationPlanRequest {
  readonly rootPath: string
  readonly strategy: OrganizationStrategy
}

export interface OrganizationApplyRequest {
  readonly plan: OrganizationPlan
}

export interface TransactionRecordedOperation {
  readonly id: string
  readonly type: 'move' | 'rename'
  readonly sourcePath: string
  readonly destinationPath: string
  readonly originalMtime: number
  readonly originalSizeBytes: number
  readonly status: 'applied' | 'failed' | 'skipped' | 'undone'
  readonly appliedAt?: number
  readonly error?: string
}

export interface TransactionManifest {
  readonly transactionId: string
  readonly rootPath: string
  readonly planId: string
  readonly strategy: string
  readonly state: 'applied' | 'partially_applied' | 'failed' | 'undone' | 'partially_undone' | 'undo_failed'
  readonly operations: readonly TransactionRecordedOperation[]
  readonly createdAt: number
  readonly completedAt?: number
  readonly undoneAt?: number
}

export interface OrganizationApplyResult {
  readonly transactionId: string
  readonly status: 'applied' | 'partially_applied' | 'failed'
  readonly appliedCount: number
  readonly failedCount: number
  readonly totalCount: number
  readonly errors?: readonly string[]
  readonly appliedAt: number
}

export interface OrganizationUndoRequest {
  readonly transactionId: string
}

export interface OrganizationUndoResult {
  readonly transactionId: string
  readonly status: 'undone' | 'partially_undone' | 'undo_failed'
  readonly restoredCount: number
  readonly failedCount: number
  readonly totalCount: number
  readonly errors?: readonly string[]
  readonly undoneAt: number
}

export interface ClipboardReadTextResult {
  readonly text: string
  readonly charCount: number
  readonly isTruncated: boolean
  readonly timestamp: number
}

export interface ClipboardWriteTextRequest {
  readonly text: string
}

export interface ClipboardWriteTextResult {
  readonly success: boolean
  readonly charCount: number
  readonly timestamp: number
}

export interface ClipboardReadImageResult {
  readonly hasImage: boolean
  readonly dataUrl?: string
  readonly width?: number
  readonly height?: number
  readonly sizeBytes?: number
  readonly timestamp: number
}
