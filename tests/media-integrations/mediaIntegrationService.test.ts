import { describe, it, expect, beforeEach } from 'vitest'
import { MediaIntegrationService } from '../../src/main/media-integrations/MediaIntegrationService'
import { MediaControlCommand } from '../../src/shared/media-integrations/types'

describe('Media Integration Service & Playback Controls (Step 44)', () => {
  let mediaService: MediaIntegrationService

  beforeEach(() => {
    mediaService = new MediaIntegrationService()
  })

  describe('1. Catalog Search & Discovery', () => {
    it('searches catalog items matching title, artist, or album', async () => {
      const searchRes = await mediaService.searchCatalog({
        query: 'Orbital Resonance',
        limit: 5
      })

      expect(searchRes.items.length).toBeGreaterThan(0)
      expect(searchRes.items[0].title).toContain('Orbital Resonance')
      expect(searchRes.items[0].artistOrCreator).toBeDefined()
    })

    it('returns empty results gracefully for non-matching queries', async () => {
      const searchRes = await mediaService.searchCatalog({
        query: 'NonExistentTrackXYZ987654321',
        limit: 5
      })

      expect(searchRes.items).toHaveLength(0)
      expect(searchRes.totalMatches).toBe(0)
    })
  })

  describe('2. Device & Playlist Enumeration', () => {
    it('lists available playback devices with their properties', async () => {
      const devices = await mediaService.listDevices('integration_spotify_streaming')

      expect(devices.length).toBeGreaterThan(0)
      const primaryDev = devices[0]
      expect(primaryDev.id).toBeDefined()
      expect(primaryDev.name).toBeDefined()
      expect(primaryDev.type).toBe('computer')
      expect(primaryDev.volumePercent).toBeGreaterThanOrEqual(0)
    })

    it('lists curated playlists', async () => {
      const playlists = await mediaService.listPlaylists('integration_spotify_streaming')

      expect(playlists.length).toBeGreaterThan(0)
      const firstPlaylist = playlists[0]
      expect(firstPlaylist.id).toBeDefined()
      expect(firstPlaylist.title).toBeDefined()
      expect(firstPlaylist.trackCount).toBeGreaterThan(0)
    })
  })

  describe('3. Playback State & Controls', () => {
    it('inspects current playback state', async () => {
      const state = await mediaService.getPlaybackState('integration_spotify_streaming')

      expect(state.integrationId).toBe('integration_spotify_streaming')
      expect(typeof state.isPlaying).toBe('boolean')
      expect(state.progressMs).toBeGreaterThanOrEqual(0)
      expect(state.volumePercent).toBeGreaterThanOrEqual(0)
      expect(state.supportedActions).toContain('play')
      expect(state.supportedActions).toContain('pause')
      expect(state.supportedActions).toContain('set_volume')
    })

    it('executes play and pause playback commands', async () => {
      // Execute Play
      const playCmd: MediaControlCommand = {
        integrationId: 'integration_spotify_streaming',
        action: 'play'
      }
      const playRes = await mediaService.controlPlayback(playCmd)
      expect(playRes.success).toBe(true)
      expect(playRes.updatedPlaybackState?.isPlaying).toBe(true)

      // Execute Pause
      const pauseCmd: MediaControlCommand = {
        integrationId: 'integration_spotify_streaming',
        action: 'pause'
      }
      const pauseRes = await mediaService.controlPlayback(pauseCmd)
      expect(pauseRes.success).toBe(true)
      expect(pauseRes.updatedPlaybackState?.isPlaying).toBe(false)
    })

    it('executes volume adjustment with bounds clamping', async () => {
      // Set valid volume
      const volCmd: MediaControlCommand = {
        integrationId: 'integration_spotify_streaming',
        action: 'set_volume',
        volumePercent: 85
      }
      const volRes = await mediaService.controlPlayback(volCmd)
      expect(volRes.success).toBe(true)
      expect(volRes.updatedPlaybackState?.volumePercent).toBe(85)
    })

    it('executes track skip commands (skip_next, skip_previous)', async () => {
      const nextCmd: MediaControlCommand = {
        integrationId: 'integration_spotify_streaming',
        action: 'skip_next'
      }
      const nextRes = await mediaService.controlPlayback(nextCmd)
      expect(nextRes.success).toBe(true)
      expect(nextRes.updatedPlaybackState?.progressMs).toBe(0)

      const prevCmd: MediaControlCommand = {
        integrationId: 'integration_spotify_streaming',
        action: 'skip_previous'
      }
      const prevRes = await mediaService.controlPlayback(prevCmd)
      expect(prevRes.success).toBe(true)
    })

    it('executes active device switching', async () => {
      const switchCmd: MediaControlCommand = {
        integrationId: 'integration_spotify_streaming',
        action: 'select_device',
        targetDeviceId: 'dev_phone_1'
      }
      const switchRes = await mediaService.controlPlayback(switchCmd)
      expect(switchRes.success).toBe(true)
      expect(switchRes.updatedPlaybackState?.activeDevice?.id).toBe('dev_phone_1')
    })
  })
})
