import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  CredentialStorageService,
  EncryptionProvider
} from '../../src/main/security/credentialStorage'
import { IpcException } from '../../src/shared/ipc/errors'

describe('CredentialStorageService (Secure Credential Storage)', () => {
  let testStoragePath: string
  let mockEncryptionProvider: EncryptionProvider
  let service: CredentialStorageService

  beforeEach(() => {
    testStoragePath = join(
      tmpdir(),
      `helioxen-test-creds-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.json`
    )

    // Mock encryption provider simulating reversible ciphertext transformation
    mockEncryptionProvider = {
      isEncryptionAvailable: () => true,
      encryptString: (plainText: string) =>
        Buffer.from(`CIPHERTEXT_${Buffer.from(plainText, 'utf8').toString('base64')}`, 'utf8'),
      decryptString: (encrypted: Buffer) => {
        const raw = encrypted.toString('utf8')
        if (!raw.startsWith('CIPHERTEXT_')) {
          throw new Error('Decryption failure: invalid header')
        }
        const b64 = raw.replace('CIPHERTEXT_', '')
        return Buffer.from(b64, 'base64').toString('utf8')
      }
    }

    service = new CredentialStorageService(testStoragePath, mockEncryptionProvider)
  })

  afterEach(async () => {
    try {
      await fs.unlink(testStoragePath)
    } catch {
      // Ignore cleanup error if file was never created
    }
  })

  it('stores and retrieves a synthetic credential through the trusted main service', async () => {
    const id = 'provider-gemini-test'
    const secret = 'sk-test-secret-canary-value-12345'

    await service.storeSecret(id, 'google-gemini', 'Primary Gemini Key', secret)

    const retrieved = await service.retrieveSecret(id)
    expect(retrieved).toBe(secret)
  })

  it('verifies that secret value is never written in plaintext at rest (Plaintext-at-Rest Check)', async () => {
    const id = 'provider-canary-test'
    const canaryPlaintext = 'UNENCRYPTED_CANARY_SECRET_XYZ987'

    await service.storeSecret(id, 'test-provider', 'Canary Secret', canaryPlaintext)

    // Read the raw file directly from disk
    const fileContents = await fs.readFile(testStoragePath, 'utf8')

    // Assert that the canary plaintext does NOT appear anywhere in the file
    expect(fileContents).not.toContain(canaryPlaintext)
    // Assert that the file is valid JSON with encrypted ciphertext field
    const parsed = JSON.parse(fileContents)
    expect(parsed.schema).toBe('helioxen.credentials.v1')
    expect(parsed.records[id].ciphertext).toBeDefined()
    expect(parsed.records[id].ciphertext).not.toBe(canaryPlaintext)
  })

  it('replaces an existing secret value atomically', async () => {
    const id = 'replace-test-key'
    await service.storeSecret(id, 'test-provider', 'Key V1', 'secret-v1')
    expect(await service.retrieveSecret(id)).toBe('secret-v1')

    await service.storeSecret(id, 'test-provider', 'Key V2', 'secret-v2')
    expect(await service.retrieveSecret(id)).toBe('secret-v2')
  })

  it('deletes a stored credential and confirms existence check updates', async () => {
    const id = 'delete-test-key'
    await service.storeSecret(id, 'test-provider', 'Delete Key', 'secret-to-delete')
    expect(await service.hasCredential(id)).toBe(true)

    const deleted = await service.deleteSecret(id)
    expect(deleted).toBe(true)
    expect(await service.hasCredential(id)).toBe(false)
    expect(await service.retrieveSecret(id)).toBeNull()
  })

  it('lists non-sensitive metadata without exposing the secret ciphertext or plaintext', async () => {
    await service.storeSecret('key-1', 'openai', 'OpenAI Work', 'sk-proj-1111')
    await service.storeSecret('key-2', 'anthropic', 'Claude Personal', 'sk-ant-2222')

    const metadataList = await service.listMetadata()
    expect(metadataList.length).toBe(2)

    for (const item of metadataList) {
      expect(item.id).toBeDefined()
      expect(item.provider).toBeDefined()
      expect(item.label).toBeDefined()
      expect(item.createdAt).toBeGreaterThan(0)
      // Confirm no secret or ciphertext property exists on metadata
      expect((item as Record<string, unknown>).secret).toBeUndefined()
      expect((item as Record<string, unknown>).ciphertext).toBeUndefined()
    }
  })

  it('fails closed when encryption provider reports unavailability', async () => {
    const unavailableProvider: EncryptionProvider = {
      isEncryptionAvailable: () => false,
      encryptString: () => Buffer.from(''),
      decryptString: () => ''
    }
    const safeService = new CredentialStorageService(testStoragePath, unavailableProvider)

    await expect(
      safeService.storeSecret('key-id', 'provider', 'label', 'test-secret')
    ).rejects.toThrow(IpcException)
  })

  it('refuses destructive reset on corrupted or tampered storage file', async () => {
    // Write invalid, corrupt JSON to the store file
    await fs.writeFile(testStoragePath, '{"corrupted": true, broken: ]}', 'utf8')

    const corruptService = new CredentialStorageService(testStoragePath, mockEncryptionProvider)

    await expect(corruptService.retrieveSecret('any-key')).rejects.toThrow(IpcException)
  })

  it('rejects invalid or empty credential IDs', async () => {
    await expect(
      service.storeSecret('  ', 'provider', 'label', 'secret')
    ).rejects.toThrow(IpcException)
  })
})
