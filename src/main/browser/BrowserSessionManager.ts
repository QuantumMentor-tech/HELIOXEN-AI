/**
 * HELIOXEN AI — Step 31: Browser Session Manager
 * Manages partition-isolated browser sessions.
 * Never reuses the privileged application default session.
 * Enforces default-deny on permissions and disables unauthorized downloads.
 */

import { session as electronSession, Session } from 'electron'
import {
  BrowserSessionConfig,
  BrowserSessionMetadata,
  ClearSessionDataRequest
} from '../../shared/browser/types'
import { IpcException } from '../../shared/ipc/errors'
import { securityLogger } from '../security/securityLogger'
import { browserDownloadManager } from './BrowserDownloadManager'

export interface BrowserSessionAdapter {
  fromPartition: (partition: string) => Session | any
}

export class BrowserSessionManager {
  private readonly adapter: BrowserSessionAdapter
  private readonly sessions = new Map<string, BrowserSessionMetadata>()
  private readonly activePartitions = new Map<string, any>()
  private defaultSessionId = 'session_default_inmemory'

  constructor(adapter?: BrowserSessionAdapter) {
    this.adapter = adapter ?? {
      fromPartition: (partition: string) => {
        try {
          return electronSession.fromPartition(partition)
        } catch {
          return null
        }
      }
    }

    // Initialize default in-memory session profile
    this.createSession({ sessionId: this.defaultSessionId, persist: false })
  }

  /**
   * Creates or acquires an isolated browser session profile.
   */
  public createSession(config: BrowserSessionConfig = { sessionId: '' }): BrowserSessionMetadata {
    const sessionId = config.sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const isPersistent = Boolean(config.persist)

    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!
    }

    // Strict partition naming: in-memory vs persistent
    const partition = isPersistent
      ? `persist:helioxen_browser_${sessionId}`
      : `helioxen_browser_temp_${sessionId}`

    const sess = this.adapter.fromPartition(partition)
    if (sess) {
      this.configureSessionSecurity(sess, sessionId)
      this.activePartitions.set(sessionId, sess)
    }

    const metadata: BrowserSessionMetadata = {
      sessionId,
      isPersistent,
      partition,
      tabCount: 0,
      createdAt: Date.now()
    }

    this.sessions.set(sessionId, metadata)

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'browser:createSession',
      sessionId,
      isPersistent,
      partition
    })

    return metadata
  }

  /**
   * Retrieves an existing session profile.
   */
  public getSession(sessionId?: string): BrowserSessionMetadata {
    const id = sessionId || this.defaultSessionId
    const sess = this.sessions.get(id)
    if (!sess) {
      throw new IpcException('OPERATION_UNAVAILABLE', `Browser session '${id}' does not exist`)
    }
    return sess
  }

  /**
   * Returns all active session profiles.
   */
  public listSessions(): BrowserSessionMetadata[] {
    return Array.from(this.sessions.values())
  }

  /**
   * Returns the underlying Electron session partition for a session ID.
   */
  public getPartitionSession(sessionId?: string): any {
    const id = sessionId || this.defaultSessionId
    this.getSession(id) // verifies existence
    return this.activePartitions.get(id)
  }

  /**
   * Clears storage data (cookies, cache, etc.) for a session profile.
   */
  public async clearSessionData(request: ClearSessionDataRequest): Promise<{ success: boolean; sessionId: string }> {
    const sessMeta = this.getSession(request.sessionId)
    const partitionSession = this.activePartitions.get(request.sessionId)

    if (partitionSession && typeof partitionSession.clearStorageData === 'function') {
      const storages = request.storages && request.storages.length > 0
        ? request.storages
        : ['cookies', 'cache', 'localstorage']

      await partitionSession.clearStorageData({
        storages: storages.map((s) => (s === 'localstorage' ? 'localstorage' : s))
      })
    }

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'browser:clearSessionData',
      sessionId: request.sessionId,
      partition: sessMeta.partition
    })

    return { success: true, sessionId: request.sessionId }
  }

  /**
   * Closes and cleans up a browser session.
   */
  public closeSession(sessionId: string): { success: boolean; sessionId: string } {
    if (sessionId === this.defaultSessionId) {
      // Default session cannot be completely removed, but can be reset
      this.clearSessionData({ sessionId })
      return { success: true, sessionId }
    }

    if (!this.sessions.has(sessionId)) {
      throw new IpcException('OPERATION_UNAVAILABLE', `Browser session '${sessionId}' does not exist`)
    }

    this.sessions.delete(sessionId)
    this.activePartitions.delete(sessionId)

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'browser:closeSession',
      sessionId
    })

    return { success: true, sessionId }
  }

  /**
   * Configures defense-in-depth permission and download security on the partition session.
   */
  private configureSessionSecurity(sess: any, sessionId: string): void {
    try {
      // 1. Strict default-deny on all web capabilities (media, geolocation, notifications, clipboard, midi)
      if (typeof sess.setPermissionRequestHandler === 'function') {
        sess.setPermissionRequestHandler((_webContents: any, permission: string, callback: (allow: boolean) => void) => {
          securityLogger.logEvent('PERMISSION_REQUEST', `browser-session-${sessionId}`, 'DENIED', {
            permission,
            reason: 'Untrusted web content permission denied by default policy'
          })
          callback(false)
        })
      }

      if (typeof sess.setPermissionCheckHandler === 'function') {
        sess.setPermissionCheckHandler(() => false)
      }

      // 2. Prevent unbounded / unauthorized background downloads with explicit review & policy
      if (typeof sess.on === 'function') {
        sess.on('will-download', (event: any, item: any, webContents: any) => {
          if (typeof event?.preventDefault === 'function') {
            event.preventDefault()
          }
          browserDownloadManager.handleWillDownload(sessionId, item, webContents)
        })
      }
    } catch {
      // Non-fatal in testing or restricted environments
    }
  }
}

export const browserSessionManager = new BrowserSessionManager()

