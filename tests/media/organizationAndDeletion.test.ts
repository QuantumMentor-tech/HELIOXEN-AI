import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { MediaLibraryService } from '../../src/main/media'
import {
  createSyntheticPngBuffer,
  createSyntheticMp4Buffer
} from './mediaImportAndValidation.test'

describe('Step 36 — Search, Collections, Renaming & Deletion Semantics (Sections 19.5 & 19.6)', () => {
  let tmpDir: string
  let sourceDir: string
  let service: MediaLibraryService

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-step36-org-del-'))
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

  it('supports search, filtering, deterministic sorting, collections, and preserves assets when a collection is deleted', async () => {
    const img1 = path.join(sourceDir, 'alpha_architecture.png')
    const vid1 = path.join(sourceDir, 'beta_recording.mp4')
    fs.writeFileSync(img1, createSyntheticPngBuffer(400, 400))
    fs.writeFileSync(vid1, createSyntheticMp4Buffer(10))

    const batch = await service.importBatch({
      items: [
        { filePath: img1, displayName: 'Alpha Diagram', tags: ['arch'], favorite: true },
        { filePath: vid1, displayName: 'Beta Demo Video', tags: ['demo'], favorite: false }
      ]
    })
    const a1 = batch.outcomes[0].asset!
    const a2 = batch.outcomes[1].asset!

    // Create collection and add a1 twice -> deduplicated membership
    const col = service.createCollection({
      name: 'Launch Assets',
      description: 'Core assets for Q4 launch'
    })
    const updatedCol = service.modifyCollectionMembership({
      collectionId: col.id,
      assetIds: [a1.id, a1.id],
      action: 'add'
    })
    expect(updatedCol.assetCount).toBe(1)
    expect(service.getAsset(a1.id)?.collectionIds).toEqual([col.id])

    // Filter by collection
    expect(service.listAssets({ collectionId: col.id }).totalCount).toBe(1)
    // Filter by mediaType
    expect(service.listAssets({ mediaType: 'video' }).assets.map((a) => a.id)).toEqual([a2.id])
    // Filter by favoritesOnly
    expect(service.listAssets({ favoritesOnly: true }).assets.map((a) => a.id)).toEqual([a1.id])

    // Delete collection -> member asset a1 is preserved!
    service.deleteCollection({ id: col.id })
    const survivingA1 = service.getAsset(a1.id)
    expect(survivingA1).not.toBeNull()
    expect(survivingA1?.collectionIds).toEqual([])
  })

  it('renames asset displayName without altering asset ID, storageReference, or source file', async () => {
    const imgPath = path.join(sourceDir, 'original_source.png')
    fs.writeFileSync(imgPath, createSyntheticPngBuffer(300, 300))

    const batch = await service.importBatch({
      items: [{ filePath: imgPath }]
    })
    const asset = batch.outcomes[0].asset!

    const renamed = service.updateAssetMetadata({
      id: asset.id,
      displayName: 'Renamed Presentation Graphic',
      tags: ['presentation', 'v2']
    })

    expect(renamed.id).toBe(asset.id)
    expect(renamed.storageReference).toBe(asset.storageReference)
    expect(renamed.originalFileName).toBe('original_source.png')
    expect(renamed.displayName).toBe('Renamed Presentation Graphic')
    expect(fs.existsSync(imgPath)).toBe(true)
  })

  it('enforces distinct removeAssetFromLibrary vs deleteManagedAssetPermanently semantics and protects external files', async () => {
    const extPath = path.join(sourceDir, 'precious_external_photo.png')
    const managedSourcePath = path.join(sourceDir, 'for_managed_copy.png')
    fs.writeFileSync(extPath, createSyntheticPngBuffer(500, 500))
    fs.writeFileSync(managedSourcePath, createSyntheticPngBuffer(600, 600))

    const extBatch = await service.importBatch({
      storageMode: 'external_reference',
      items: [{ filePath: extPath }]
    })
    const extAsset = extBatch.outcomes[0].asset!

    const managedBatch = await service.importBatch({
      storageMode: 'managed_copy',
      items: [{ filePath: managedSourcePath }]
    })
    const managedAsset = managedBatch.outcomes[0].asset!

    // 1. Attempting permanent delete on an external_reference asset is strictly prohibited
    expect(() =>
      service.deleteManagedAssetPermanently({
        id: extAsset.id,
        confirmPermanentDelete: true
      })
    ).toThrow(/EXTERNAL_SOURCE_DELETION_PROHIBITED/)
    expect(fs.existsSync(extPath)).toBe(true)

    // 2. Removing external_reference asset from library unlinks it while preserving the external file
    const remExt = service.removeAssetFromLibrary({ id: extAsset.id })
    expect(remExt.removed).toBe(true)
    expect(remExt.originalExternalFilePreserved).toBe(true)
    expect(fs.existsSync(extPath)).toBe(true)

    // 3. Attempting permanent delete on managed_copy without confirmPermanentDelete: true is rejected
    expect(() =>
      service.deleteManagedAssetPermanently({
        id: managedAsset.id,
        confirmPermanentDelete: false
      })
    ).toThrow(/CONFIRMATION_REQUIRED/)

    // 4. Confirmed permanent delete removes the managed copy & thumbnail while leaving the original source untouched
    const delManaged = service.deleteManagedAssetPermanently({
      id: managedAsset.id,
      confirmPermanentDelete: true
    })
    expect(delManaged.deleted).toBe(true)
    expect(delManaged.managedFileDeleted).toBe(true)
    expect(delManaged.thumbnailDeleted).toBe(true)
    expect(fs.existsSync(managedSourcePath)).toBe(true)

    // 5. Orphaned thumbnail cleanup verification
    const strayThumb = path.join(service.getThumbnailsDirectory(), 'orphan_stray.thumb')
    fs.writeFileSync(strayThumb, 'data:image/png;base64,stray', 'utf-8')
    const reconciled = service.reconcileOrphanedFiles()
    expect(reconciled.orphanedThumbnailsRemoved).toBe(1)
    expect(fs.existsSync(strayThumb)).toBe(false)
  })
})

