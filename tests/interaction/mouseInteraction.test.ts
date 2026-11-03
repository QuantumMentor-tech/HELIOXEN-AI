/**
 * HELIOXEN AI — Step 30: Controlled Mouse Interaction Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DesktopInteractionManager,
  DesktopInteractionAdapter
} from '../../src/main/interaction/DesktopInteractionManager'
import { TargetResolver, TargetResolverAdapter } from '../../src/main/interaction/TargetResolver'

describe('Step 30: Controlled Mouse Interaction', () => {
  let dispatchedEvents: any[]

  const mockTargetAdapter: TargetResolverAdapter = {
    findAppWindow: (id: string) => {
      if (id === 'win_target_mouse') {
        return {
          id: 1,
          isDestroyed: () => false,
          isFocused: () => true,
          getTitle: () => 'Drawing Canvas',
          getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 })
        } as any
      }
      return null
    },
    getDesktopWindows: async () => []
  }

  const mockInteractionAdapter: DesktopInteractionAdapter = {
    getWindow: (id: string) => {
      if (id === 'win_target_mouse') {
        return {
          id: 1,
          isDestroyed: () => false,
          isFocused: () => true,
          getTitle: () => 'Drawing Canvas',
          getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 })
        } as any
      }
      return null
    },
    sendInputEvent: (_win: any, event: any) => {
      dispatchedEvents.push(event)
    }
  }

  beforeEach(() => {
    dispatchedEvents = []
  })

  it('dispatches target-relative click within valid bounds with paired mouseDown and mouseUp', async () => {
    const resolver = new TargetResolver(mockTargetAdapter)
    const manager = new DesktopInteractionManager(resolver, mockInteractionAdapter)

    const result = await manager.sendClick({
      target: { windowId: 'win_target_mouse' },
      x: 150,
      y: 200,
      button: 'left',
      clickCount: 1
    })

    expect(result.success).toBe(true)
    expect(result.actionType).toBe('click')
    expect(result.targetWindowId).toBe('win_target_mouse')
    expect(result.coordinates).toEqual({ x: 150, y: 200 })
    expect(result.undoable).toBe(false)

    // Check paired mouseDown and mouseUp
    const mouseDowns = dispatchedEvents.filter((e) => e.type === 'mouseDown')
    const mouseUps = dispatchedEvents.filter((e) => e.type === 'mouseUp')

    expect(mouseDowns.length).toBe(1)
    expect(mouseDowns[0]).toMatchObject({ x: 150, y: 200, button: 'left', clickCount: 1 })
    expect(mouseUps.length).toBeGreaterThanOrEqual(1)
    expect(mouseUps[0]).toMatchObject({ x: 150, y: 200, button: 'left' })
  })

  it('rejects coordinates outside target window boundaries', async () => {
    const resolver = new TargetResolver(mockTargetAdapter)
    const manager = new DesktopInteractionManager(resolver, mockInteractionAdapter)

    // Negative x
    await expect(
      manager.sendClick({
        target: { windowId: 'win_target_mouse' },
        x: -5,
        y: 100
      })
    ).rejects.toThrow(/fall outside target window bounds/)

    // x exceeds width
    await expect(
      manager.sendClick({
        target: { windowId: 'win_target_mouse' },
        x: 850,
        y: 100
      })
    ).rejects.toThrow(/fall outside target window bounds/)

    // y exceeds height
    await expect(
      manager.sendClick({
        target: { windowId: 'win_target_mouse' },
        x: 100,
        y: 650
      })
    ).rejects.toThrow(/fall outside target window bounds/)

    expect(dispatchedEvents.length).toBe(0)
  })

  it('executes bounded scrolling on verified target window', async () => {
    const resolver = new TargetResolver(mockTargetAdapter)
    const manager = new DesktopInteractionManager(resolver, mockInteractionAdapter)

    const result = await manager.sendScroll({
      target: { windowId: 'win_target_mouse' },
      deltaX: 0,
      deltaY: 250
    })

    expect(result.success).toBe(true)
    expect(result.actionType).toBe('scroll')
    expect(result.scrollDelta).toEqual({ deltaX: 0, deltaY: 250 })
    expect(result.undoable).toBe(false)

    expect(dispatchedEvents.length).toBe(1)
    expect(dispatchedEvents[0]).toMatchObject({
      type: 'mouseWheel',
      deltaX: 0,
      deltaY: 250
    })
  })

  it('clamps scroll delta exceeding maximum permitted limits to [-1000, 1000]', async () => {
    const resolver = new TargetResolver(mockTargetAdapter)
    const manager = new DesktopInteractionManager(resolver, mockInteractionAdapter)

    await manager.sendScroll({
      target: { windowId: 'win_target_mouse' },
      deltaX: 5000,
      deltaY: -9999
    })

    expect(dispatchedEvents[0]).toMatchObject({
      type: 'mouseWheel',
      deltaX: 1000,
      deltaY: -1000
    })
  })
})

