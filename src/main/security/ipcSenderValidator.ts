import { IpcException } from '../../shared/ipc/errors'

export interface ValidatableSenderEvent {
  sender?: { id: number }
  senderFrame?: { parent: unknown | null } | null
}

export interface ValidatableWindow {
  isDestroyed(): boolean
  webContents: { id: number }
}

/**
 * Validates that an IPC request originates strictly from the authorized top-level main window frame.
 * Throws a normalized IpcException if sender or frame validation fails.
 */
export function validateIpcSender(
  event: ValidatableSenderEvent,
  targetWindow: ValidatableWindow | null | undefined
): void {
  if (!targetWindow || targetWindow.isDestroyed()) {
    throw new IpcException(
      'OPERATION_UNAVAILABLE',
      'Primary application window is unavailable or destroyed'
    )
  }
  if (!event.sender || event.sender.id !== targetWindow.webContents.id) {
    throw new IpcException(
      'UNAUTHORIZED_SENDER',
      'IPC invocation rejected: Unauthorized sender WebContents ID'
    )
  }
  if (event.senderFrame && event.senderFrame.parent) {
    throw new IpcException(
      'UNAUTHORIZED_FRAME',
      'IPC invocation rejected: Requests from child frames or iframes are prohibited'
    )
  }
}

/**
 * Validates that an external URL protocol is safe before dispatching to the OS shell.
 * Restricts strictly to http: and https: to prevent protocol handler exploits.
 */
export function isSafeExternalUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}
