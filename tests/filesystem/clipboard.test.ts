/**
 * HELIOXEN AI — Step 29: Clipboard Manager Tests
 */

import { describe, it, expect } from 'vitest'
import { ClipboardManager, ClipboardAdapter } from '../../src/main/filesystem/ClipboardManager'

describe('Step 29: Clipboard Processing', () => {
  it('reads plain text on explicit user request', () => {
    let mockClip = 'Sample secret clipboard text'
    const adapter: ClipboardAdapter = {
      readText: () => mockClip,
      writeText: (t: string) => {
        mockClip = t
      },
      readImage: () => undefined as any
    }

    const manager = new ClipboardManager(adapter)
    const readRes = manager.readText()

    expect(readRes.text).toBe('Sample secret clipboard text')
    expect(readRes.charCount).toBe(28)
    expect(readRes.isTruncated).toBe(false)
    expect(readRes.timestamp).toBeGreaterThan(0)
  })

  it('truncates text exceeding maxChars limit', () => {
    const adapter: ClipboardAdapter = {
      readText: () => 'A'.repeat(500),
      writeText: () => {},
      readImage: () => undefined as any
    }

    const manager = new ClipboardManager(adapter)
    const readRes = manager.readText(100)

    expect(readRes.charCount).toBe(100)
    expect(readRes.isTruncated).toBe(true)
  })

  it('writes user-approved text to clipboard', () => {
    let store = ''
    const adapter: ClipboardAdapter = {
      readText: () => store,
      writeText: (t: string) => {
        store = t
      },
      readImage: () => undefined as any
    }

    const manager = new ClipboardManager(adapter)
    const writeRes = manager.writeText({ text: 'Approved summary output' })

    expect(writeRes.success).toBe(true)
    expect(writeRes.charCount).toBe(23)
    expect(store).toBe('Approved summary output')
  })

  it('handles empty image clipboard gracefully', () => {
    const adapter: ClipboardAdapter = {
      readText: () => '',
      writeText: () => {},
      readImage: () => ({
        isEmpty: () => true
      } as any)
    }

    const manager = new ClipboardManager(adapter)
    const imageRes = manager.readImage()

    expect(imageRes.hasImage).toBe(false)
  })

  it('reads image data URL when image is present on clipboard', () => {
    const adapter: ClipboardAdapter = {
      readText: () => '',
      writeText: () => {},
      readImage: () => ({
        isEmpty: () => false,
        getSize: () => ({ width: 640, height: 480 }),
        toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      } as any)
    }

    const manager = new ClipboardManager(adapter)
    const imageRes = manager.readImage()

    expect(imageRes.hasImage).toBe(true)
    expect(imageRes.width).toBe(640)
    expect(imageRes.height).toBe(480)
    expect(imageRes.dataUrl).toContain('data:image/png;base64')
  })
})

