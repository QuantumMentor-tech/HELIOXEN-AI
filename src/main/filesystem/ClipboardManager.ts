/**
 * HELIOXEN AI — Step 29: Clipboard Manager
 * Explicit, user-consented clipboard text and image reading and writing.
 * Strictly bounded, non-polling, no background surveillance.
 */

import { clipboard, NativeImage } from 'electron'
import {
  ClipboardReadTextResult,
  ClipboardWriteTextRequest,
  ClipboardWriteTextResult,
  ClipboardReadImageResult
} from '../../shared/filesystem/types'

export interface ClipboardAdapter {
  readText: () => string
  writeText: (text: string) => void
  readImage: () => NativeImage
}

export class ClipboardManager {
  private readonly adapter: ClipboardAdapter

  constructor(adapter?: ClipboardAdapter) {
    this.adapter = adapter ?? {
      readText: () => {
        try {
          return clipboard?.readText() || ''
        } catch {
          return ''
        }
      },
      writeText: (text: string) => {
        try {
          clipboard?.writeText(text)
        } catch (err) {
          throw new Error(`Failed to write to clipboard: ${err instanceof Error ? err.message : String(err)}`)
        }
      },
      readImage: () => {
        try {
          return clipboard?.readImage()
        } catch {
          return undefined as any
        }
      }
    }
  }

  /**
   * Reads plain text from the clipboard on explicit request.
   */
  public readText(maxChars = 1000000): ClipboardReadTextResult {
    const rawText = this.adapter.readText() || ''
    const isTruncated = rawText.length > maxChars
    const text = isTruncated ? rawText.slice(0, maxChars) : rawText

    return {
      text,
      charCount: text.length,
      isTruncated,
      timestamp: Date.now()
    }
  }

  /**
   * Writes user-approved text to the clipboard.
   */
  public writeText(request: ClipboardWriteTextRequest): ClipboardWriteTextResult {
    const text = request.text
    if (typeof text !== 'string') {
      throw new Error('Clipboard text must be a valid string')
    }

    this.adapter.writeText(text)

    return {
      success: true,
      charCount: text.length,
      timestamp: Date.now()
    }
  }

  /**
   * Reads image data from clipboard on explicit request.
   */
  public readImage(maxBytes = 5 * 1024 * 1024): ClipboardReadImageResult {
    const nativeImg = this.adapter.readImage()
    if (!nativeImg || (typeof nativeImg.isEmpty === 'function' && nativeImg.isEmpty())) {
      return {
        hasImage: false,
        timestamp: Date.now()
      }
    }

    try {
      const size = nativeImg.getSize()
      const dataUrl = nativeImg.toDataURL()
      const byteLength = Buffer.byteLength(dataUrl, 'utf8')

      if (byteLength > maxBytes) {
        return {
          hasImage: false,
          timestamp: Date.now()
        }
      }

      return {
        hasImage: true,
        dataUrl,
        width: size.width,
        height: size.height,
        sizeBytes: byteLength,
        timestamp: Date.now()
      }
    } catch {
      return {
        hasImage: false,
        timestamp: Date.now()
      }
    }
  }
}

export const clipboardManager = new ClipboardManager()

