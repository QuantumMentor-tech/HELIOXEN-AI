/**
 * HELIOXEN AI — Step 36: Media Gallery and Media Asset Management
 * Barrel export and singleton factory for main-process media library service.
 */

import * as os from 'os'
import * as path from 'path'
import {
  MediaLibraryService,
  computeBoundedThumbnailDimensions
} from './MediaLibraryService'
import type { MediaLibraryServiceOptions } from './MediaLibraryService'

export {
  MediaLibraryService,
  computeBoundedThumbnailDimensions
}

export type { MediaLibraryServiceOptions }

let defaultMediaLibraryService: MediaLibraryService | null = null

export function getMediaLibraryService(customStorageDir?: string): MediaLibraryService {
  if (!defaultMediaLibraryService) {
    let resolvedDir = customStorageDir
    if (!resolvedDir) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { app } = require('electron')
        if (app && typeof app.getPath === 'function') {
          resolvedDir = app.getPath('userData')
        }
      } catch {
        resolvedDir = undefined
      }
    }
    if (!resolvedDir) {
      resolvedDir = path.join(os.tmpdir(), 'helioxen-media-library-default')
    }

    defaultMediaLibraryService = new MediaLibraryService({
      storageDir: resolvedDir
    })
  }
  return defaultMediaLibraryService
}

export const mediaLibraryService = getMediaLibraryService()

