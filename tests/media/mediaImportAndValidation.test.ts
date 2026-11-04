import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { MediaLibraryService } from '../../src/main/media'

/**
 * Generates deterministic synthetic binary media buffers with valid magic bytes and headers.
 */
export function createSyntheticPngBuffer(width = 640, height = 480): Buffer {
  const buf = Buffer.alloc(33)
  // PNG signature
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0)
  // IHDR length (13) + 'IHDR'
  buf.writeUInt32BE(13, 8)
  buf.write('IHDR', 12, 'ascii')
  buf.writeUInt32BE(width, 16)
  buf.writeUInt32BE(height, 20)
  buf[24] = 8 // bit depth
  buf[25] = 6 // color type RGBA
  return buf
}

export function createSyntheticJpegBuffer(width = 800, height = 600): Buffer {
  const buf = Buffer.alloc(24)
  // SOI FF D8
  buf[0] = 0xff
  buf[1] = 0xd8
  // SOF0 marker FF C0
  buf[2] = 0xff
  buf[3] = 0xc0
  buf.writeUInt16BE(17, 4) // segment length
  buf[6] = 8 // precision
  buf.writeUInt16BE(height, 7)
  buf.writeUInt16BE(width, 9)
  // EOI FF D9
  buf[22] = 0xff
  buf[23] = 0xd9
  return buf
}

export function createSyntheticMp4Buffer(durationSeconds = 12): Buffer {
  const buf = Buffer.alloc(64)
  // ftyp box
  buf.writeUInt32BE(20, 0)
  buf.write('ftyp', 4, 'ascii')
  buf.write('isom', 8, 'ascii')
  // mvhd box at offset 20
  buf.writeUInt32BE(32, 20)
  buf.write('mvhd', 24, 'ascii')
  buf[28] = 0 // version 0
  buf.writeUInt32BE(1000, 40) // timescale = 1000
  buf.writeUInt32BE(durationSeconds * 1000, 44) // duration
  return buf
}

export function createSyntheticWavBuffer(durationSeconds = 2): Buffer {
  const byteRate = 16000
  const dataBytes = byteRate * durationSeconds
  const buf = Buffer.alloc(44 + 16)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(36 + dataBytes, 4)
  buf.write('WAVE', 8, 'ascii')
  buf.write('fmt ', 12, 'ascii')
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // 1 channel
  buf.writeUInt32LE(8000, 24) // sampleRate
  buf.writeUInt32LE(byteRate, 28) // byteRate
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36, 'ascii')
  buf.writeUInt32LE(dataBytes, 40)
  return buf
}

describe('Step 36 — Media Import, Layered Validation & Storage Modes (Sections 19.1 & 19.2)', () => {
  let tmpDir: string
  let sourceDir: string
  let service: MediaLibraryService

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-step36-import-'))
    sourceDir = path.join(tmpDir, 'user_sources')
    fs.mkdirSync(sourceDir, { recursive: true })
    service = new MediaLibraryService({
      storageDir: tmpDir
    })
  })

  afterEach(() => {
    service.dispose()
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('imports valid PNG, JPEG, MP4, and WAV files, extracts dimensions/duration, and preserves original files', async () => {
    const pngPath = path.join(sourceDir, 'hero_diagram.png')
    const jpgPath = path.join(sourceDir, 'team_photo.jpg')
    const mp4Path = path.join(sourceDir, 'demo_walkthrough.mp4')
    const wavPath = path.join(sourceDir, 'voice_note.wav')

    fs.writeFileSync(pngPath, createSyntheticPngBuffer(1280, 720))
    fs.writeFileSync(jpgPath, createSyntheticJpegBuffer(1920, 1080))
    fs.writeFileSync(mp4Path, createSyntheticMp4Buffer(15))
    fs.writeFileSync(wavPath, createSyntheticWavBuffer(4))

    const batchRes = await service.importBatch({
      storageMode: 'managed_copy',
      items: [
        { filePath: pngPath, tags: ['ui', 'diagram'], favorite: true },
        { filePath: jpgPath, tags: ['photo'] },
        { filePath: mp4Path, tags: ['video'] },
        { filePath: wavPath, tags: ['audio'] }
      ]
    })

    expect(batchRes.importedCount).toBe(4)
    expect(batchRes.failedCount).toBe(0)

    const pngAsset = batchRes.outcomes[0].asset!
    expect(pngAsset.mediaType).toBe('image')
    expect(pngAsset.width).toBe(1280)
    expect(pngAsset.height).toBe(720)
    expect(pngAsset.exifStrippedForPrivacy).toBe(true)

    const jpgAsset = batchRes.outcomes[1].asset!
    expect(jpgAsset.width).toBe(1920)
    expect(jpgAsset.height).toBe(1080)

    const mp4Asset = batchRes.outcomes[2].asset!
    expect(mp4Asset.mediaType).toBe('video')
    expect(mp4Asset.durationSeconds).toBe(15)

    const wavAsset = batchRes.outcomes[3].asset!
    expect(wavAsset.mediaType).toBe('audio')
    expect(wavAsset.durationSeconds).toBe(4)

    // Verify original source files are completely untouched
    expect(fs.existsSync(pngPath)).toBe(true)
    expect(fs.existsSync(jpgPath)).toBe(true)
    expect(fs.existsSync(mp4Path)).toBe(true)
    expect(fs.existsSync(wavPath)).toBe(true)
  })

  it('rejects unsupported extensions, mismatched magic bytes, zero-byte files, oversized files, and excessive image dimensions', async () => {
    const zeroPath = path.join(sourceDir, 'empty.png')
    const mismatchPath = path.join(sourceDir, 'fake_image.png')
    const unsupportedPath = path.join(sourceDir, 'archive.zip')
    const hugeDimsPath = path.join(sourceDir, 'extreme_dims.png')

    fs.writeFileSync(zeroPath, Buffer.alloc(0))
    fs.writeFileSync(mismatchPath, Buffer.from('This is plain text, not a PNG', 'utf-8'))
    fs.writeFileSync(unsupportedPath, Buffer.from('PK\x03\x04zipdata', 'utf-8'))
    fs.writeFileSync(hugeDimsPath, createSyntheticPngBuffer(16000, 16000)) // Exceeds 8192px limit

    const res = await service.importBatch({
      items: [
        { filePath: zeroPath },
        { filePath: mismatchPath },
        { filePath: unsupportedPath },
        { filePath: hugeDimsPath }
      ]
    })

    expect(res.importedCount).toBe(0)
    expect(res.failedCount).toBe(4)
    expect(res.outcomes[0].errorCode).toBe('EMPTY_FILE')
    expect(res.outcomes[1].errorCode).toBe('EXTENSION_CONTENT_MISMATCH')
    expect(res.outcomes[2].errorCode).toBe('UNSUPPORTED_EXTENSION')
    expect(res.outcomes[3].errorCode).toBe('IMAGE_DIMENSIONS_EXCEEDED')
    expect(service.listAssets().totalCount).toBe(0)
  })

  it('detects SHA-256 duplicates deterministically even when filenames differ', async () => {
    const fileA = path.join(sourceDir, 'original_name.png')
    const fileB = path.join(sourceDir, 'copied_different_name.png')
    const payload = createSyntheticPngBuffer(500, 400)
    fs.writeFileSync(fileA, payload)
    fs.writeFileSync(fileB, payload)

    const firstImport = await service.importBatch({
      items: [{ filePath: fileA }]
    })
    expect(firstImport.importedCount).toBe(1)
    const firstId = firstImport.outcomes[0].asset!.id

    // Second import with default skip_and_return_existing policy
    const secondImport = await service.importBatch({
      items: [{ filePath: fileB }],
      duplicatePolicy: 'skip_and_return_existing'
    })
    expect(secondImport.importedCount).toBe(0)
    expect(secondImport.duplicateSkippedCount).toBe(1)
    expect(secondImport.outcomes[0].existingAssetId).toBe(firstId)
    expect(service.listAssets().totalCount).toBe(1)

    // Explicit allow_duplicate policy creates a second asset record
    const explicitDup = await service.importBatch({
      items: [{ filePath: fileB }],
      duplicatePolicy: 'allow_duplicate'
    })
    expect(explicitDup.importedCount).toBe(1)
    expect(service.listAssets().totalCount).toBe(2)
  })

  it('tracks external_reference assets, marks them unavailable if the external file disappears, and supports authorized relinking', async () => {
    const extFile = path.join(sourceDir, 'external_reference_photo.png')
    fs.writeFileSync(extFile, createSyntheticPngBuffer(400, 300))

    const res = await service.importBatch({
      storageMode: 'external_reference',
      items: [{ filePath: extFile }]
    })
    const asset = res.outcomes[0].asset!
    expect(asset.storageMode).toBe('external_reference')
    expect(asset.status).toBe('available')

    // Simulate external file moved/renamed outside HELIOXEN
    const movedFile = path.join(sourceDir, 'relocated_photo.png')
    fs.renameSync(extFile, movedFile)

    const missingState = service.getAsset(asset.id)
    expect(missingState?.status).toBe('unavailable')
    expect(missingState?.unavailableReason).toBe('MISSING_EXTERNAL_SOURCE_FILE')

    // Authorized relink restores availability
    const relinked = service.relinkExternalAsset({
      id: asset.id,
      newFilePath: movedFile
    })
    expect(relinked.status).toBe('available')
    expect(relinked.unavailableReason).toBeNull()
  })
})

