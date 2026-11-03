/**
 * HELIOXEN AI — Step 33: Download Policy and File Security Tests
 * Tests download interception, dangerous extension blocking, double extensions, path traversal, approval, and cancellation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserDownloadManager } from '../../src/main/browser/BrowserDownloadManager'
import path from 'path'

describe('Step 33: Browser Download Policy and File Security', () => {
  let downloadManager: BrowserDownloadManager

  beforeEach(() => {
    downloadManager = new BrowserDownloadManager()
  })

  it('intercepts will-download and pauses download pending user authorization', () => {
    const mockItem: any = {
      getFilename: vi.fn().mockReturnValue('annual-report.pdf'),
      getTotalBytes: vi.fn().mockReturnValue(2048576),
      getMimeType: vi.fn().mockReturnValue('application/pdf'),
      getURL: vi.fn().mockReturnValue('https://example.org/downloads/report.pdf'),
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
      setSavePath: vi.fn(),
      once: vi.fn(),
      on: vi.fn()
    }

    const mockWebContents: any = {
      id: 42,
      __helioxenTabId: 'tab_test_download_1'
    }

    const review = downloadManager.handleWillDownload('sess_default', mockItem, mockWebContents)

    expect(mockItem.pause).toHaveBeenCalled()
    expect(review.requiresApproval).toBe(true)
    expect(review.isDangerousType).toBe(false)

    const downloads = downloadManager.listDownloads()
    expect(downloads.length).toBe(1)
    expect(downloads[0].filename).toBe('annual-report.pdf')
    expect(downloads[0].status).toBe('pending')
    expect(downloads[0].isDangerousType).toBe(false)
  })

  it('immediately blocks and cancels dangerous executable extensions (.exe, .bat, .ps1, .msi)', () => {
    const dangerousFiles = ['installer.exe', 'setup.bat', 'script.ps1', 'payload.msi', 'macro.vbs']

    for (const filename of dangerousFiles) {
      const mockItem: any = {
        getFilename: vi.fn().mockReturnValue(filename),
        getTotalBytes: vi.fn().mockReturnValue(1024),
        getMimeType: vi.fn().mockReturnValue('application/octet-stream'),
        getURL: vi.fn().mockReturnValue(`https://example.org/files/${filename}`),
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(),
        setSavePath: vi.fn(),
        once: vi.fn(),
        on: vi.fn()
      }

      const mockWebContents: any = { id: 1 }

      const review = downloadManager.handleWillDownload('sess_default', mockItem, mockWebContents)

      expect(mockItem.cancel).toHaveBeenCalled()
      const record = downloadManager.getDownload(review.downloadId)
      expect(record).toBeDefined()
      expect(record?.status).toBe('blocked')
      expect(record?.isDangerousType).toBe(true)
      expect(record?.error).toContain('blocked by security policy')
    }
  })

  it('detects and immediately cancels disguised double extensions (e.g. document.pdf.exe)', () => {
    const mockItem: any = {
      getFilename: vi.fn().mockReturnValue('invoice_2026.pdf.exe'),
      getTotalBytes: vi.fn().mockReturnValue(5000),
      getMimeType: vi.fn().mockReturnValue('application/octet-stream'),
      getURL: vi.fn().mockReturnValue('https://example.org/files/invoice.pdf.exe'),
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
      setSavePath: vi.fn(),
      once: vi.fn(),
      on: vi.fn()
    }

    const review = downloadManager.handleWillDownload('sess_default', mockItem)

    expect(mockItem.cancel).toHaveBeenCalled()
    const record = downloadManager.getDownload(review.downloadId)
    expect(record?.status).toBe('blocked')
    expect(record?.isDangerousType).toBe(true)
  })

  it('rejects path traversal attempts in savePath during approval', () => {
    const mockItem: any = {
      getFilename: vi.fn().mockReturnValue('safe_document.pdf'),
      getTotalBytes: vi.fn().mockReturnValue(1024),
      getMimeType: vi.fn().mockReturnValue('application/pdf'),
      getURL: vi.fn().mockReturnValue('https://example.org/safe_document.pdf'),
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
      setSavePath: vi.fn(),
      once: vi.fn(),
      on: vi.fn()
    }

    const review = downloadManager.handleWillDownload('sess_default', mockItem)

    expect(() => {
      downloadManager.approveDownload({
        downloadId: review.downloadId,
        savePath: 'C:\\Windows\\System32\\hacked.pdf',
        confirmationToken: review.confirmationToken!
      })
    }).toThrow(/Invalid, disallowed, or path traversal save destination/i)
  })

  it('approves a safe download with explicit destination, setting save path and resuming download', () => {
    const mockItem: any = {
      getFilename: vi.fn().mockReturnValue('presentation.pptx'),
      getTotalBytes: vi.fn().mockReturnValue(102400),
      getMimeType: vi.fn().mockReturnValue('application/vnd.openxmlformats-officedocument.presentationml.presentation'),
      getURL: vi.fn().mockReturnValue('https://example.org/presentation.pptx'),
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
      setSavePath: vi.fn(),
      once: vi.fn(),
      on: vi.fn()
    }

    const review = downloadManager.handleWillDownload('sess_default', mockItem)
    const safeDest = path.join(process.cwd(), 'presentation.pptx')

    const approved = downloadManager.approveDownload({
      downloadId: review.downloadId,
      savePath: safeDest,
      confirmationToken: review.confirmationToken!
    })

    expect(approved.status).toBe('progressing')
    expect(mockItem.setSavePath).toHaveBeenCalledWith(safeDest)
    expect(mockItem.resume).toHaveBeenCalled()
  })

  it('cancels pending download when requested by user', () => {
    const mockItem: any = {
      getFilename: vi.fn().mockReturnValue('large_video.mp4'),
      getTotalBytes: vi.fn().mockReturnValue(50000000),
      getMimeType: vi.fn().mockReturnValue('video/mp4'),
      getURL: vi.fn().mockReturnValue('https://example.org/large_video.mp4'),
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
      setSavePath: vi.fn(),
      once: vi.fn(),
      on: vi.fn()
    }

    const review = downloadManager.handleWillDownload('sess_default', mockItem)
    const cancelled = downloadManager.cancelDownload(review.downloadId)

    expect(cancelled.status).toBe('cancelled')
    expect(mockItem.cancel).toHaveBeenCalled()
  })
})
