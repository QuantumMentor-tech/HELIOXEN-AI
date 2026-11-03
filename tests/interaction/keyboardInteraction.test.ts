/**
 * HELIOXEN AI — Step 30: Controlled Keyboard Interaction Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DesktopInteractionManager,
  DesktopInteractionAdapter
} from '../../src/main/interaction/DesktopInteractionManager'
import { TargetResolver, TargetResolverAdapter } from '../../src/main/interaction/TargetResolver'

describe('Step 30: Controlled Keyboard Interaction', () => {
  let dispatchedEvents: any[]
  let insertedTexts: string[]

  const mockTargetAdapter: TargetResolverAdapter = {
    findAppWindow: (id: string) => {
      if (id === 'win_target_1') {
        return {
          id: 1,
          isDestroyed: () => false,
          isFocused: () => true,
          getTitle: () => 'Active Editor',
          getBounds: () => ({ x: 0, y: 0, width: 1024, height: 768 })
        } as any
      }
      return null
    },
    getDesktopWindows: async () => []
  }

  const mockInteractionAdapter: DesktopInteractionAdapter = {
    getWindow: (id: string) => {
      if (id === 'win_target_1') {
        return {
          id: 1,
          isDestroyed: () => false,
          isFocused: () => true,
          getTitle: () => 'Active Editor',
          getBounds: () => ({ x: 0, y: 0, width: 1024, height: 768 }),
          focus: vi.fn()
        } as any
      }
      return null
    },
    sendInputEvent: (_win: any, event: any) => {
      dispatchedEvents.push(event)
    },
    insertText: async (_win: any, text: string) => {
      insertedTexts.push(text)
    },
    focusWindow: vi.fn()
  }

  beforeEach(() => {
    dispatchedEvents = []
    insertedTexts = []
  })

  it('dispatches allowlisted named keyboard shortcuts with keydown and keyup pairing', async () => {
    const resolver = new TargetResolver(mockTargetAdapter)
    const manager = new DesktopInteractionManager(resolver, mockInteractionAdapter)

    const result = await manager.sendKeyAction({
      target: { windowId: 'win_target_1' },
      shortcut: 'Copy'
    })

    expect(result.success).toBe(true)
    expect(result.action).toBe('Copy')
    expect(result.targetWindowId).toBe('win_target_1')
    expect(result.undoable).toBe(true)
    expect(result.undoToken).toBeDefined()

    // Verifies paired keyDown and keyUp
    expect(dispatchedEvents.length).toBe(3) // keyDown, keyUp, and modifier release keyUp
    expect(dispatchedEvents[0]).toMatchObject({ type: 'keyDown', keyCode: 'c', modifiers: ['control'] })
    expect(dispatchedEvents[1]).toMatchObject({ type: 'keyUp', keyCode: 'c', modifiers: ['control'] })
    expect(dispatchedEvents[2]).toMatchObject({ type: 'keyUp', keyCode: 'control' })
  })

  it('safely releases held modifiers even if an error occurs during sequence', async () => {
    const errorAdapter: DesktopInteractionAdapter = {
      ...mockInteractionAdapter,
      sendInputEvent: (_win: any, event: any) => {
        dispatchedEvents.push(event)
        if (event.type === 'keyDown') {
          throw new Error('Native injection simulated fault')
        }
      }
    }

    const resolver = new TargetResolver(mockTargetAdapter)
    const manager = new DesktopInteractionManager(resolver, errorAdapter)

    await expect(
      manager.sendKeyAction({
        target: { windowId: 'win_target_1' },
        shortcut: 'SelectAll'
      })
    ).rejects.toThrow(/Native injection simulated fault/)

    // Modifiers must still be released in finally block
    const releaseEvents = dispatchedEvents.filter((e) => e.type === 'keyUp' && e.keyCode === 'control')
    expect(releaseEvents.length).toBeGreaterThanOrEqual(1)
  })

  it('enters bounded text without implicit enter or form submission', async () => {
    const resolver = new TargetResolver(mockTargetAdapter)
    const manager = new DesktopInteractionManager(resolver, mockInteractionAdapter)

    const textToInsert = 'Hello, safe automation!'
    const result = await manager.sendText({
      target: { windowId: 'win_target_1' },
      text: textToInsert,
      maxChars: 100
    })

    expect(result.success).toBe(true)
    expect(result.action).toBe('sendText')
    expect(result.undoable).toBe(true)
    expect(insertedTexts).toEqual([textToInsert])

    // Strictly ensure no Enter key was dispatched
    const enterEvents = dispatchedEvents.filter((e) => e.keyCode === 'Enter' || e.keyCode === '\r' || e.keyCode === '\n')
    expect(enterEvents.length).toBe(0)
  })

  it('rejects text exceeding character limits', async () => {
    const resolver = new TargetResolver(mockTargetAdapter)
    const manager = new DesktopInteractionManager(resolver, mockInteractionAdapter)

    const longText = 'a'.repeat(501)

    await expect(
      manager.sendText({
        target: { windowId: 'win_target_1' },
        text: longText,
        maxChars: 500
      })
    ).rejects.toThrow(/exceeds permitted maximum/)

    expect(insertedTexts.length).toBe(0)
  })

  it('rejects keyboard interactions directed at unavailable targets', async () => {
    const resolver = new TargetResolver(mockTargetAdapter)
    const manager = new DesktopInteractionManager(resolver, mockInteractionAdapter)

    await expect(
      manager.sendKeyAction({
        target: { windowId: 'win_missing' },
        shortcut: 'Paste'
      })
    ).rejects.toThrow(/closed, stale, or no longer available/)
  })
})

