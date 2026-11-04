/**
 * HELIOXEN AI — Step 36: Media Gallery and Media Asset Management
 * Zod schemas, magic-byte binary header inspectors, dimension/duration extractors,
 * active-content/SVG blockers, and privacy/secret guards.
 */

import { z } from 'zod'
import { inspectMemorySafetyPolicy } from '../memory/contracts'
import {
  DEFAULT_MEDIA_LIBRARY_LIMITS,
  DEFAULT_MEDIA_PROFILE_ID,
  MediaAssetType,
  MediaLibraryLimits
} from './types'

export const MediaProfileIdSchema = z
  .string()
  .trim()
  .min(1, 'Profile ID cannot be empty')
  .max(80, 'Profile ID exceeds maximum length')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Profile ID contains invalid characters')
  .default(DEFAULT_MEDIA_PROFILE_ID)

export const MediaRecordIdSchema = z
  .string()
  .trim()
  .min(1, 'Record ID cannot be empty')
  .max(120, 'Record ID exceeds maximum length')
  .regex(/^[a-zA-Z0-9_.:-]+$/, 'Record ID contains invalid characters')

export const MediaTagListSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'Tag cannot be empty')
      .max(40, 'Tag cannot exceed 40 characters')
      .regex(/^[a-zA-Z0-9_./ -]+$/, 'Tag contains invalid characters')
  )
  .max(DEFAULT_MEDIA_LIBRARY_LIMITS.maxTagsPerAsset)
  .default([])

export const MediaCollectionIdListSchema = z
  .array(MediaRecordIdSchema)
  .max(50)
  .default([])

export const MediaStorageModeSchema = z
  .enum(['managed_copy', 'external_reference'])
  .default('managed_copy')

export const MediaAssetSourceTypeSchema = z
  .enum([
    'user_file_import',
    'saved_capture',
    'saved_attachment',
    'saved_browser_screenshot',
    'ai_generated_image',
    'exported_diagram'
  ])
  .default('user_file_import')

export const DuplicateHandlingPolicySchema = z
  .enum(['skip_and_return_existing', 'allow_duplicate'])
  .default('skip_and_return_existing')

export const ImportMediaFileItemSchema = z
  .object({
    filePath: z.string().trim().min(1, 'File path is required').max(1024),
    displayName: z.string().trim().min(1).max(200).optional(),
    tags: MediaTagListSchema.optional(),
    collectionIds: MediaCollectionIdListSchema.optional(),
    favorite: z.boolean().optional()
  })
  .strict()

export const ImportMediaBatchRequestSchema = z
  .object({
    profileId: MediaProfileIdSchema.optional(),
    items: z
      .array(ImportMediaFileItemSchema)
      .min(1, 'At least one media file must be selected')
      .max(
        DEFAULT_MEDIA_LIBRARY_LIMITS.maxBatchFileCount,
        `Cannot import more than ${DEFAULT_MEDIA_LIBRARY_LIMITS.maxBatchFileCount} files in a single batch`
      ),
    storageMode: MediaStorageModeSchema.optional(),
    sourceType: MediaAssetSourceTypeSchema.optional(),
    sourceReference: z.string().trim().max(300).optional(),
    duplicatePolicy: DuplicateHandlingPolicySchema.optional()
  })
  .strict()

export const SaveCapturedMediaRequestSchema = z
  .object({
    profileId: MediaProfileIdSchema.optional(),
    displayName: z.string().trim().min(1).max(200),
    dataUrl: z.string().trim().min(20),
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    sourceType: z
      .enum([
        'saved_capture',
        'saved_browser_screenshot',
        'ai_generated_image',
        'exported_diagram'
      ])
      .default('saved_capture'),
    sourceReference: z.string().trim().max(300).optional(),
    tags: MediaTagListSchema.optional(),
    favorite: z.boolean().default(false)
  })
  .strict()

export const ListMediaAssetsRequestSchema = z
  .object({
    profileId: MediaProfileIdSchema.optional(),
    query: z.string().trim().max(200).optional(),
    mediaType: z.enum(['all', 'image', 'video', 'audio']).default('all'),
    collectionId: MediaRecordIdSchema.optional(),
    tag: z.string().trim().max(40).optional(),
    favoritesOnly: z.boolean().default(false),
    includeUnavailable: z.boolean().default(true),
    sortBy: z.enum(['importedAt', 'displayName', 'fileSizeBytes', 'mediaType']).default('importedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    limit: z.number().int().min(1).max(200).default(100),
    offset: z.number().int().min(0).default(0)
  })
  .strict()

export const UpdateMediaAssetMetadataRequestSchema = z
  .object({
    profileId: MediaProfileIdSchema.optional(),
    id: MediaRecordIdSchema,
    displayName: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    tags: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Tag cannot be empty')
          .max(40, 'Tag cannot exceed 40 characters')
          .regex(/^[a-zA-Z0-9_./ -]+$/, 'Tag contains invalid characters')
      )
      .max(DEFAULT_MEDIA_LIBRARY_LIMITS.maxTagsPerAsset)
      .optional(),
    favorite: z.boolean().optional(),
    collectionIds: z.array(MediaRecordIdSchema).max(50).optional()
  })
  .strict()

export const RelinkExternalMediaAssetRequestSchema = z
  .object({
    profileId: MediaProfileIdSchema.optional(),
    id: MediaRecordIdSchema,
    newFilePath: z.string().trim().min(1).max(1024)
  })
  .strict()

export const CreateMediaCollectionRequestSchema = z
  .object({
    profileId: MediaProfileIdSchema.optional(),
    name: z
      .string()
      .trim()
      .min(1, 'Collection name is required')
      .max(100, 'Collection name cannot exceed 100 characters'),
    description: z.string().trim().max(1000).default('')
  })
  .strict()

export const UpdateMediaCollectionRequestSchema = z
  .object({
    profileId: MediaProfileIdSchema.optional(),
    id: MediaRecordIdSchema,
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(1000).optional()
  })
  .strict()

export const DeleteMediaCollectionRequestSchema = z
  .object({
    profileId: MediaProfileIdSchema.optional(),
    id: MediaRecordIdSchema
  })
  .strict()

export const ModifyCollectionMembershipRequestSchema = z
  .object({
    profileId: MediaProfileIdSchema.optional(),
    collectionId: MediaRecordIdSchema,
    assetIds: z.array(MediaRecordIdSchema).min(1).max(100),
    action: z.enum(['add', 'remove'])
  })
  .strict()

export const RemoveMediaAssetFromLibraryRequestSchema = z
  .object({
    profileId: MediaProfileIdSchema.optional(),
    id: MediaRecordIdSchema
  })
  .strict()

export const DeleteManagedMediaAssetPermanentlyRequestSchema = z
  .object({
    profileId: MediaProfileIdSchema.optional(),
    id: MediaRecordIdSchema,
    confirmPermanentDelete: z.boolean()
  })
  .strict()

export const BulkMediaAssetOperationRequestSchema = z
  .object({
    profileId: MediaProfileIdSchema.optional(),
    assetIds: z.array(MediaRecordIdSchema).min(1).max(100),
    operation: z.enum([
      'set_favorite',
      'clear_favorite',
      'add_to_collection',
      'remove_from_collection',
      'remove_from_library',
      'delete_managed_permanently'
    ]),
    collectionId: MediaRecordIdSchema.optional(),
    confirmPermanentDelete: z.boolean().optional()
  })
  .strict()

// ============================================================================
// SUPPORTED MEDIA FORMAT POLICY & MAGIC-BYTE BINARY INSPECTION
// ============================================================================

export const SUPPORTED_MEDIA_EXTENSIONS: Record<
  string,
  { readonly mediaType: MediaAssetType; readonly mimeType: string }
> = {
  '.png': { mediaType: 'image', mimeType: 'image/png' },
  '.jpg': { mediaType: 'image', mimeType: 'image/jpeg' },
  '.jpeg': { mediaType: 'image', mimeType: 'image/jpeg' },
  '.webp': { mediaType: 'image', mimeType: 'image/webp' },
  '.gif': { mediaType: 'image', mimeType: 'image/gif' },
  '.bmp': { mediaType: 'image', mimeType: 'image/bmp' },
  '.mp4': { mediaType: 'video', mimeType: 'video/mp4' },
  '.webm': { mediaType: 'video', mimeType: 'video/webm' },
  '.mp3': { mediaType: 'audio', mimeType: 'audio/mpeg' },
  '.wav': { mediaType: 'audio', mimeType: 'audio/wav' },
  '.ogg': { mediaType: 'audio', mimeType: 'audio/ogg' }
}

export const PROHIBITED_ACTIVE_EXTENSIONS = new Set([
  '.svg',
  '.svgz',
  '.html',
  '.htm',
  '.xhtml',
  '.js',
  '.mjs',
  '.cjs',
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.ps1',
  '.vbs',
  '.sh',
  '.msi',
  '.scr'
])

export interface MediaInspectionOutcome {
  readonly valid: boolean
  readonly mediaType?: MediaAssetType
  readonly mimeType?: string
  readonly normalizedExtension?: string
  readonly width?: number | null
  readonly height?: number | null
  readonly durationSeconds?: number | null
  readonly errorCode?:
    | 'PROHIBITED_ACTIVE_CONTENT'
    | 'UNSUPPORTED_EXTENSION'
    | 'EMPTY_FILE'
    | 'FILE_TOO_LARGE'
    | 'EXTENSION_CONTENT_MISMATCH'
    | 'MALFORMED_MEDIA_HEADER'
    | 'IMAGE_DIMENSIONS_EXCEEDED'
  readonly errorMessage?: string
}

function parseJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  let offset = 2
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = buf[offset + 1]
    if (marker === 0xff) {
      offset++
      continue
    }
    // SOF0, SOF1, SOF2 markers
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = buf.readUInt16BE(offset + 5)
      const width = buf.readUInt16BE(offset + 7)
      if (width > 0 && height > 0) {
        return { width, height }
      }
      return null
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    if (offset + 4 > buf.length) break
    const segmentLength = buf.readUInt16BE(offset + 2)
    if (segmentLength < 2) break
    offset += 2 + segmentLength
  }
  return null
}

function parseWebpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null
  const chunkType = buf.toString('ascii', 12, 16)
  if (chunkType === 'VP8 ' && buf.length >= 30) {
    const width = buf.readUInt16LE(26) & 0x3fff
    const height = buf.readUInt16LE(28) & 0x3fff
    if (width > 0 && height > 0) return { width, height }
  } else if (chunkType === 'VP8L' && buf.length >= 25) {
    const bits = buf.readUInt32LE(21)
    const width = (bits & 0x3fff) + 1
    const height = ((bits >> 14) & 0x3fff) + 1
    if (width > 0 && height > 0) return { width, height }
  } else if (chunkType === 'VP8X' && buf.length >= 30) {
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16))
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16))
    if (width > 0 && height > 0) return { width, height }
  }
  return null
}

function parseWavDurationSeconds(buf: Buffer): number | null {
  if (buf.length < 44) return null
  let offset = 12
  let byteRate = 0
  let dataBytes = 0
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4)
    const chunkSize = buf.readUInt32LE(offset + 4)
    if (chunkId === 'fmt ' && offset + 16 <= buf.length) {
      byteRate = buf.readUInt32LE(offset + 16)
    } else if (chunkId === 'data') {
      dataBytes = chunkSize
      break
    }
    offset += 8 + chunkSize + (chunkSize % 2)
  }
  if (byteRate > 0 && dataBytes > 0) {
    return Number((dataBytes / byteRate).toFixed(2))
  }
  return null
}

function parseMp4DurationSeconds(buf: Buffer): number | null {
  const mvhdIdx = buf.indexOf(Buffer.from('mvhd', 'ascii'))
  if (mvhdIdx === -1 || mvhdIdx + 24 > buf.length) return null
  const version = buf[mvhdIdx + 4]
  if (version === 0 && mvhdIdx + 24 <= buf.length) {
    const timeScale = buf.readUInt32BE(mvhdIdx + 16)
    const duration = buf.readUInt32BE(mvhdIdx + 20)
    if (timeScale > 0 && duration > 0) {
      return Number((duration / timeScale).toFixed(2))
    }
  }
  return null
}

/**
 * Inspects a candidate media file extension and binary content buffer against
 * HELIOXEN's Step 36 layered validation policy.
 */
export function inspectMediaFileBuffer(
  fileName: string,
  buffer: Buffer,
  limits: MediaLibraryLimits = DEFAULT_MEDIA_LIBRARY_LIMITS
): MediaInspectionOutcome {
  const lowerName = (fileName || '').trim().toLowerCase()
  const dotIdx = lowerName.lastIndexOf('.')
  const ext = dotIdx >= 0 ? lowerName.slice(dotIdx) : ''

  if (PROHIBITED_ACTIVE_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      errorCode: 'PROHIBITED_ACTIVE_CONTENT',
      errorMessage: `File format '${ext}' is rejected because active, scriptable, or executable formats (such as SVG, HTML, or executables) are prohibited in the Media Gallery.`
    }
  }

  // Inspect leading bytes for disguised SVG/HTML/script/PE executable payloads
  const headText = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf-8').trimStart()
  if (
    /^<svg[\s>]/i.test(headText) ||
    /^<!doctype\s+html/i.test(headText) ||
    /^<html[\s>]/i.test(headText) ||
    /<script[\s>]/i.test(headText) ||
    (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a && ext !== '.bmp')
  ) {
    return {
      valid: false,
      errorCode: 'PROHIBITED_ACTIVE_CONTENT',
      errorMessage:
        'File rejected: Binary header contains active markup (SVG/HTML/script) or executable code.'
    }
  }

  const formatSpec = SUPPORTED_MEDIA_EXTENSIONS[ext]
  if (!formatSpec) {
    return {
      valid: false,
      errorCode: 'UNSUPPORTED_EXTENSION',
      errorMessage: `File extension '${ext || '(none)'}' is not in the supported Media Gallery allowlist.`
    }
  }

  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      errorCode: 'EMPTY_FILE',
      errorMessage: 'Media file is empty (0 bytes).'
    }
  }

  if (buffer.length > limits.maxSingleFileSizeBytes) {
    return {
      valid: false,
      errorCode: 'FILE_TOO_LARGE',
      errorMessage: `Media file size (${buffer.length} bytes) exceeds maximum limit (${limits.maxSingleFileSizeBytes} bytes).`
    }
  }

  let width: number | null = null
  let height: number | null = null
  let durationSeconds: number | null = null

  // Validate magic bytes & structural headers per format
  if (ext === '.png') {
    const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    if (buffer.length < 24 || !buffer.subarray(0, 8).equals(pngSig)) {
      return {
        valid: false,
        errorCode: 'EXTENSION_CONTENT_MISMATCH',
        errorMessage: 'File has .png extension but does not contain a valid PNG signature.'
      }
    }
    const ihdrTag = buffer.toString('ascii', 12, 16)
    if (ihdrTag !== 'IHDR') {
      return {
        valid: false,
        errorCode: 'MALFORMED_MEDIA_HEADER',
        errorMessage: 'Malformed PNG header: missing IHDR chunk.'
      }
    }
    width = buffer.readUInt32BE(16)
    height = buffer.readUInt32BE(20)
    if (width <= 0 || height <= 0) {
      return {
        valid: false,
        errorCode: 'MALFORMED_MEDIA_HEADER',
        errorMessage: 'Malformed PNG header: invalid zero dimensions.'
      }
    }
  } else if (ext === '.jpg' || ext === '.jpeg') {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      return {
        valid: false,
        errorCode: 'EXTENSION_CONTENT_MISMATCH',
        errorMessage: 'File has JPEG extension but does not start with JPEG SOI marker (FF D8 FF).'
      }
    }
    const dims = parseJpegDimensions(buffer)
    if (!dims) {
      return {
        valid: false,
        errorCode: 'MALFORMED_MEDIA_HEADER',
        errorMessage: 'Malformed JPEG payload: missing valid SOF dimension marker.'
      }
    }
    width = dims.width
    height = dims.height
  } else if (ext === '.gif') {
    const header = buffer.length >= 10 ? buffer.toString('ascii', 0, 6) : ''
    if (header !== 'GIF87a' && header !== 'GIF89a') {
      return {
        valid: false,
        errorCode: 'EXTENSION_CONTENT_MISMATCH',
        errorMessage: 'File has .gif extension but does not contain a valid GIF87a/GIF89a header.'
      }
    }
    width = buffer.readUInt16LE(6)
    height = buffer.readUInt16LE(8)
    if (width <= 0 || height <= 0) {
      return {
        valid: false,
        errorCode: 'MALFORMED_MEDIA_HEADER',
        errorMessage: 'Malformed GIF header: invalid zero dimensions.'
      }
    }
  } else if (ext === '.webp') {
    if (
      buffer.length < 16 ||
      buffer.toString('ascii', 0, 4) !== 'RIFF' ||
      buffer.toString('ascii', 8, 12) !== 'WEBP'
    ) {
      return {
        valid: false,
        errorCode: 'EXTENSION_CONTENT_MISMATCH',
        errorMessage: 'File has .webp extension but does not contain a valid RIFF/WEBP container header.'
      }
    }
    const dims = parseWebpDimensions(buffer)
    if (!dims) {
      return {
        valid: false,
        errorCode: 'MALFORMED_MEDIA_HEADER',
        errorMessage: 'Malformed WebP header: unable to parse valid VP8/VP8L/VP8X dimensions.'
      }
    }
    width = dims.width
    height = dims.height
  } else if (ext === '.bmp') {
    if (buffer.length < 26 || buffer[0] !== 0x42 || buffer[1] !== 0x4d) {
      return {
        valid: false,
        errorCode: 'EXTENSION_CONTENT_MISMATCH',
        errorMessage: 'File has .bmp extension but does not contain a valid BM header.'
      }
    }
    width = Math.abs(buffer.readInt32LE(18))
    height = Math.abs(buffer.readInt32LE(22))
    if (width <= 0 || height <= 0) {
      return {
        valid: false,
        errorCode: 'MALFORMED_MEDIA_HEADER',
        errorMessage: 'Malformed BMP header: invalid zero dimensions.'
      }
    }
  } else if (ext === '.mp4') {
    if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') {
      return {
        valid: false,
        errorCode: 'EXTENSION_CONTENT_MISMATCH',
        errorMessage: 'File has .mp4 extension but does not contain an ISO BMFF ftyp box.'
      }
    }
    durationSeconds = parseMp4DurationSeconds(buffer)
  } else if (ext === '.webm') {
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x1a ||
      buffer[1] !== 0x45 ||
      buffer[2] !== 0xdf ||
      buffer[3] !== 0xa3
    ) {
      return {
        valid: false,
        errorCode: 'EXTENSION_CONTENT_MISMATCH',
        errorMessage: 'File has .webm extension but does not start with an EBML header.'
      }
    }
  } else if (ext === '.wav') {
    if (
      buffer.length < 12 ||
      buffer.toString('ascii', 0, 4) !== 'RIFF' ||
      buffer.toString('ascii', 8, 12) !== 'WAVE'
    ) {
      return {
        valid: false,
        errorCode: 'EXTENSION_CONTENT_MISMATCH',
        errorMessage: 'File has .wav extension but does not contain a valid RIFF/WAVE header.'
      }
    }
    durationSeconds = parseWavDurationSeconds(buffer)
  } else if (ext === '.mp3') {
    const isId3 =
      buffer.length >= 3 &&
      buffer[0] === 0x49 &&
      buffer[1] === 0x44 &&
      buffer[2] === 0x33
    const isMpegSync =
      buffer.length >= 2 &&
      buffer[0] === 0xff &&
      (buffer[1] & 0xe0) === 0xe0
    if (!isId3 && !isMpegSync) {
      return {
        valid: false,
        errorCode: 'EXTENSION_CONTENT_MISMATCH',
        errorMessage: 'File has .mp3 extension but lacks a valid ID3 or MPEG audio frame header.'
      }
    }
  } else if (ext === '.ogg') {
    if (buffer.length < 4 || buffer.toString('ascii', 0, 4) !== 'OggS') {
      return {
        valid: false,
        errorCode: 'EXTENSION_CONTENT_MISMATCH',
        errorMessage: 'File has .ogg extension but does not start with an OggS capture pattern.'
      }
    }
  }

  // Enforce image dimension & pixel bounds
  if (width !== null && height !== null) {
    if (width > limits.maxImageDimensionPx || height > limits.maxImageDimensionPx) {
      return {
        valid: false,
        errorCode: 'IMAGE_DIMENSIONS_EXCEEDED',
        errorMessage: `Image dimensions (${width}x${height}) exceed maximum allowed edge (${limits.maxImageDimensionPx}px).`
      }
    }
    if (width * height > limits.maxImagePixelCount) {
      return {
        valid: false,
        errorCode: 'IMAGE_DIMENSIONS_EXCEEDED',
        errorMessage: `Image pixel count (${width * height}) exceeds maximum decoded pixel budget (${limits.maxImagePixelCount}).`
      }
    }
  }

  return {
    valid: true,
    mediaType: formatSpec.mediaType,
    mimeType: formatSpec.mimeType,
    normalizedExtension: ext === '.jpeg' ? '.jpg' : ext,
    width,
    height,
    durationSeconds
  }
}

export function inspectMediaMetadataSafety(
  fieldLabel: string,
  ...texts: Array<string | undefined | null>
): { allowed: boolean; reason?: string } {
  for (const text of texts) {
    if (!text) continue
    const check = inspectMemorySafetyPolicy(text)
    if (!check.allowed) {
      return {
        allowed: false,
        reason: `${fieldLabel} rejected by HELIOXEN privacy & secret guard: ${check.reason}`
      }
    }
  }
  return { allowed: true }
}

