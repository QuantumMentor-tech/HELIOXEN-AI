/**
 * HELIOXEN AI — Step 30: Target Window Resolver Tests
 */

import { describe, it, expect } from 'vitest'
import { TargetResolver, TargetResolverAdapter } from '../../src/main/interaction/TargetResolver'

describe('Step 30: Target Window Resolver', () => {
  const createMockAdapter = (overrides: Partial<TargetResolverAdapter> = {}): TargetResolverAdapter => {
    return {
      findAppWindow: (id: string) => {
        if (id === 'win_helioxen_1') {
          return {
            id: 1,
            isDestroyed: () => false,
            isFocused: () => true,
            getTitle: () => 'HELIOXEN Assistant Dashboard',
            getBounds: () => ({ x: 100, y: 100, width: 1200, height: 800 })
          } as any
        }
        return null
      },
      getDesktopWindows: async () => {
        return [
          {
            id: 'win_ext_notepad_1',
            title: 'Untitled - Notepad',
            appAssociation: 'Notepad',
            bounds: { x: 50, y: 50, width: 800, height: 600 },
            isVisible: true,
            isMinimized: false,
            isActive: false,
            isSelfApp: false
          },
          {
            id: 'win_ext_minimized_1',
            title: 'Minimized Window',
            appAssociation: 'Explorer',
            bounds: { x: 0, y: 0, width: 800, height: 600 },
            isVisible: false,
            isMinimized: true,
            isActive: false,
            isSelfApp: false
          },
          {
            id: 'win_ext_zero_bounds',
            title: 'Zero Bounds Window',
            appAssociation: 'ZeroApp',
            bounds: { x: 0, y: 0, width: 0, height: 0 },
            isVisible: true,
            isMinimized: false,
            isActive: false,
            isSelfApp: false
          }
        ]
      },
      ...overrides
    }
  }

  it('successfully resolves an existing HELIOXEN application window', async () => {
    const resolver = new TargetResolver(createMockAdapter())
    const result = await resolver.resolveAndValidateTarget({ windowId: 'win_helioxen_1' })

    expect(result.isValid).toBe(true)
    expect(result.windowId).toBe('win_helioxen_1')
    expect(result.title).toBe('HELIOXEN Assistant Dashboard')
    expect(result.appAssociation).toBe('HELIOXEN AI')
    expect(result.bounds.width).toBe(1200)
    expect(result.isFocused).toBe(true)
    expect(result.isSelfApp).toBe(true)
  })

  it('successfully resolves an active external desktop window', async () => {
    const resolver = new TargetResolver(createMockAdapter())
    const result = await resolver.resolveAndValidateTarget({ windowId: 'win_ext_notepad_1' })

    expect(result.isValid).toBe(true)
    expect(result.windowId).toBe('win_ext_notepad_1')
    expect(result.title).toBe('Untitled - Notepad')
    expect(result.appAssociation).toBe('Notepad')
    expect(result.bounds.width).toBe(800)
    expect(result.isSelfApp).toBe(false)
  })

  it('rejects stale or closed target window references', async () => {
    const resolver = new TargetResolver(createMockAdapter())

    await expect(
      resolver.resolveAndValidateTarget({ windowId: 'win_ext_non_existent' })
    ).rejects.toThrow(/closed, stale, or no longer available/)
  })

  it('rejects minimized windows to prevent delivering invisible input', async () => {
    const resolver = new TargetResolver(createMockAdapter())

    await expect(
      resolver.resolveAndValidateTarget({ windowId: 'win_ext_minimized_1' })
    ).rejects.toThrow(/currently minimized/)
  })

  it('enforces expected title matching when specified', async () => {
    const resolver = new TargetResolver(createMockAdapter())

    // Matching title
    await expect(
      resolver.resolveAndValidateTarget({
        windowId: 'win_ext_notepad_1',
        expectedTitleSubstring: 'Notepad'
      })
    ).resolves.toBeDefined()

    // Non-matching title
    await expect(
      resolver.resolveAndValidateTarget({
        windowId: 'win_ext_notepad_1',
        expectedTitleSubstring: 'Calculator'
      })
    ).rejects.toThrow(/title mismatch/)
  })

  it('enforces expected app association matching when specified', async () => {
    const resolver = new TargetResolver(createMockAdapter())

    // Matching app
    await expect(
      resolver.resolveAndValidateTarget({
        windowId: 'win_ext_notepad_1',
        expectedAppAssociation: 'Notepad'
      })
    ).resolves.toBeDefined()

    // Non-matching app
    await expect(
      resolver.resolveAndValidateTarget({
        windowId: 'win_ext_notepad_1',
        expectedAppAssociation: 'Excel'
      })
    ).rejects.toThrow(/app mismatch/)
  })

  it('rejects windows with invalid or zero dimensions', async () => {
    const resolver = new TargetResolver(createMockAdapter())

    await expect(
      resolver.resolveAndValidateTarget({ windowId: 'win_ext_zero_bounds' })
    ).rejects.toThrow(/invalid dimensions/)
  })
})

