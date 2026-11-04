/**
 * HELIOXEN AI — Step 37: VisualHub, Mermaid Visualization, and AI Image Generation
 * Barrel export and singleton factory for main-process VisualHub service.
 */

import * as os from 'os'
import * as path from 'path'
import { VisualHubService } from './VisualHubService'
import type { VisualHubServiceOptions } from './VisualHubService'
import { getMediaLibraryService } from '../media'
import { CredentialStorageService } from '../security'
import { ModelRegistry, PreferencesStorage, ProviderService } from '../ai'

export { VisualHubService }
export type { VisualHubServiceOptions }

let defaultVisualHubService: VisualHubService | null = null
let fallbackProviderService: ProviderService | null = null
let externalProviderServiceGetter: (() => ProviderService) | null = null

export function setVisualHubProviderServiceGetter(getter: () => ProviderService): void {
  externalProviderServiceGetter = getter
}

function resolveDefaultStorageDir(customStorageDir?: string): string {
  if (customStorageDir) return customStorageDir
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron')
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData')
    }
  } catch {
    // Fallback outside Electron runtime
  }
  return path.join(os.tmpdir(), 'helioxen-visualhub-default')
}

function getFallbackProviderService(storageDir: string): ProviderService {
  if (!fallbackProviderService) {
    const credentialStorage = new CredentialStorageService(
      path.join(storageDir, 'credentials.json')
    )
    const modelRegistry = new ModelRegistry(path.join(storageDir, 'model_catalog.json'))
    const preferencesStorage = new PreferencesStorage(
      path.join(storageDir, 'ai_preferences.json'),
      modelRegistry
    )
    fallbackProviderService = new ProviderService(
      credentialStorage,
      undefined,
      modelRegistry,
      undefined,
      preferencesStorage
    )
  }
  return fallbackProviderService
}

export function getVisualHubService(customStorageDir?: string): VisualHubService {
  if (!defaultVisualHubService) {
    const resolvedDir = resolveDefaultStorageDir(customStorageDir)
    defaultVisualHubService = new VisualHubService({
      storageDir: resolvedDir,
      mediaLibraryService: getMediaLibraryService(resolvedDir),
      providerServiceGetter: () =>
        externalProviderServiceGetter
          ? externalProviderServiceGetter()
          : getFallbackProviderService(resolvedDir)
    })
  }
  return defaultVisualHubService
}

export const visualHubService = getVisualHubService()

