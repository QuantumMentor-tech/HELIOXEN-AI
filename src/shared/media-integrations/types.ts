/**
 * HELIOXEN AI — Step 44: Media Integration Subsystem Types
 * Types for streaming music, local audio control, playlists, playback state, and device routing.
 */

export type MediaIntegrationType = 'spotify_music' | 'local_media_controller' | 'podcast_stream'

export interface MediaItem {
  readonly id: string
  readonly providerItemId: string
  readonly integrationId: string
  readonly title: string
  readonly artistOrCreator: string
  readonly albumOrCollection?: string
  readonly durationMs?: number
  readonly artworkUrl?: string
  readonly isPlayable: boolean
  readonly externalUrl?: string
  readonly uri?: string
}

export interface MediaPlaylist {
  readonly id: string
  readonly integrationId: string
  readonly title: string
  readonly description?: string
  readonly trackCount: number
  readonly artworkUrl?: string
  readonly ownerName?: string
  readonly uri?: string
}

export interface MediaPlaybackDevice {
  readonly id: string
  readonly name: string
  readonly type: 'computer' | 'smartphone' | 'speaker' | 'local_system'
  readonly isActive: boolean
  readonly volumePercent: number
}

export type PlaybackActionName =
  | 'play'
  | 'pause'
  | 'skip_next'
  | 'skip_previous'
  | 'seek'
  | 'set_volume'
  | 'toggle_shuffle'
  | 'select_device'

export interface MediaPlaybackState {
  readonly integrationId: string
  readonly isPlaying: boolean
  readonly currentItem?: MediaItem
  readonly progressMs: number
  readonly durationMs: number
  readonly volumePercent: number
  readonly activeDevice?: MediaPlaybackDevice
  readonly repeatMode: 'off' | 'track' | 'context'
  readonly shuffleState: boolean
  readonly supportedActions: readonly PlaybackActionName[]
}

export interface MediaControlCommand {
  readonly integrationId: string
  readonly action: PlaybackActionName
  readonly targetDeviceId?: string
  readonly seekPositionMs?: number
  readonly volumePercent?: number
  readonly mediaUri?: string
}

export interface MediaControlResult {
  readonly success: boolean
  readonly integrationId: string
  readonly action: PlaybackActionName
  readonly message: string
  readonly updatedPlaybackState?: MediaPlaybackState
  readonly error?: string
}

export interface MediaCatalogSearchQuery {
  readonly query: string
  readonly integrationId?: string
  readonly types?: readonly ('track' | 'album' | 'playlist')[]
  readonly limit?: number
}

export interface MediaCatalogSearchResult {
  readonly items: readonly MediaItem[]
  readonly playlists: readonly MediaPlaylist[]
  readonly totalMatches: number
}

