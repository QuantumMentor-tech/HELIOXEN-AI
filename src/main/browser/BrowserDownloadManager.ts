/**
 * HELIOXEN AI — Step 33: Browser Download Manager
 * Controls browser downloads with explicit user authorization, path traversal protection,
 * dangerous file extension blocking, and non-blocking lifecycle tracking.
 */

import path from 'path'
import * as crypto from 'crypto'
import {
  DownloadRequestReview,
  DownloadStateRecord,
  ApproveDownloadRequest,
  CancelDownloadRequest
} from '../../shared/browser/types'
import {
  ApproveDownloadRequestSchema,
  CancelDownloadRequestSchema
} from '../../shared/browser/contracts'
import { IpcException } from '../../shared/ipc/errors'
import { securityLogger } from '../security/securityLogger'

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.ps1', '.vbs', '.vbe', '.js', '.jse',
  '.wsf', '.wsh', '.msi', '.msp', '.com', '.scr', '.pif', '.reg',
  '.dll', '.sys', '.sh', '.bash', '.csh', '.apk', '.app', '.dmg'
])

export interface TrackedDownload {
  downloadId: string
  sessionId: string
  tabId: string
  item: any
  review: DownloadRequestReview
  state: DownloadStateRecord
  confirmationToken: string
}

export class BrowserDownloadManager {
  private downloads = new Map<string, TrackedDownload>()

  /**
   * Evaluates whether a filename has dangerous or double executable extensions.
   */
  public isDangerousFilename(filename: string): { dangerous: boolean; reason?: string } {
    if (!filename) return { dangerous: true, reason: 'Filename cannot be empty' }

    // Path traversal check
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes('\0')) {
      return { dangerous: true, reason: 'Filename contains invalid path characters or path traversal sequences' }
    }

    const lower = filename.toLowerCase()
    const ext = path.extname(lower)

    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return { dangerous: true, reason: `Directly executable file extension '${ext}' is blocked by security policy` }
    }

    // Check for deceptive double extensions (e.g. invoice.pdf.exe)
    const parts = lower.split('.')
    if (parts.length > 2) {
      for (let i = 1; i < parts.length; i++) {
        const subExt = '.' + parts[i]
        if (DANGEROUS_EXTENSIONS.has(subExt)) {
          return { dangerous: true, reason: `Suspicious double extension with executable token '${subExt}' detected` }
        }
      }
    }

    return { dangerous: false }
  }

  /**
   * Sanitizes proposed download filename, preventing traversal and illegal characters.
   */
  public sanitizeFilename(rawName: string): string {
    const basename = path.basename(rawName).trim()
    const cleaned = basename.replace(/[\0\/\\:*?"<>|]/g, '_')
    return cleaned.length > 0 ? cleaned : 'download.bin'
  }

  /**
   * Intercepts and reviews Electron session 'will-download' events.
   */
  public handleWillDownload(sessionId: string, item: any, webContents?: any): DownloadRequestReview {
    const rawUrl = item.getURL ? item.getURL() : 'about:blank'
    let origin = 'unknown'
    try {
      origin = new URL(rawUrl).origin
    } catch {
      // ignore
    }

    let rawFilename = item.getFilename ? item.getFilename() : ''
    if (!rawFilename && rawUrl) {
      try {
        const parsed = new URL(rawUrl)
        rawFilename = path.basename(parsed.pathname)
      } catch {
        // ignore
      }
    }
    if (!rawFilename) {
      rawFilename = 'download'
    }
    const suggestedFilename = this.sanitizeFilename(rawFilename)
    const mimeType = item.getMimeType ? item.getMimeType() : undefined
    const totalBytes = item.getTotalBytes ? item.getTotalBytes() : 0
    const tabId = (webContents as any)?.__helioxenTabId || 'tab_unknown'

    const dangerCheck = this.isDangerousFilename(suggestedFilename)
    const downloadId = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const confirmationToken = crypto.randomBytes(16).toString('hex')

    const review: DownloadRequestReview = {
      downloadId,
      tabId,
      sessionId,
      sourceUrl: rawUrl,
      origin,
      suggestedFilename,
      mimeType,
      totalBytes,
      isDangerousType: dangerCheck.dangerous,
      riskReason: dangerCheck.reason,
      requiresApproval: true,
      confirmationToken
    }

    const state: DownloadStateRecord = {
      downloadId,
      tabId,
      sessionId,
      url: rawUrl,
      filename: suggestedFilename,
      receivedBytes: 0,
      totalBytes,
      status: dangerCheck.dangerous ? 'blocked' : 'pending',
      error: dangerCheck.reason,
      isDangerousType: dangerCheck.dangerous,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const tracked: TrackedDownload = {
      downloadId,
      sessionId,
      tabId,
      item,
      review,
      state,
      confirmationToken
    }

    this.downloads.set(downloadId, tracked)

    if (dangerCheck.dangerous) {
      if (typeof item.cancel === 'function') {
        item.cancel()
      }
      securityLogger.logEvent('AUTHORIZATION_CHECK', `session-${sessionId}`, 'DENIED', {
        action: 'browser:download_blocked',
        downloadId,
        url: rawUrl,
        filename: suggestedFilename,
        reason: dangerCheck.reason
      })
      return review
    }

    if (typeof item.pause === 'function') {
      item.pause()
    }

    // Attach lifecycle listeners to Electron item if supported
    if (typeof item.on === 'function') {
      item.on('updated', (_event: any, itemState: string) => {
        if (tracked.state.status === 'blocked' || tracked.state.status === 'cancelled') return
        tracked.state.receivedBytes = item.getReceivedBytes ? item.getReceivedBytes() : 0
        tracked.state.totalBytes = item.getTotalBytes ? item.getTotalBytes() : tracked.state.totalBytes
        tracked.state.status = itemState === 'interrupted' ? 'interrupted' : 'progressing'
        tracked.state.updatedAt = Date.now()
      })

      item.once('done', (_event: any, finalState: string) => {
        if (tracked.state.status === 'blocked' || tracked.state.status === 'cancelled') return
        if (finalState === 'completed') {
          tracked.state.status = 'completed'
          tracked.state.receivedBytes = tracked.state.totalBytes
        } else if (finalState === 'cancelled') {
          tracked.state.status = 'cancelled'
        } else {
          tracked.state.status = 'interrupted'
          tracked.state.error = `Download terminated with state: ${finalState}`
        }
        tracked.state.updatedAt = Date.now()
      })
    }

    securityLogger.logEvent('AUTHORIZATION_CHECK', `session-${sessionId}`, 'PERMITTED', {
      action: 'browser:download_requested',
      downloadId,
      url: rawUrl,
      filename: suggestedFilename,
      requiresApproval: true
    })

    return review
  }

  /**
   * Approves a pending download with a user-selected save path and confirmation token.
   */
  public approveDownload(rawRequest: ApproveDownloadRequest): DownloadStateRecord {
    const request = ApproveDownloadRequestSchema.parse(rawRequest)
    const tracked = this.downloads.get(request.downloadId)

    if (!tracked) {
      throw new IpcException('OPERATION_UNAVAILABLE', `Download '${request.downloadId}' not found or already terminated`)
    }

    if (tracked.confirmationToken !== request.confirmationToken) {
      throw new IpcException('UNAUTHORIZED_SENDER', 'Invalid confirmation token for download approval')
    }

    if (tracked.state.isDangerousType) {
      throw new IpcException('VALIDATION_ERROR', `Cannot approve dangerous download: ${tracked.state.error}`)
    }

    // Validate save path
    const normalizedSavePath = path.normalize(request.savePath)
    if (
      normalizedSavePath.includes('..') ||
      !path.isAbsolute(normalizedSavePath) ||
      /^[a-zA-Z]:\\windows\\system32/i.test(normalizedSavePath)
    ) {
      throw new IpcException('VALIDATION_ERROR', 'Invalid, disallowed, or path traversal save destination')
    }

    tracked.state.savePath = normalizedSavePath
    tracked.state.status = 'progressing'
    tracked.state.updatedAt = Date.now()

    if (typeof tracked.item.setSavePath === 'function') {
      tracked.item.setSavePath(normalizedSavePath)
    }

    if (typeof tracked.item.resume === 'function') {
      tracked.item.resume()
    }

    securityLogger.logEvent('CONSENT_REQUEST', `session-${tracked.sessionId}`, 'PERMITTED', {
      action: 'browser:download_approved',
      downloadId: request.downloadId,
      savePath: normalizedSavePath
    })

    return tracked.state
  }

  /**
   * Cancels an active or pending download.
   */
  public cancelDownload(requestOrId: CancelDownloadRequest | string): DownloadStateRecord {
    const downloadId = typeof requestOrId === 'string' ? requestOrId : requestOrId.downloadId
    CancelDownloadRequestSchema.parse({ downloadId })
    const tracked = this.downloads.get(downloadId)

    if (!tracked) {
      throw new IpcException('OPERATION_UNAVAILABLE', `Download '${downloadId}' does not exist`)
    }

    tracked.state.status = 'cancelled'
    tracked.state.updatedAt = Date.now()

    if (typeof tracked.item.cancel === 'function') {
      tracked.item.cancel()
    }

    securityLogger.logEvent('AUTHORIZATION_CHECK', `session-${tracked.sessionId}`, 'CANCELLED', {
      action: 'browser:download_cancelled',
      downloadId
    })

    return tracked.state
  }

  /**
   * Retrieves current state of all downloads.
   */
  public listDownloads(): DownloadStateRecord[] {
    return Array.from(this.downloads.values()).map((d) => ({ ...d.state }))
  }

  /**
   * Retrieves single download state record.
   */
  public getDownload(downloadId: string): DownloadStateRecord {
    const tracked = this.downloads.get(downloadId)
    if (!tracked) {
      throw new IpcException('OPERATION_UNAVAILABLE', `Download '${downloadId}' not found`)
    }
    return { ...tracked.state }
  }
}

export const browserDownloadManager = new BrowserDownloadManager()
