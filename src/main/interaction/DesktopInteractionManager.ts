/**
 * HELIOXEN AI — Step 30: Desktop Interaction Manager
 * Implements controlled, permission-aware keyboard and mouse interactions.
 * Enforces key-down/up lifecycle, releases held modifiers in finally blocks,
 * verifies target window before dispatch, supports immediate emergency stop,
 * and maintains verified undo tracking for reversible actions.
 */

import { BrowserWindow } from 'electron'
import {
  KeyboardActionRequest,
  KeyboardActionResult,
  TextEntryRequest,
  MouseClickRequest,
  MouseScrollRequest,
  MouseActionResult,
  EmergencyStopResult,
  InteractionUndoRecord,
  UndoInteractionRequest,
  UndoInteractionResult,
  NamedKeyboardShortcut
} from '../../shared/interaction/types'
import { targetResolver, TargetResolver } from './TargetResolver'
import { IpcException } from '../../shared/ipc/errors'
import { securityLogger } from '../security/securityLogger'

export interface DesktopInteractionAdapter {
  getWindow: (windowId: string) => BrowserWindow | null
  sendInputEvent?: (win: BrowserWindow, event: any) => void
  insertText?: (win: BrowserWindow, text: string) => Promise<void>
  focusWindow?: (win: BrowserWindow) => void
}

const SHORTCUT_KEY_MAP: Record<NamedKeyboardShortcut, { keyCode: string; defaultModifiers?: Array<'shift' | 'control' | 'alt' | 'meta'> }> = {
  Copy: { keyCode: 'c', defaultModifiers: ['control'] },
  Paste: { keyCode: 'v', defaultModifiers: ['control'] },
  Cut: { keyCode: 'x', defaultModifiers: ['control'] },
  SelectAll: { keyCode: 'a', defaultModifiers: ['control'] },
  Undo: { keyCode: 'z', defaultModifiers: ['control'] },
  Redo: { keyCode: 'y', defaultModifiers: ['control'] },
  Escape: { keyCode: 'Escape' },
  Enter: { keyCode: 'Enter' },
  Tab: { keyCode: 'Tab' },
  Backspace: { keyCode: 'Backspace' },
  Delete: { keyCode: 'Delete' },
  ArrowUp: { keyCode: 'Up' },
  ArrowDown: { keyCode: 'Down' },
  ArrowLeft: { keyCode: 'Left' },
  ArrowRight: { keyCode: 'Right' },
  Home: { keyCode: 'Home' },
  End: { keyCode: 'End' },
  PageUp: { keyCode: 'PageUp' },
  PageDown: { keyCode: 'PageDown' }
}

export class DesktopInteractionManager {
  private readonly resolver: TargetResolver
  private readonly adapter: DesktopInteractionAdapter
  private readonly undoHistory: Map<string, InteractionUndoRecord> = new Map()
  private isEmergencyStopped = false
  private activeModifierStates: Set<string> = new Set()

  constructor(resolver?: TargetResolver, adapter?: DesktopInteractionAdapter) {
    this.resolver = resolver ?? targetResolver
    this.adapter = adapter ?? {
      getWindow: (windowId: string) => {
        try {
          const windows = BrowserWindow.getAllWindows()
          for (const win of windows) {
            if (win && !win.isDestroyed()) {
              if (`win_helioxen_${win.id}` === windowId || String(win.id) === windowId) {
                return win
              }
            }
          }
          return null
        } catch {
          return null
        }
      },
      sendInputEvent: (win: BrowserWindow, event: any) => {
        if (!win || win.isDestroyed()) return
        win.webContents.sendInputEvent(event)
      },
      insertText: async (win: BrowserWindow, text: string) => {
        if (!win || win.isDestroyed()) return
        await win.webContents.insertText(text)
      },
      focusWindow: (win: BrowserWindow) => {
        if (!win || win.isDestroyed()) return
        win.focus()
      }
    }
  }

  /**
   * Focuses an authorized target window.
   */
  public async focusWindow(targetRef: { windowId: string }): Promise<{ success: boolean; windowId: string }> {
    this.checkEmergencyStop()
    const target = await this.resolver.resolveAndValidateTarget(targetRef)

    const win = this.adapter.getWindow(target.windowId)
    if (win && this.adapter.focusWindow) {
      this.adapter.focusWindow(win)
    }

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'desktop:focusWindow',
      targetWindowId: target.windowId
    })

    return { success: true, windowId: target.windowId }
  }

  /**
   * Executes a named, allowlisted keyboard shortcut on a verified target window.
   */
  public async sendKeyAction(request: KeyboardActionRequest): Promise<KeyboardActionResult> {
    this.checkEmergencyStop()
    const target = await this.resolver.resolveAndValidateTarget(request.target)

    const shortcutMeta = SHORTCUT_KEY_MAP[request.shortcut]
    if (!shortcutMeta) {
      throw new IpcException('VALIDATION_ERROR', `Unsupported keyboard shortcut: ${request.shortcut}`)
    }

    const win = this.adapter.getWindow(target.windowId)
    if (!win) {
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        `Native input injection is restricted to accessible application windows. Target '${target.windowId}' is unavailable for input event dispatch.`
      )
    }

    const modifiers = request.modifiers ?? shortcutMeta.defaultModifiers ?? []
    const keyCode = shortcutMeta.keyCode

    try {
      // 1. Send keyDown
      modifiers.forEach((m) => this.activeModifierStates.add(m))
      this.adapter.sendInputEvent?.(win, {
        type: 'keyDown',
        keyCode,
        modifiers
      })

      // 2. Send keyUp
      this.adapter.sendInputEvent?.(win, {
        type: 'keyUp',
        keyCode,
        modifiers
      })
    } finally {
      // Guaranteed release of any held modifier keys
      this.releaseModifiers(win)
    }

    const undoToken = `undo_key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const undoable = request.shortcut === 'Undo' ? false : true

    if (undoable) {
      this.undoHistory.set(undoToken, {
        undoToken,
        type: 'keyboard_action',
        targetWindowId: target.windowId,
        appliedAt: new Date().toISOString(),
        canUndo: true
      })
    }

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'desktop:sendKeyAction',
      shortcut: request.shortcut,
      targetWindowId: target.windowId
    })

    return {
      success: true,
      action: request.shortcut,
      targetWindowId: target.windowId,
      timestamp: new Date().toISOString(),
      undoable,
      undoToken: undoable ? undoToken : undefined
    }
  }

  /**
   * Enters user-approved text into a verified target window.
   * Treats text strictly as data with strict character limits; never appends implicit submission/enter.
   */
  public async sendText(request: TextEntryRequest): Promise<KeyboardActionResult> {
    this.checkEmergencyStop()
    const target = await this.resolver.resolveAndValidateTarget(request.target)

    const maxChars = Math.min(request.maxChars ?? 500, 2000)
    if (request.text.length > maxChars) {
      throw new IpcException(
        'VALIDATION_ERROR',
        `Text length (${request.text.length}) exceeds permitted maximum of ${maxChars} characters`
      )
    }

    const win = this.adapter.getWindow(target.windowId)
    if (!win) {
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        `Native text insertion is restricted to accessible application windows. Target '${target.windowId}' is unavailable.`
      )
    }

    // Insert text safely via webContents insertText
    if (this.adapter.insertText) {
      await this.adapter.insertText(win, request.text)
    }

    const undoToken = `undo_text_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    this.undoHistory.set(undoToken, {
      undoToken,
      type: 'text_entry',
      targetWindowId: target.windowId,
      insertedLength: request.text.length,
      appliedAt: new Date().toISOString(),
      canUndo: true
    })

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'desktop:sendText',
      charCount: request.text.length,
      targetWindowId: target.windowId
    })

    return {
      success: true,
      action: 'sendText',
      targetWindowId: target.windowId,
      timestamp: new Date().toISOString(),
      undoable: true,
      undoToken
    }
  }

  /**
   * Executes a bounded, target-relative mouse click.
   */
  public async sendClick(request: MouseClickRequest): Promise<MouseActionResult> {
    this.checkEmergencyStop()
    const target = await this.resolver.resolveAndValidateTarget(request.target)

    // Validate coordinate bounds relative to target window
    const { width, height } = target.bounds
    if (request.x < 0 || request.x >= width || request.y < 0 || request.y >= height) {
      throw new IpcException(
        'VALIDATION_ERROR',
        `Coordinates (${request.x}, ${request.y}) fall outside target window bounds (${width}x${height})`
      )
    }

    const win = this.adapter.getWindow(target.windowId)
    if (!win) {
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        `Native pointer dispatch is restricted to accessible application windows. Target '${target.windowId}' is unavailable.`
      )
    }

    const button = request.button ?? 'left'
    const clickCount = request.clickCount ?? 1

    try {
      // Dispatch mouseDown
      this.adapter.sendInputEvent?.(win, {
        type: 'mouseDown',
        x: request.x,
        y: request.y,
        button,
        clickCount
      })

      // Dispatch mouseUp
      this.adapter.sendInputEvent?.(win, {
        type: 'mouseUp',
        x: request.x,
        y: request.y,
        button,
        clickCount
      })
    } finally {
      // Ensure mouseUp was delivered in case of exception
      this.adapter.sendInputEvent?.(win, {
        type: 'mouseUp',
        x: request.x,
        y: request.y,
        button,
        clickCount
      })
    }

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'desktop:sendClick',
      x: request.x,
      y: request.y,
      button,
      targetWindowId: target.windowId
    })

    return {
      success: true,
      actionType: 'click',
      targetWindowId: target.windowId,
      coordinates: { x: request.x, y: request.y },
      timestamp: new Date().toISOString(),
      undoable: false
    }
  }

  /**
   * Executes bounded vertical or horizontal scrolling on a verified target window.
   */
  public async sendScroll(request: MouseScrollRequest): Promise<MouseActionResult> {
    this.checkEmergencyStop()
    const target = await this.resolver.resolveAndValidateTarget(request.target)

    const deltaX = Math.max(-1000, Math.min(request.deltaX ?? 0, 1000))
    const deltaY = Math.max(-1000, Math.min(request.deltaY ?? 0, 1000))

    const win = this.adapter.getWindow(target.windowId)
    if (!win) {
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        `Native scroll dispatch is restricted to accessible application windows. Target '${target.windowId}' is unavailable.`
      )
    }

    const centerX = Math.floor(target.bounds.width / 2)
    const centerY = Math.floor(target.bounds.height / 2)

    this.adapter.sendInputEvent?.(win, {
      type: 'mouseWheel',
      x: centerX,
      y: centerY,
      deltaX,
      deltaY
    })

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'desktop:sendScroll',
      deltaX,
      deltaY,
      targetWindowId: target.windowId
    })

    return {
      success: true,
      actionType: 'scroll',
      targetWindowId: target.windowId,
      scrollDelta: { deltaX, deltaY },
      timestamp: new Date().toISOString(),
      undoable: false
    }
  }

  /**
   * Emergency Stop Control.
   * Immediately clears active sequences, releases held modifiers, and halts automation.
   */
  public emergencyStop(): EmergencyStopResult {
    this.isEmergencyStopped = true
    const held = Array.from(this.activeModifierStates)

    // Release held modifiers on all open windows
    try {
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (win && !win.isDestroyed()) {
          this.releaseModifiers(win)
        }
      }
    } catch {
      // In testing environments or when BrowserWindow is mocked
    }

    this.activeModifierStates.clear()

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'user', 'CANCELLED', {
      action: 'desktop:emergencyStop',
      releasedModifiers: held
    })

    return {
      stopped: true,
      pendingActionsCleared: 0,
      heldModifiersReleased: held,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Resets emergency stop state to allow authorized tasks to resume after confirmation.
   */
  public resetEmergencyStop(): void {
    this.isEmergencyStopped = false
  }

  /**
   * Performs a verified undo on a reversible desktop action.
   */
  public async undoLastAction(request: UndoInteractionRequest = {}): Promise<UndoInteractionResult> {
    this.checkEmergencyStop()

    let record: InteractionUndoRecord | undefined

    if (request.undoToken) {
      record = this.undoHistory.get(request.undoToken)
    } else {
      // Find the most recent active undo record
      const records = Array.from(this.undoHistory.values()).filter((r) => r.canUndo && !r.undoneAt)
      record = records[records.length - 1]
    }

    if (!record || !record.canUndo || record.undoneAt) {
      return {
        success: false,
        description: 'No reversible desktop interaction was found or action has already been reverted',
        timestamp: new Date().toISOString(),
        error: 'REVERSIBLE_ACTION_NOT_FOUND'
      }
    }

    // Verify target window is still available
    let target
    try {
      target = await this.resolver.resolveAndValidateTarget({ windowId: record.targetWindowId })
    } catch (err: any) {
      return {
        success: false,
        revertedUndoToken: record.undoToken,
        description: `Target window '${record.targetWindowId}' was closed or is unavailable to receive undo action: ${err?.message || err}`,
        timestamp: new Date().toISOString(),
        error: 'TARGET_UNAVAILABLE'
      }
    }
    const win = this.adapter.getWindow(target.windowId)
    if (!win) {
      return {
        success: false,
        revertedUndoToken: record.undoToken,
        description: `Target window '${record.targetWindowId}' was closed or is unavailable to receive undo action`,
        timestamp: new Date().toISOString(),
        error: 'TARGET_UNAVAILABLE'
      }
    }

    // Execute inverse operation
    if (record.type === 'text_entry') {
      // Send Undo shortcut (Ctrl+Z) or Backspaces to reverse inserted text
      this.adapter.sendInputEvent?.(win, {
        type: 'keyDown',
        keyCode: 'z',
        modifiers: ['control']
      })
      this.adapter.sendInputEvent?.(win, {
        type: 'keyUp',
        keyCode: 'z',
        modifiers: ['control']
      })
    } else if (record.type === 'keyboard_action') {
      // Send inverse Undo (Ctrl+Z)
      this.adapter.sendInputEvent?.(win, {
        type: 'keyDown',
        keyCode: 'z',
        modifiers: ['control']
      })
      this.adapter.sendInputEvent?.(win, {
        type: 'keyUp',
        keyCode: 'z',
        modifiers: ['control']
      })
    }

    record.undoneAt = new Date().toISOString()

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'desktop:undoLastAction',
      revertedUndoToken: record.undoToken,
      targetWindowId: target.windowId
    })

    return {
      success: true,
      revertedUndoToken: record.undoToken,
      description: `Successfully reverted ${record.type} on window ${record.targetWindowId}`,
      timestamp: new Date().toISOString()
    }
  }

  private releaseModifiers(win: BrowserWindow): void {
    for (const mod of this.activeModifierStates) {
      this.adapter.sendInputEvent?.(win, {
        type: 'keyUp',
        keyCode: mod
      })
    }
    this.activeModifierStates.clear()
  }

  private checkEmergencyStop(): void {
    if (this.isEmergencyStopped) {
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        'Desktop interaction is currently halted by Emergency Stop. Reset emergency stop to resume.'
      )
    }
  }
}

export const desktopInteractionManager = new DesktopInteractionManager()
