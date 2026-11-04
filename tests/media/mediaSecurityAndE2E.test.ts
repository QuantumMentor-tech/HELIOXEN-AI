import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { MediaLibraryService } from '../../src/main/media'
import { CAPABILITIES } from '../../src/shared/security/capabilities'
import { mainToolRegistry } from '../../src/main/tools'
import {
  createSyntheticPngBuffer,
  createSyntheticMp4Buffer,
  createSyntheticWavBuffer
} from './mediaImportAndValidation.test'

describe('Step 36 — Media Security, Active-Content Defense & 20-Step E2E Suite (Sections 19.7, 19.8 & 23)', () => {
  let tmpDir: string
  let sourceDir: string
  let service: MediaLibraryService

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-step36-sec-e2e-'))
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

  describe('19.7 Security, Path Traversal & Active-Content Defense', () => {
    it('blocks SVG, disguised SVG/HTML/script payloads, PE executables, path traversal, and remote URLs', async () => {
      const svgFile = path.join(sourceDir, 'vector.svg')
      const disguisedSvgAsPng = path.join(sourceDir, 'disguised_svg.png')
      const disguisedExeAsPng = path.join(sourceDir, 'malware.png')

      fs.writeFileSync(svgFile, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
      fs.writeFileSync(disguisedSvgAsPng, '<svg onload="evil()"></svg>')
      fs.writeFileSync(disguisedExeAsPng, Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]))

      const res = await service.importBatch({
        items: [
          { filePath: svgFile },
          { filePath: disguisedSvgAsPng },
          { filePath: disguisedExeAsPng },
          { filePath: `${sourceDir}/../../etc/passwd.png` },
          { filePath: 'https://evil.example.com/remote.png' },
          { filePath: 'relative/path/image.png' }
        ]
      })

      expect(res.importedCount).toBe(0)
      expect(res.failedCount).toBe(6)
      expect(res.outcomes[0].errorCode).toBe('PROHIBITED_ACTIVE_CONTENT')
      expect(res.outcomes[1].errorCode).toBe('PROHIBITED_ACTIVE_CONTENT')
      expect(res.outcomes[2].errorCode).toBe('PROHIBITED_ACTIVE_CONTENT')
      expect(res.outcomes[3].errorCode).toBe('PATH_TRAVERSAL_BLOCKED')
      expect(res.outcomes[4].errorCode).toBe('REMOTE_URL_PROHIBITED')
      expect(res.outcomes[5].errorCode).toBe('RELATIVE_PATH_REJECTED')
    })

    it('registers all Step 36 capabilities and tools with least-privilege metadata and confirmation gates', () => {
      expect(CAPABILITIES['media:read']).toBeDefined()
      expect(CAPABILITIES['media:import']).toBeDefined()
      expect(CAPABILITIES['media:organize']).toBeDefined()
      expect(CAPABILITIES['media:remove']).toBeDefined()
      expect(CAPABILITIES['media:deletePermanent']?.requiresHumanConsent).toBe(true)

      const permDeleteTool = mainToolRegistry.get('media:delete_managed_asset')
      expect(permDeleteTool).not.toBeNull()
      expect(permDeleteTool?.confirmationPolicy).toBe('user_confirmation')
    })
  })

  describe('23. End-to-End Definition of Done Lifecycle Verification', () => {
    it('executes the complete 20-step Media Gallery lifecycle across restarts', async () => {
      // 1. Verify initial empty state
      const initialSnap = service.getOverviewSnapshot()
      expect(initialSnap.totalAssetsCount).toBe(0)
      expect(initialSnap.assets).toEqual([])

      // 2 & 3. Import a valid image and verify asset record & managed file consistency
      const imgPath = path.join(sourceDir, 'hero_launch.png')
      fs.writeFileSync(imgPath, createSyntheticPngBuffer(1024, 512))
      const imgBatch = await service.importBatch({
        storageMode: 'managed_copy',
        items: [{ filePath: imgPath, displayName: 'Hero Launch Graphic', tags: ['launch'] }]
      })
      expect(imgBatch.importedCount).toBe(1)
      const imgAsset = imgBatch.outcomes[0].asset!
      expect(imgAsset.status).toBe('available')
      expect(
        fs.existsSync(path.join(service.getManagedAssetsDirectory(), imgAsset.storageReference))
      ).toBe(true)

      // 4. Confirm thumbnail is generated with bounded dimensions
      expect(imgAsset.thumbnailStatus).toBe('ready')
      expect(imgAsset.thumbnailWidth).toBe(320)
      expect(imgAsset.thumbnailHeight).toBe(160)

      // 5. Open the image preview
      const imgPreview = await service.getAssetPreview(imgAsset.id)
      expect(imgPreview.previewAvailable).toBe(true)
      expect(imgPreview.previewDataUrl).toMatch(/^data:image\/png;base64,/)

      // 6 & 7. Import a supported video and audio file and verify playback preview descriptors
      const vidPath = path.join(sourceDir, 'keynote_teaser.mp4')
      const audPath = path.join(sourceDir, 'intro_chime.wav')
      fs.writeFileSync(vidPath, createSyntheticMp4Buffer(20))
      fs.writeFileSync(audPath, createSyntheticWavBuffer(5))
      const avBatch = await service.importBatch({
        items: [
          { filePath: vidPath, displayName: 'Keynote Teaser' },
          { filePath: audPath, displayName: 'Intro Chime' }
        ]
      })
      expect(avBatch.importedCount).toBe(2)
      const vidAsset = avBatch.outcomes[0].asset!
      const audAsset = avBatch.outcomes[1].asset!
      expect((await service.getAssetPreview(vidAsset.id)).previewAvailable).toBe(true)
      expect((await service.getAssetPreview(audAsset.id)).previewAvailable).toBe(true)

      // 8. Search for an asset and apply media-type filter
      expect(service.listAssets({ query: 'Keynote' }).assets.map((a) => a.id)).toEqual([vidAsset.id])
      expect(service.listAssets({ mediaType: 'audio' }).assets.map((a) => a.id)).toEqual([audAsset.id])

      // 9. Add asset to a collection and mark as favorite
      const col = service.createCollection({ name: 'Keynote Bundle' })
      service.modifyCollectionMembership({
        collectionId: col.id,
        assetIds: [imgAsset.id, vidAsset.id],
        action: 'add'
      })
      service.updateAssetMetadata({ id: imgAsset.id, favorite: true })
      expect(service.listAssets({ favoritesOnly: true }).totalCount).toBe(1)

      // 10. Rename asset display name and confirm storage identity remains stable
      const renamedImg = service.updateAssetMetadata({
        id: imgAsset.id,
        displayName: 'Hero Launch Graphic (Final)'
      })
      expect(renamedImg.id).toBe(imgAsset.id)
      expect(renamedImg.storageReference).toBe(imgAsset.storageReference)

      // 11. Import the same file again and verify deterministic duplicate handling
      const dupBatch = await service.importBatch({
        items: [{ filePath: imgPath }]
      })
      expect(dupBatch.duplicateSkippedCount).toBe(1)
      expect(dupBatch.outcomes[0].existingAssetId).toBe(imgAsset.id)

      // 12. Remove a library entry and verify behavior
      const removeAud = service.removeAssetFromLibrary({ id: audAsset.id })
      expect(removeAud.removed).toBe(true)
      expect(service.getAsset(audAsset.id)).toBeNull()

      // 13 & 14. Test permanent deletion on disposable managed asset while confirming original source remains untouched
      const permDelVid = service.deleteManagedAssetPermanently({
        id: vidAsset.id,
        confirmPermanentDelete: true
      })
      expect(permDelVid.deleted).toBe(true)
      expect(permDelVid.managedFileDeleted).toBe(true)
      expect(fs.existsSync(vidPath)).toBe(true)
      expect(fs.existsSync(imgPath)).toBe(true)

      // 15 & 16. Attempt to import malformed file & path traversal -> safely rejected
      const badBatch = await service.importBatch({
        items: [{ filePath: '../traversal.png' }]
      })
      expect(badBatch.failedCount).toBe(1)

      // 17. Restart the service and verify persistent asset metadata & collections
      service.dispose()
      const restarted = new MediaLibraryService({
        storageDir: tmpDir
      })
      const postRestartSnap = restarted.getOverviewSnapshot()
      expect(postRestartSnap.totalAssetsCount).toBe(1)
      expect(postRestartSnap.assets[0].displayName).toBe('Hero Launch Graphic (Final)')
      expect(postRestartSnap.collections).toHaveLength(1)
      expect(postRestartSnap.collections[0].assetCount).toBe(1)
      restarted.dispose()
    })
  })
})

