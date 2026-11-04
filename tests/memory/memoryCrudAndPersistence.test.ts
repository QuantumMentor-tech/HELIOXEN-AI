/**
 * HELIOXEN AI — Step 34: Memory CRUD, Conflict Resolution, Encryption & Migration Tests
 * Covers Section 16.3 (CRUD and persistence tests) and Section 11 (Encryption & Migrations).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { MemoryService } from '../../src/main/memory/MemoryService'
import { EncryptionProvider } from '../../src/main/security/credentialStorage'

function createMockEncryptionProvider(available = true): EncryptionProvider {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (plainText: string) =>
      Buffer.from(`ENC_V1:${Buffer.from(plainText, 'utf8').toString('base64')}`, 'utf8'),
    decryptString: (cipherBuf: Buffer) => {
      const str = cipherBuf.toString('utf8')
      if (!str.startsWith('ENC_V1:')) {
        throw new Error('Corrupted ciphertext')
      }
      return Buffer.from(str.slice('ENC_V1:'.length), 'base64').toString('utf8')
    }
  }
}

describe('Step 34: Memory CRUD, Conflict Resolution, Encryption & Migrations', () => {
  let tempDir: string
  let storePath: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-mem-crud-'))
    storePath = path.join(tempDir, 'memory_store.json')
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('encrypts memory content at rest when safeStorage is available and decrypts transparently on restart', async () => {
    const enc = createMockEncryptionProvider(true)
    const service = new MemoryService(storePath, enc)
    await service.initialize()
    await service.setConsent({ memoryEnabled: true })

    const created = await service.createMemory({
      content: 'Project Helioxen uses strict Electron contextIsolation.',
      category: 'projects',
      projectScope: 'helioxen',
      sourceType: 'explicit_user_request'
    })

    expect(created.record?.encryptedAtRest).toBe(true)

    // Verify raw file on disk does NOT contain plaintext memory content
    const rawDisk = fs.readFileSync(storePath, 'utf8')
    expect(rawDisk).not.toContain('Project Helioxen uses strict Electron contextIsolation.')
    expect(rawDisk).toContain('contentCiphertext')

    // Restart and verify transparent decryption
    const restarted = new MemoryService(storePath, enc)
    await restarted.initialize()
    const list = restarted.listMemories()
    expect(list).toHaveLength(1)
    expect(list[0].content).toBe('Project Helioxen uses strict Electron contextIsolation.')
    expect(list[0].encryptedAtRest).toBe(true)
  })

  it('accurately reports encryptedAtRest = false when OS encryption is unavailable', async () => {
    const unavailEnc = createMockEncryptionProvider(false)
    const service = new MemoryService(storePath, unavailEnc)
    await service.initialize()
    await service.setConsent({ memoryEnabled: true })

    expect(service.getStateOverview().encryptionAvailable).toBe(false)

    const created = await service.createMemory({
      content: 'Use Vitest for unit tests.',
      category: 'workflows',
      sourceType: 'explicit_user_request'
    })
    expect(created.record?.encryptedAtRest).toBe(false)
  })

  it('deduplicates identical active memories and supersedes contradictory preferences deterministically', async () => {
    const service = new MemoryService(storePath, createMockEncryptionProvider(true))
    await service.initialize()
    await service.setConsent({ memoryEnabled: true })

    const first = await service.createMemory({
      content: 'Prefer concise, short responses.',
      category: 'preferences',
      sourceType: 'explicit_user_request'
    })
    expect(first.deduplicated).toBe(false)

    // Submitting identical fact updates timestamp without duplicating
    const duplicate = await service.createMemory({
      content: 'prefer concise, short responses.',
      category: 'preferences',
      sourceType: 'explicit_user_request'
    })
    expect(duplicate.deduplicated).toBe(true)
    expect(duplicate.record?.id).toBe(first.record?.id)
    expect(service.listMemories({ status: 'active' })).toHaveLength(1)

    // Submitting a contradictory preference supersedes the earlier active preference
    const replacement = await service.createMemory({
      content: 'Prefer detailed, comprehensive responses with examples.',
      category: 'preferences',
      sourceType: 'explicit_user_request'
    })
    expect(replacement.supersededRecordIds).toContain(first.record!.id)

    const activeOnly = service.listMemories({ status: 'active' })
    expect(activeOnly).toHaveLength(1)
    expect(activeOnly[0].id).toBe(replacement.record?.id)

    const oldRec = service.getMemory(first.record!.id)
    expect(oldRec?.status).toBe('superseded')
    expect(oldRec?.supersededById).toBe(replacement.record?.id)
  })

  it('supports editing, deleting single records, and clearing all records with confirmation while preserving profile', async () => {
    const service = new MemoryService(storePath, createMockEncryptionProvider(true))
    await service.initialize()
    await service.setConsent({ memoryEnabled: true })
    await service.updateProfile({
      displayName: 'Alex Architect',
      personalization: {
        responseTone: 'technical',
        preferredFormatting: 'code_first',
        primaryLanguages: ['TypeScript'],
        customWorkingConventions: 'Always run typecheck'
      }
    })

    const m1 = await service.createMemory({
      content: 'Fact one',
      category: 'reference_facts',
      sourceType: 'explicit_user_request'
    })
    await service.createMemory({
      content: 'Fact two',
      category: 'workflows',
      sourceType: 'explicit_user_request'
    })

    // Edit m1
    const updated = await service.updateMemory({
      id: m1.record!.id,
      content: 'Fact one (corrected by user)'
    })
    expect(updated.record.content).toBe('Fact one (corrected by user)')
    expect(updated.record.sourceType).toBe('user_correction')

    // Clear all without confirmClearAll: true must fail
    await expect(
      service.clearAllMemories({ confirmClearAll: false })
    ).rejects.toThrow(/Explicit confirmation/i)

    // Clear all with confirmation deletes memories but preserves profile personalization when resetPersonalization is false
    const cleared = await service.clearAllMemories({
      confirmClearAll: true,
      resetPersonalization: false
    })
    expect(cleared.deletedCount).toBe(2)
    expect(service.listMemories({ status: 'all' })).toHaveLength(0)

    const profileAfterClear = service.getProfile()
    expect(profileAfterClear.displayName).toBe('Alex Architect')
    expect(profileAfterClear.personalization.responseTone).toBe('technical')
  })

  it('supports transient suggestions, approval persistence, and session-scoped dismissal suppression', async () => {
    const service = new MemoryService(storePath, createMockEncryptionProvider(true))
    await service.initialize()
    await service.setConsent({ memoryEnabled: true, allowMemorySuggestions: true })

    const sug1 = service.proposeSuggestion({
      proposedContent: 'Use pnpm for workspace packages',
      category: 'workflows',
      reason: 'Mentioned during build setup'
    })
    expect(sug1.status).toBe('pending')
    expect(service.getStateOverview().pendingSuggestions).toHaveLength(1)

    // Dismissing sug1 suppresses identical suggestion during the session
    const dismissed = await service.resolveSuggestion({
      suggestionId: sug1.id,
      action: 'dismiss'
    })
    expect(dismissed.suggestion.status).toBe('dismissed')
    expect(service.listMemories()).toHaveLength(0)

    expect(() =>
      service.proposeSuggestion({
        proposedContent: 'Use pnpm for workspace packages',
        category: 'workflows',
        reason: 'Attempt repeat suggestion'
      })
    ).toThrow(/already dismissed/i)

    // Approving a different suggestion saves it as a persistent memory
    const sug2 = service.proposeSuggestion({
      proposedContent: 'Target Node.js 20 LTS runtime',
      category: 'projects',
      projectScope: 'helioxen',
      reason: 'Approved runtime target'
    })
    const approved = await service.resolveSuggestion({
      suggestionId: sug2.id,
      action: 'approve'
    })
    expect(approved.savedRecord).toBeDefined()
    expect(approved.savedRecord?.sourceType).toBe('approved_suggestion')
    expect(service.listMemories()).toHaveLength(1)
  })
})

