/**
 * HELIOXEN AI — Step 30: Emergency Stop & Verified Undo Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DesktopInteractionManager,
  DesktopInteractionAdapter
} from '../../src/main/interaction/DesktopInteractionManager'
import { TargetResolver, TargetResolverAdapter } from '../../src/main/interaction/TargetResolver'

describe('Step 30: Emergency Stop & Verified Undo', () => {
  let dispatchedEvents: any[]
  let windowIsAlive = true

  const mockTargetAdapter: TargetResolverAdapter = {
    findAppWindow: (id: string) => {
      if (id === 'win_target_undo' && windowIsAlive) {
        return {
          id: 1,
          isDestroyed: () => false,
          isFocused: () => true,
          getTitle: () => 'Text Document',
          getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 })
        } as any
      }
      return null
    },
    getDesktopWindows: async () => []
  }

  const mockInteractionAdapter: DesktopInteractionAdapter = {
    getWindow: (id: string) => {
      if (id === 'win_target_undo' && windowIsAlive) {
        return {
          id: 1,
          isDestroyed: () => false,
          isFocused: () => true,
          getTitle: () => 'Text Document',
          getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 })
        } as any
      }
      return null
    },
    sendInputEvent: (_win: any, event: any) => {
      dispatchedEvents.push(event)
    },
    insertText: async () => {}
  }

  beforeEach(() => {
    dispatchedEvents = []
    windowIsAlive = true
  })

  it('halts active desktop operations on emergency stop', async () => {
    const resolver = new TargetResolver(mockTargetAdapter)
    const manager = new DesktopInteractionManager(resolver, mockInteractionAdapter)

    const stopResult = manager.emergencyStop()
    expect(stopResult.stopped).toBe(true)
    expect(stopResult.timestamp).toBeDefined()

    // Subsequent operations must be blocked
    await expect(
      manager.sendText({
        target: { windowId: 'win_target_undo' },
        text: 'Blocked content'
      })
    ).rejects.toThrow(/Desktop interaction is currently halted by Emergency Stop/)

    await expect(
      manager.sendKeyAction({
        target: { windowId: 'win_target_undo' },
        shortcut: 'Enter'
      })
    ).rejects.toThrow(/Desktop interaction is currently halted by Emergency Stop/)

    // Resetting emergency stop re-enables interaction
    manager.resetEmergencyStop()
    await expect(
      manager.sendText({
        target: { windowId: 'win_target_undo' },
        text: 'Allowed after reset'
      })
    ).resolves.toBeDefined()
  })

  it('performs verified undo on reversible text entry interactions', async () => {
    const resolver = new TargetResolver(mockTargetAdapter)
    const manager = new DesktopInteractionManager(resolver, mockInteractionAdapter)

    const sendRes = await manager.sendText({
      target: { windowId: 'win_target_undo' },
      text: 'Temporary draft text'
    })

    expect(sendRes.undoable).toBe(true)
    expect(sendRes.undoToken).toBeDefined()

    // Revert the action
    const undoRes = await manager.undoLastAction({ undoToken: sendRes.undoToken })
    expect(undoRes.success).toBe(true)
    expect(undoRes.revertedUndoToken).toBe(sendRes.undoToken)
    expect(undoRes.description).toContain('text_entry')

    // Dispatches undo shortcut key event (Ctrl+Z)
    const undoEvents = dispatchedEvents.filter((e) => e.keyCode === 'z' && e.modifiers?.includes('control'))
    expect(undoEvents.length).toBeGreaterThanOrEqual(1)

    // Cannot undo the same token twice
    const secondUndo = await manager.undoLastAction({ undoToken: sendRes.undoToken })
    expect(secondUndo.success).toBe(false)
    expect(secondUndo.error).toBe('REVERSIBLE_ACTION_NOT_FOUND')
  })

  it('reports failure when attempting undo if target window is closed', async () => {
    const resolver = new TargetResolver(mockTargetAdapter)
    const manager = new DesktopInteractionManager(resolver, mockInteractionAdapter)

    const sendRes = await manager.sendText({
      target: { windowId: 'win_target_undo' },
      text: 'Draft text'
    })

    // Now close the window
    windowIsAlive = false

    const undoRes = await manager.undoLastAction({ undoToken: sendRes.undoToken })
    expect(undoRes.success).toBe(false)
    expect(undoRes.error).toBe('TARGET_UNAVAILABLE')
    expect(undoRes.description).toContain('closed or is unavailable')
  })
})
