/**
 * HELIOXEN AI — Step 44: Media Integration Service
 * Manages media catalog search, playlist inspection, playback state, and device controls.
 * Respects digital rights, provider rate limits, and official API capabilities.
 */

import {
  MediaItem,
  MediaPlaylist,
  MediaPlaybackDevice,
  MediaPlaybackState,
  MediaControlCommand,
  MediaControlResult,
  MediaCatalogSearchQuery,
  MediaCatalogSearchResult
} from '../../shared/media-integrations/types'
import { IntegrationsManager } from '../integrations/IntegrationsManager'
import { securityLogger } from '../security/securityLogger'

export interface MediaIntegrationServiceOptions {
  readonly integrationsManager?: IntegrationsManager
  readonly nowFn?: () => number
}

export class MediaIntegrationService {
  private readonly integrationsManager?: IntegrationsManager
  private readonly nowFn: () => number

  // In-memory playback states per integration
  private playbackStates: Map<string, MediaPlaybackState> = new Map()

  // Devices per integration
  private devices: Map<string, MediaPlaybackDevice[]> = new Map()

  // Playlists per integration
  private playlists: Map<string, MediaPlaylist[]> = new Map()

  // Track catalog per integration
  private catalog: Map<string, MediaItem[]> = new Map()

  constructor(options: MediaIntegrationServiceOptions = {}) {
    this.integrationsManager = options.integrationsManager
    this.nowFn = options.nowFn ?? (() => Date.now())

    this.initializeDefaultData()
  }

  private initializeDefaultData(): void {
    // 1. Spotify Streaming Mock/Adapter Data
    const spotifyDevices: MediaPlaybackDevice[] = [
      { id: 'dev_desk_1', name: 'MacBook Pro / Windows Desktop (Helioxen)', type: 'computer', isActive: true, volumePercent: 75 },
      { id: 'dev_phone_1', name: 'Pixel / iPhone Mobile', type: 'smartphone', isActive: false, volumePercent: 60 }
    ]
    this.devices.set('integration_spotify_streaming', spotifyDevices)

    const spotifyPlaylists: MediaPlaylist[] = [
      {
        id: 'pl_deep_focus',
        integrationId: 'integration_spotify_streaming',
        title: 'Deep Focus & Ambient Architecture',
        description: 'Atmospheric electronic and minimal focus soundscapes for programming.',
        trackCount: 48,
        artworkUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300',
        ownerName: 'Spotify Curated',
        uri: 'spotify:playlist:deep_focus'
      },
      {
        id: 'pl_cyber_synth',
        integrationId: 'integration_spotify_streaming',
        title: 'Cyberpunk & Synthwave Drive',
        description: 'High-energy retrofuturistic synth tracks.',
        trackCount: 62,
        artworkUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300',
        ownerName: 'Helioxen Music',
        uri: 'spotify:playlist:cyber_synth'
      }
    ]
    this.playlists.set('integration_spotify_streaming', spotifyPlaylists)

    const spotifyTracks: MediaItem[] = [
      {
        id: 'track_sp_1',
        providerItemId: 'spotify_trk_1101',
        integrationId: 'integration_spotify_streaming',
        title: 'Orbital Resonance',
        artistOrCreator: 'Solar Fields',
        albumOrCollection: 'Movements',
        durationMs: 342000,
        artworkUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300',
        isPlayable: true,
        externalUrl: 'https://open.spotify.com/track/orbital-resonance',
        uri: 'spotify:track:1101'
      },
      {
        id: 'track_sp_2',
        providerItemId: 'spotify_trk_1102',
        integrationId: 'integration_spotify_streaming',
        title: 'Reflections in Code',
        artistOrCreator: 'Tycho',
        albumOrCollection: 'Epoch',
        durationMs: 275000,
        artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300',
        isPlayable: true,
        externalUrl: 'https://open.spotify.com/track/reflections-code',
        uri: 'spotify:track:1102'
      },
      {
        id: 'track_sp_3',
        providerItemId: 'spotify_trk_1103',
        integrationId: 'integration_spotify_streaming',
        title: 'Neon Horizon',
        artistOrCreator: 'Kavinsky',
        albumOrCollection: 'OutRun',
        durationMs: 215000,
        artworkUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300',
        isPlayable: true,
        externalUrl: 'https://open.spotify.com/track/neon-horizon',
        uri: 'spotify:track:1103'
      }
    ]
    this.catalog.set('integration_spotify_streaming', spotifyTracks)

    this.playbackStates.set('integration_spotify_streaming', {
      integrationId: 'integration_spotify_streaming',
      isPlaying: false,
      currentItem: spotifyTracks[0],
      progressMs: 45000,
      durationMs: 342000,
      volumePercent: 75,
      activeDevice: spotifyDevices[0],
      repeatMode: 'off',
      shuffleState: false,
      supportedActions: ['play', 'pause', 'skip_next', 'skip_previous', 'seek', 'set_volume', 'toggle_shuffle', 'select_device']
    })

    // 2. Local Media Controller Data
    const localDevices: MediaPlaybackDevice[] = [
      { id: 'dev_local_audio', name: 'Default Audio Output (DirectSound / CoreAudio)', type: 'local_system', isActive: true, volumePercent: 85 }
    ]
    this.devices.set('integration_local_media', localDevices)

    const localTracks: MediaItem[] = [
      {
        id: 'track_local_1',
        providerItemId: 'local_asset_audio_1',
        integrationId: 'integration_local_media',
        title: 'Helioxen Core Briefing Audio',
        artistOrCreator: 'Local Asset Library',
        albumOrCollection: 'Step 36 Media Gallery',
        durationMs: 180000,
        isPlayable: true,
        uri: 'local://media/audio/briefing-01.mp3'
      },
      {
        id: 'track_local_2',
        providerItemId: 'local_asset_audio_2',
        integrationId: 'integration_local_media',
        title: 'Architecture Acoustic Master',
        artistOrCreator: 'System Media Engine',
        albumOrCollection: 'Step 36 Media Gallery',
        durationMs: 240000,
        isPlayable: true,
        uri: 'local://media/audio/acoustic-master.wav'
      }
    ]
    this.catalog.set('integration_local_media', localTracks)

    this.playbackStates.set('integration_local_media', {
      integrationId: 'integration_local_media',
      isPlaying: false,
      currentItem: localTracks[0],
      progressMs: 0,
      durationMs: 180000,
      volumePercent: 85,
      activeDevice: localDevices[0],
      repeatMode: 'off',
      shuffleState: false,
      supportedActions: ['play', 'pause', 'skip_next', 'skip_previous', 'seek', 'set_volume']
    })
  }

  public async searchCatalog(query: MediaCatalogSearchQuery): Promise<MediaCatalogSearchResult> {
    const integrationId = query.integrationId || 'integration_spotify_streaming'
    const integration = this.integrationsManager?.getIntegration(integrationId)

    if (integration && integration.status !== 'connected') {
      throw new Error(`Media service "${integration.displayName}" is not connected (status: ${integration.status}).`)
    }

    const items = this.catalog.get(integrationId) || []
    const playlists = this.playlists.get(integrationId) || []
    const q = query.query.toLowerCase().trim()

    const matchedItems = items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.artistOrCreator.toLowerCase().includes(q) ||
        (item.albumOrCollection && item.albumOrCollection.toLowerCase().includes(q))
    )

    const matchedPlaylists = playlists.filter(
      (pl) => pl.title.toLowerCase().includes(q) || (pl.description && pl.description.toLowerCase().includes(q))
    )

    const limit = query.limit || 20
    return {
      items: matchedItems.slice(0, limit),
      playlists: matchedPlaylists.slice(0, limit),
      totalMatches: matchedItems.length + matchedPlaylists.length
    }
  }

  public getPlaybackState(integrationId: string): MediaPlaybackState {
    const state = this.playbackStates.get(integrationId)
    if (!state) {
      throw new Error(`No playback session found for integration ${integrationId}`)
    }
    return state
  }

  public listDevices(integrationId: string): MediaPlaybackDevice[] {
    return this.devices.get(integrationId) || []
  }

  public listPlaylists(integrationId: string): MediaPlaylist[] {
    return this.playlists.get(integrationId) || []
  }

  public async controlPlayback(command: MediaControlCommand): Promise<MediaControlResult> {
    const integrationId = command.integrationId
    const integration = this.integrationsManager?.getIntegration(integrationId)

    if (integration && integration.status !== 'connected') {
      return {
        success: false,
        integrationId,
        action: command.action,
        message: `Integration "${integration.displayName}" is not connected.`,
        error: 'SERVICE_DISCONNECTED'
      }
    }

    const currentState = this.playbackStates.get(integrationId)
    if (!currentState) {
      return {
        success: false,
        integrationId,
        action: command.action,
        message: `Playback state not initialized for ${integrationId}.`,
        error: 'STATE_NOT_FOUND'
      }
    }

    // Verify capability
    if (!currentState.supportedActions.includes(command.action)) {
      return {
        success: false,
        integrationId,
        action: command.action,
        message: `Action "${command.action}" is not supported by integration ${integrationId}.`,
        error: 'UNSUPPORTED_ACTION'
      }
    }

    let updatedState: MediaPlaybackState = { ...currentState }

    switch (command.action) {
      case 'play':
        updatedState = { ...updatedState, isPlaying: true }
        break
      case 'pause':
        updatedState = { ...updatedState, isPlaying: false }
        break
      case 'skip_next': {
        const catalog = this.catalog.get(integrationId) || []
        const currentIdx = catalog.findIndex((t) => t.id === currentState.currentItem?.id)
        const nextTrack = catalog[(currentIdx + 1) % catalog.length] || catalog[0]
        updatedState = {
          ...updatedState,
          currentItem: nextTrack,
          progressMs: 0,
          durationMs: nextTrack?.durationMs || 180000,
          isPlaying: true
        }
        break
      }
      case 'skip_previous': {
        const catalog = this.catalog.get(integrationId) || []
        const currentIdx = catalog.findIndex((t) => t.id === currentState.currentItem?.id)
        const prevIdx = currentIdx <= 0 ? catalog.length - 1 : currentIdx - 1
        const prevTrack = catalog[prevIdx] || catalog[0]
        updatedState = {
          ...updatedState,
          currentItem: prevTrack,
          progressMs: 0,
          durationMs: prevTrack?.durationMs || 180000,
          isPlaying: true
        }
        break
      }
      case 'seek':
        if (command.seekPositionMs !== undefined) {
          const clamped = Math.max(0, Math.min(command.seekPositionMs, currentState.durationMs))
          updatedState = { ...updatedState, progressMs: clamped }
        }
        break
      case 'set_volume':
        if (command.volumePercent !== undefined) {
          const clampedVol = Math.max(0, Math.min(command.volumePercent, 100))
          updatedState = { ...updatedState, volumePercent: clampedVol }
        }
        break
      case 'toggle_shuffle':
        updatedState = { ...updatedState, shuffleState: !currentState.shuffleState }
        break
      case 'select_device':
        if (command.targetDeviceId) {
          const devList = this.devices.get(integrationId) || []
          const found = devList.find((d) => d.id === command.targetDeviceId)
          if (found) {
            updatedState = { ...updatedState, activeDevice: { ...found, isActive: true } }
          }
        }
        break
    }

    this.playbackStates.set(integrationId, updatedState)

    securityLogger.logEvent('MEDIA_CONTROL_ACTION', 'user', 'PERMITTED', {
      integrationId,
      action: command.action,
      trackTitle: updatedState.currentItem?.title
    })

    return {
      success: true,
      integrationId,
      action: command.action,
      message: `Playback action "${command.action}" executed successfully.`,
      updatedPlaybackState: updatedState
    }
  }
}

