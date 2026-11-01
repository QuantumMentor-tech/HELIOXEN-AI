import { describe, it, expect } from 'vitest'
import {
  IPC_CHANNELS,
  WindowMinimizeRequestSchema,
  WindowMaximizeRequestSchema,
  WindowCloseRequestSchema,
  WindowIsMaximizedRequestSchema,
  WindowMaximizedChangeEventSchema
} from '../../src/shared/ipc'

describe('IPC Channels and Contracts Consistency', () => {
  it('defines all authoritative IPC channels with correct namespace prefixes', () => {
    expect(IPC_CHANNELS.WINDOW_MINIMIZE).toBe('window:minimize')
    expect(IPC_CHANNELS.WINDOW_MAXIMIZE).toBe('window:maximize')
    expect(IPC_CHANNELS.WINDOW_CLOSE).toBe('window:close')
    expect(IPC_CHANNELS.WINDOW_IS_MAXIMIZED).toBe('window:isMaximized')
    expect(IPC_CHANNELS.WINDOW_MAXIMIZED_CHANGE).toBe('window:maximized-change')
  })

  it('validates that Window request schemas accept void / empty parameters', () => {
    expect(WindowMinimizeRequestSchema.safeParse(undefined).success).toBe(true)
    expect(WindowMaximizeRequestSchema.safeParse(undefined).success).toBe(true)
    expect(WindowCloseRequestSchema.safeParse(undefined).success).toBe(true)
    expect(WindowIsMaximizedRequestSchema.safeParse(undefined).success).toBe(true)
  })

  it('validates that WindowMaximizedChangeEventSchema strictly requires boolean', () => {
    expect(WindowMaximizedChangeEventSchema.safeParse(true).success).toBe(true)
    expect(WindowMaximizedChangeEventSchema.safeParse(false).success).toBe(true)
    expect(WindowMaximizedChangeEventSchema.safeParse('true').success).toBe(false)
    expect(WindowMaximizedChangeEventSchema.safeParse(1).success).toBe(false)
  })
})
