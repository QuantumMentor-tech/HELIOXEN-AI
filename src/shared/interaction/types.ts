/**
 * HELIOXEN AI — Step 30: Desktop Interaction & System Operations Types
 * Typed data contracts for controlled keyboard, mouse, and allowlisted system actions.
 */

// --- Window Targeting ---
export interface TargetWindowReference {
  windowId: string
  expectedAppAssociation?: string
  expectedTitleSubstring?: string
}

export interface TargetValidationResult {
  isValid: boolean
  windowId: string
  title: string
  appAssociation: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  isFocused: boolean
  isSelfApp: boolean
  reason?: string
}

// --- Controlled Keyboard ---
export const ALLOWLISTED_KEYBOARD_SHORTCUTS = [
  'Copy',
  'Paste',
  'Cut',
  'SelectAll',
  'Undo',
  'Redo',
  'Escape',
  'Enter',
  'Tab',
  'Backspace',
  'Delete',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown'
] as const

export type NamedKeyboardShortcut = (typeof ALLOWLISTED_KEYBOARD_SHORTCUTS)[number]

export interface KeyboardActionRequest {
  target: TargetWindowReference
  shortcut: NamedKeyboardShortcut
  modifiers?: Array<'shift' | 'control' | 'alt' | 'meta'>
}

export interface TextEntryRequest {
  target: TargetWindowReference
  text: string
  maxChars?: number
}

export interface KeyboardActionResult {
  success: boolean
  action: string
  targetWindowId: string
  timestamp: string
  undoable: boolean
  undoToken?: string
  error?: string
}

// --- Controlled Mouse ---
export type MouseButton = 'left' | 'right' | 'middle'

export interface MouseClickRequest {
  target: TargetWindowReference
  x: number
  y: number
  button?: MouseButton
  clickCount?: 1 | 2
}

export interface MouseScrollRequest {
  target: TargetWindowReference
  deltaX?: number
  deltaY?: number
}

export interface MouseActionResult {
  success: boolean
  actionType: 'click' | 'scroll'
  targetWindowId: string
  coordinates?: { x: number; y: number }
  scrollDelta?: { deltaX: number; deltaY: number }
  timestamp: string
  undoable: false
  error?: string
}

// --- Predefined System Operations ---
export interface SystemOpenPathRequest {
  targetPath: string
}

export interface SystemOpenPathResult {
  success: boolean
  targetPath: string
  openedAt: string
  error?: string
}

export interface SystemShowInFolderRequest {
  targetPath: string
}

export interface SystemShowInFolderResult {
  success: boolean
  targetPath: string
  revealedAt: string
  error?: string
}

export interface SystemOpenUrlRequest {
  url: string
}

export interface SystemOpenUrlResult {
  success: boolean
  url: string
  domain: string
  openedAt: string
  error?: string
}

export interface SystemAlertBeepResult {
  success: boolean
  beepedAt: string
}

export interface DisplayMetricsResult {
  primaryDisplay: {
    id: number
    bounds: { x: number; y: number; width: number; height: number }
    workArea: { x: number; y: number; width: number; height: number }
    scaleFactor: number
  }
  allDisplaysCount: number
  queriedAt: string
}

// --- Emergency Stop & Verified Undo ---
export interface EmergencyStopResult {
  stopped: boolean
  pendingActionsCleared: number
  heldModifiersReleased: string[]
  timestamp: string
}

export interface InteractionUndoRecord {
  undoToken: string
  type: 'text_entry' | 'keyboard_action'
  targetWindowId: string
  insertedLength?: number
  appliedAt: string
  canUndo: boolean
  undoneAt?: string
}

export interface UndoInteractionRequest {
  undoToken?: string
}

export interface UndoInteractionResult {
  success: boolean
  revertedUndoToken?: string
  description: string
  timestamp: string
  error?: string
}
