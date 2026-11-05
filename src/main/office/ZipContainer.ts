/**
 * HELIOXEN AI — Step 43: Pure Node.js ZIP Archive Container Engine
 * Encodes and decodes standard PKZIP 2.0 archives for Office Open XML (.docx, .xlsx, .pptx).
 * - Zero external dependencies (uses Node.js built-in zlib and zlib.crc32).
 * - Memory-bounded zip-bomb defense (strict decompression ceiling, max entry count).
 * - Path traversal defense (blocks ".." and absolute paths).
 */

import * as zlib from 'zlib'

export interface ZipEntry {
  name?: string
  path?: string
  data: Buffer | string
}

export interface ZipReadLimits {
  maxEntries?: number
  maxTotalDecompressedBytes?: number
  maxSingleEntryDecompressedBytes?: number
}

export const DEFAULT_ZIP_LIMITS: Required<ZipReadLimits> = {
  maxEntries: 500,
  maxTotalDecompressedBytes: 50 * 1024 * 1024, // 50 MB
  maxSingleEntryDecompressedBytes: 15 * 1024 * 1024 // 15 MB
}

/**
 * Encodes an array of file entries into a valid binary PKZIP archive Buffer.
 */
export function buildZipArchive(entries: ZipEntry[]): Buffer {
  const fileRecords: {
    nameBuf: Buffer
    compressedData: Buffer
    uncompressedSize: number
    crc32: number
    localHeaderOffset: number
  }[] = []

  const buffers: Buffer[] = []
  let currentOffset = 0

  // 1. Write Local File Headers + Compressed Data
  for (const entry of entries) {
    const rawData = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf-8')
    const entryName = (entry.name || entry.path || '').replace(/\\/g, '/')
    const nameBuf = Buffer.from(entryName, 'utf-8')
    const crc = zlib.crc32(rawData)
    const compressed = zlib.deflateRawSync(rawData)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0) // Signature PK\x03\x04
    localHeader.writeUInt16LE(20, 4) // Version needed (2.0)
    localHeader.writeUInt16LE(0, 6) // General purpose bit flag
    localHeader.writeUInt16LE(8, 8) // Compression method: 8 (deflate)
    localHeader.writeUInt16LE(0, 10) // File last mod time
    localHeader.writeUInt16LE(0, 12) // File last mod date
    localHeader.writeUInt32LE(crc, 14) // CRC-32
    localHeader.writeUInt32LE(compressed.length, 18) // Compressed size
    localHeader.writeUInt32LE(rawData.length, 22) // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26) // File name length
    localHeader.writeUInt16LE(0, 28) // Extra field length

    fileRecords.push({
      nameBuf,
      compressedData: compressed,
      uncompressedSize: rawData.length,
      crc32: crc,
      localHeaderOffset: currentOffset
    })

    buffers.push(localHeader, nameBuf, compressed)
    currentOffset += localHeader.length + nameBuf.length + compressed.length
  }

  // 2. Write Central Directory Headers
  const centralDirStartOffset = currentOffset
  let centralDirSize = 0

  for (const rec of fileRecords) {
    const cdHeader = Buffer.alloc(46)
    cdHeader.writeUInt32LE(0x02014b50, 0) // Signature PK\x01\x02
    cdHeader.writeUInt16LE(20, 4) // Version made by
    cdHeader.writeUInt16LE(20, 6) // Version needed
    cdHeader.writeUInt16LE(0, 8) // General purpose bit flag
    cdHeader.writeUInt16LE(8, 10) // Compression: deflate
    cdHeader.writeUInt16LE(0, 12) // Last mod time
    cdHeader.writeUInt16LE(0, 14) // Last mod date
    cdHeader.writeUInt32LE(rec.crc32, 16) // CRC-32
    cdHeader.writeUInt32LE(rec.compressedData.length, 20) // Compressed size
    cdHeader.writeUInt32LE(rec.uncompressedSize, 24) // Uncompressed size
    cdHeader.writeUInt16LE(rec.nameBuf.length, 28) // File name length
    cdHeader.writeUInt16LE(0, 30) // Extra field length
    cdHeader.writeUInt16LE(0, 32) // File comment length
    cdHeader.writeUInt16LE(0, 34) // Disk number start
    cdHeader.writeUInt16LE(0, 36) // Internal file attributes
    cdHeader.writeUInt32LE(0, 38) // External file attributes
    cdHeader.writeUInt32LE(rec.localHeaderOffset, 42) // Relative offset of local header

    buffers.push(cdHeader, rec.nameBuf)
    const recordTotal = cdHeader.length + rec.nameBuf.length
    centralDirSize += recordTotal
    currentOffset += recordTotal
  }

  // 3. Write End of Central Directory Record (EOCD)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0) // Signature PK\x05\x06
  eocd.writeUInt16LE(0, 4) // Number of this disk
  eocd.writeUInt16LE(0, 6) // Disk where central directory starts
  eocd.writeUInt16LE(fileRecords.length, 8) // Total entries in central dir on this disk
  eocd.writeUInt16LE(fileRecords.length, 10) // Total entries in central dir
  eocd.writeUInt32LE(centralDirSize, 12) // Size of central directory
  eocd.writeUInt32LE(centralDirStartOffset, 16) // Offset of start of central directory
  eocd.writeUInt16LE(0, 20) // Comment length

  buffers.push(eocd)
  return Buffer.concat(buffers)
}

/**
 * Extracts all entries from an in-memory ZIP buffer with strict safety bounds.
 */
export function extractZipArchive(
  zipBuffer: Buffer,
  limits: ZipReadLimits = {}
): Map<string, Buffer> {
  const mergedLimits = { ...DEFAULT_ZIP_LIMITS, ...limits }
  const entries = new Map<string, Buffer>()

  if (zipBuffer.length < 22) {
    throw new Error('ZIP_ERROR: Archive buffer is too small to be valid.')
  }

  // Check magic header: PK\x03\x04
  if (
    zipBuffer[0] !== 0x50 ||
    zipBuffer[1] !== 0x4b ||
    zipBuffer[2] !== 0x03 ||
    zipBuffer[3] !== 0x04
  ) {
    throw new Error('ZIP_ERROR: Buffer does not begin with valid PKZIP signature.')
  }

  let offset = 0
  let entryCount = 0
  let totalDecompressedBytes = 0

  while (offset < zipBuffer.length - 30) {
    // Check Local File Header signature: 0x04034b50
    if (
      zipBuffer[offset] !== 0x50 ||
      zipBuffer[offset + 1] !== 0x4b ||
      zipBuffer[offset + 2] !== 0x03 ||
      zipBuffer[offset + 3] !== 0x04
    ) {
      // Reached central directory or non-header chunk
      break
    }

    entryCount++
    if (entryCount > mergedLimits.maxEntries) {
      throw new Error(`ZIP_SECURITY_ERROR: Entry count exceeds limit (${mergedLimits.maxEntries}).`)
    }

    const compressionMethod = zipBuffer.readUInt16LE(offset + 8)
    const compressedSize = zipBuffer.readUInt32LE(offset + 18)
    const uncompressedSize = zipBuffer.readUInt32LE(offset + 22)
    const fileNameLen = zipBuffer.readUInt16LE(offset + 26)
    const extraFieldLen = zipBuffer.readUInt16LE(offset + 28)

    const fileNameStart = offset + 30
    const fileNameEnd = fileNameStart + fileNameLen

    if (fileNameEnd > zipBuffer.length) {
      throw new Error('ZIP_ERROR: Malformed file name boundary in local header.')
    }

    const fileName = zipBuffer.toString('utf-8', fileNameStart, fileNameEnd).replace(/\\/g, '/')

    // Path traversal defense
    if (fileName.includes('..') || fileName.startsWith('/') || /^[a-zA-Z]:/.test(fileName)) {
      throw new Error(`ZIP_SECURITY_ERROR: Path traversal detected in entry name '${fileName}'.`)
    }

    const dataStart = fileNameEnd + extraFieldLen
    const dataEnd = dataStart + compressedSize

    if (dataEnd > zipBuffer.length) {
      throw new Error(`ZIP_ERROR: Entry data boundary out of bounds for '${fileName}'.`)
    }

    if (uncompressedSize > mergedLimits.maxSingleEntryDecompressedBytes) {
      throw new Error(
        `ZIP_SECURITY_ERROR: Entry '${fileName}' uncompressed size (${uncompressedSize} bytes) exceeds limit.`
      )
    }

    const compressedSlice = zipBuffer.subarray(dataStart, dataEnd)
    let decompressed: Buffer

    if (compressionMethod === 0) {
      // Stored (no compression)
      decompressed = Buffer.from(compressedSlice)
    } else if (compressionMethod === 8) {
      // Deflate
      try {
        decompressed = zlib.inflateRawSync(compressedSlice)
      } catch (err: any) {
        throw new Error(`ZIP_ERROR: Failed to decompress entry '${fileName}': ${err.message}`)
      }
    } else {
      throw new Error(`ZIP_ERROR: Unsupported compression method ${compressionMethod} in '${fileName}'.`)
    }

    totalDecompressedBytes += decompressed.length
    if (totalDecompressedBytes > mergedLimits.maxTotalDecompressedBytes) {
      throw new Error(
        `ZIP_SECURITY_ERROR: Total decompressed bytes (${totalDecompressedBytes}) exceeds zip bomb threshold.`
      )
    }

    // Skip directory entries ending with '/'
    if (!fileName.endsWith('/')) {
      entries.set(fileName, decompressed)
    }

    offset = dataEnd
  }

  return entries
}

export const ZipContainer = {
  buildZipArchive,
  extractZipArchive
}
