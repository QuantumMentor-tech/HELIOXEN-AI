import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  MediaLibraryService,
  computeBoundedThumbnailDimensions
} from '../../src/main/media'
import {
  createSyntheticPngBuffer,
  createSyntheticMp4Buffer,
  createSyntheticWavBuffer
} from './mediaImportAndValidation.test'

describe('Step 36 — Bounded Thumbnails, Caching, Previews & Capture Save (Sections 19.3 & 19.4)', () => {
  let tmpDir: string
  let sourceDir: string
  let service: MediaLibraryService

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-step36-thumbs-'))
    sourceDir = path.join(tmpDir, 'sources')
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

  it('computes bounded aspect-ratio-preserving thumbnail dimensions and deduplicates concurrent thumbnail requests', async () => {
    const dims = computeBoundedThumbnailDimensions(1600, 800, 320)
    expect(dims).toEqual({ width: 320, height: 160 })

    const imgPath = path.join(sourceDir, 'wide_banner.png')
    fs.writeFileSync(imgPath, createSyntheticPngBuffer(1600, 800))

    const batch = await service.importBatch({
      items: [{ filePath: imgPath }]
    })
    const asset = batch.outcomes[0].asset!
    expect(asset.thumbnailStatus).toBe('ready')
    expect(asset.thumbnailWidth).toBe(320)
    expect(asset.thumbnailHeight).toBe(160)

    // Concurrent calls for the same asset return identical data URL
    const [thumb1, thumb2] = await Promise.all([
      service.getOrGenerateThumbnailDataUrl(asset.id),
      service.getOrGenerateThumbnailDataUrl(asset.id)
    ])
    expect(thumb1).toBeTruthy()
    expect(thumb1).toBe(thumb2)
  })

  it('keeps an imported image asset available even when thumbnail generation fails', async () => {
    service.setSimulateThumbnailFailure(true)
    const imgPath = path.join(sourceDir, 'thumb_fail_still_available.png')
    fs.writeFileSync(imgPath, createSyntheticPngBuffer(640, 480))

    const batch = await service.importBatch({
      items: [{ filePath: imgPath }]
    })
    const asset = batch.outcomes[0].asset!
    expect(asset.status).toBe('available')
    expect(asset.thumbnailStatus).toBe('failed')

    service.setSimulateThumbnailFailure(false)
    // Preview still works for the primary asset and recovers thumbnail
    const preview = await service.getAssetPreview(asset.id)
    expect(preview.previewAvailable).toBe(true)
    expect(preview.previewDataUrl).toMatch(/^data:image\/png;base64,/)
  })

  it('provides accurate preview descriptors for image, video, audio, and saves Step 22/32 captured images', async () => {
    const mp4Path = path.join(sourceDir, 'clip.mp4')
    const wavPath = path.join(sourceDir, 'clip.wav')
    fs.writeFileSync(mp4Path, createSyntheticMp4Buffer(8))
    fs.writeFileSync(wavPath, createSyntheticWavBuffer(3))

    const batch = await service.importBatch({
      items: [{ filePath: mp4Path }, { filePath: wavPath }]
    })
    const videoAsset = batch.outcomes[0].asset!
    const audioAsset = batch.outcomes[1].asset!

    const videoPreview = await service.getAssetPreview(videoAsset.id)
    expect(videoPreview.previewAvailable).toBe(true)
    expect(videoPreview.mediaType).toBe('video')
    expect(videoPreview.durationSeconds).toBe(8)

    const audioPreview = await service.getAssetPreview(audioAsset.id)
    expect(audioPreview.previewAvailable).toBe(true)
    expect(audioPreview.mediaType).toBe('audio')
    expect(audioPreview.durationSeconds).toBe(3)

    // Save a captured still image from Step 22 / Step 32 data URL
    const pngBuf = createSyntheticPngBuffer(320, 240)
    const dataUrl = `data:image/png;base64,${pngBuf.toString('base64')}`
    const savedCapture = await service.saveCapturedMedia({
      displayName: 'Saved Browser Screenshot',
      dataUrl,
      mimeType: 'image/png',
      sourceType: 'saved_browser_screenshot',
      tags: ['research', 'screenshot']
    })

    expect(savedCapture.id).toMatch(/^media_/)
    expect(savedCapture.sourceType).toBe('saved_browser_screenshot')
    expect(savedCapture.width).toBe(320)
    expect(savedCapture.height).toBe(240)
  })
})

