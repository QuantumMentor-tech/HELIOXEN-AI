/**
 * HELIOXEN AI — Step 31: Browser Session Manager Tests
 */

import { describe, it, expect, vi } from 'vitest'
import {
  BrowserSessionManager,
  BrowserSessionAdapter
} from '../../src/main/browser/BrowserSessionManager'

describe('Step 31: Browser Session Manager', () => {
  const createMockAdapter = (): { adapter: BrowserSessionAdapter; partitions: Map<string, any> } => {
    const partitions = new Map<string, any>()

    const adapter: BrowserSessionAdapter = {
      fromPartition: (partitionName: string) => {
        const sessionMock = {
          partition: partitionName,
          setPermissionRequestHandler: vi.fn(),
          setPermissionCheckHandler: vi.fn(),
          clearStorageData: vi.fn().mockResolvedValue(undefined),
          on: vi.fn()
        }
        partitions.set(partitionName, sessionMock)
        return sessionMock
      }
    }

    return { adapter, partitions }
  }

  it('creates an in-memory browser session with proper partition naming', () => {
    const { adapter, partitions } = createMockAdapter()
    const manager = new BrowserSessionManager(adapter)

    const session = manager.createSession({ sessionId: 'session_temp_1', persist: false })

    expect(session.sessionId).toBe('session_temp_1')
    expect(session.isPersistent).toBe(false)
    expect(session.partition).toBe('helioxen_browser_temp_session_temp_1')
    expect(partitions.has('helioxen_browser_temp_session_temp_1')).toBe(true)
  })

  it('creates a persistent browser session with persist: partition naming', () => {
    const { adapter, partitions } = createMockAdapter()
    const manager = new BrowserSessionManager(adapter)

    const session = manager.createSession({ sessionId: 'session_pers_1', persist: true })

    expect(session.sessionId).toBe('session_pers_1')
    expect(session.isPersistent).toBe(true)
    expect(session.partition).toBe('persist:helioxen_browser_session_pers_1')
    expect(partitions.has('persist:helioxen_browser_session_pers_1')).toBe(true)
  })

  it('provides a default in-memory session profile initialized on startup', () => {
    const { adapter } = createMockAdapter()
    const manager = new BrowserSessionManager(adapter)

    const defaultSession = manager.getSession()
    expect(defaultSession).toBeDefined()
    expect(defaultSession.isPersistent).toBe(false)
    expect(defaultSession.partition).toContain('helioxen_browser_temp_')
  })

  it('lists active sessions and retrieves sessions by ID', () => {
    const { adapter } = createMockAdapter()
    const manager = new BrowserSessionManager(adapter)

    manager.createSession({ sessionId: 'sess_a' })
    manager.createSession({ sessionId: 'sess_b' })

    const list = manager.listSessions()
    expect(list.some((s) => s.sessionId === 'sess_a')).toBe(true)
    expect(list.some((s) => s.sessionId === 'sess_b')).toBe(true)

    expect(manager.getSession('sess_a').sessionId).toBe('sess_a')
    expect(() => manager.getSession('non_existent')).toThrow(/does not exist/)
  })

  it('clears storage data for a session profile', async () => {
    const { adapter, partitions } = createMockAdapter()
    const manager = new BrowserSessionManager(adapter)

    manager.createSession({ sessionId: 'sess_clear_1' })
    const result = await manager.clearSessionData({
      sessionId: 'sess_clear_1',
      storages: ['cookies', 'cache']
    })

    expect(result.success).toBe(true)
    expect(result.sessionId).toBe('sess_clear_1')

    const sessObj = partitions.get('helioxen_browser_temp_sess_clear_1')
    expect(sessObj.clearStorageData).toHaveBeenCalled()
  })

  it('closes a session and cleans up its partition references', () => {
    const { adapter } = createMockAdapter()
    const manager = new BrowserSessionManager(adapter)

    manager.createSession({ sessionId: 'sess_to_close' })
    expect(manager.getSession('sess_to_close')).toBeDefined()

    const closeRes = manager.closeSession('sess_to_close')
    expect(closeRes.success).toBe(true)

    expect(() => manager.getSession('sess_to_close')).toThrow(/does not exist/)
  })
})

