/**
 * HELIOXEN AI — Step 44: Media Integration Contracts & Schemas
 */

import { z } from 'zod'

export const MediaItemSchema = z.object({
  id: z.string().min(1).max(64),
  providerItemId: z.string().min(1).max(128),
  integrationId: z.string().min(1).max(64),
  title: z.string().min(1).max(256),
  artistOrCreator: z.string().min(1).max(256),
  albumOrCollection: z.string().max(256).optional(),
  durationMs: z.number().int().nonnegative().optional(),
  artworkUrl: z.string().max(2048).optional(),
  isPlayable: z.boolean(),
  externalUrl: z.string().max(2048).optional(),
  uri: z.string().max(512).optional()
})

export const MediaPlaylistSchema = z.object({
  id: z.string().min(1).max(64),
  integrationId: z.string().min(1).max(64),
  title: z.string().min(1).max(256),
  description: z.string().max(1024).optional(),
  trackCount: z.number().int().nonnegative(),
  artworkUrl: z.string().max(2048).optional(),
  ownerName: z.string().max(128).optional(),
  uri: z.string().max(512).optional()
})

export const MediaPlaybackDeviceSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(128),
  type: z.enum(['computer', 'smartphone', 'speaker', 'local_system']),
  isActive: z.boolean(),
  volumePercent: z.number().int().min(0).max(100)
})

export const MediaPlaybackStateSchema = z.object({
  integrationId: z.string().min(1).max(64),
  isPlaying: z.boolean(),
  currentItem: MediaItemSchema.optional(),
  progressMs: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  volumePercent: z.number().int().min(0).max(100),
  activeDevice: MediaPlaybackDeviceSchema.optional(),
  repeatMode: z.enum(['off', 'track', 'context']),
  shuffleState: z.boolean(),
  supportedActions: z.array(
    z.enum([
      'play',
      'pause',
      'skip_next',
      'skip_previous',
      'seek',
      'set_volume',
      'toggle_shuffle',
      'select_device'
    ])
  )
})

export const MediaControlCommandSchema = z.object({
  integrationId: z.string().min(1).max(64),
  action: z.enum([
    'play',
    'pause',
    'skip_next',
    'skip_previous',
    'seek',
    'set_volume',
    'toggle_shuffle',
    'select_device'
  ]),
  targetDeviceId: z.string().max(128).optional(),
  seekPositionMs: z.number().int().nonnegative().optional(),
  volumePercent: z.number().int().min(0).max(100).optional(),
  mediaUri: z.string().max(512).optional()
})

