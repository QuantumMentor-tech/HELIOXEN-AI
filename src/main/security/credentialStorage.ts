import { promises as fs } from 'fs'
import { join } from 'path'
import { IpcException } from '../../shared/ipc/errors'
import { securityLogger } from './securityLogger'

export interface EncryptionProvider {
  isEncryptionAvailable: () => boolean
  encryptString: (plainText: string) => Buffer
  decryptString: (encrypted: Buffer) => string
}

export interface StoredCredentialRecord {
  id: string
  provider: string
  label: string
  /** Base64-encoded encrypted ciphertext buffer */
  ciphertext: string
  createdAt: number
  updatedAt: number
}

export interface CredentialMetadata {
  id: string
  provider: string
  label: string
  createdAt: number
  updatedAt: number
}

interface CredentialStoreFile {
  version: number
  schema: 'helioxen.credentials.v1'
  records: Record<string, StoredCredentialRecord>
}

export class CredentialStorageService {
  private encryptionProvider: EncryptionProvider
  private storageFilePath: string
  private cache: CredentialStoreFile | null = null

  constructor(storageFilePath: string, encryptionProvider?: EncryptionProvider) {
    this.storageFilePath = storageFilePath

    if (encryptionProvider) {
      this.encryptionProvider = encryptionProvider
    } else {
      // Default to Electron safeStorage in production
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { safeStorage } = require('electron')
        this.encryptionProvider = safeStorage
      } catch {
        // Fallback placeholder if electron is not yet initialized
        this.encryptionProvider = {
          isEncryptionAvailable: () => false,
          encryptString: () => {
            throw new Error('safeStorage not initialized')
          },
          decryptString: () => {
            throw new Error('safeStorage not initialized')
          }
        }
      }
    }
  }

  /**
   * Asserts that native OS-level encryption is available on the current host.
   */
  public isAvailable(): boolean {
    try {
      return this.encryptionProvider.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  /**
   * Encrypts and persists a secret into the secure vault using native DPAPI.
   * Never stores plaintext credentials on disk.
   */
  public async storeSecret(
    idOrParams: string | { id: string; provider: string; label: string; secret: string },
    providerArg?: string,
    labelArg?: string,
    secretArg?: string
  ): Promise<void> {
    if (!this.isAvailable()) {
      securityLogger.logEvent('CREDENTIAL_OPERATION', 'system', 'ERROR', {
        capabilityId: 'credential:store',
        reason: 'Native DPAPI encryption is unavailable on this host'
      })
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        'Native credential encryption (DPAPI safeStorage) is unavailable on this host. Plaintext storage is prohibited.'
      )
    }

    const params =
      typeof idOrParams === 'string'
        ? {
            id: (idOrParams || '').trim(),
            provider: (providerArg ?? '').trim(),
            label: (labelArg ?? '').trim(),
            secret: secretArg ?? ''
          }
        : {
            id: (idOrParams.id || '').trim(),
            provider: (idOrParams.provider || '').trim(),
            label: (idOrParams.label || '').trim(),
            secret: idOrParams.secret || ''
          }

    if (!params.id || !params.secret.trim()) {
      throw new IpcException('VALIDATION_ERROR', 'Credential ID and non-empty secret are required')
    }

    // Encrypt plaintext secret
    const cipherBuffer = this.encryptionProvider.encryptString(params.secret)
    const ciphertext = cipherBuffer.toString('base64')

    const store = await this.loadStore()
    const now = Date.now()
    const existing = store.records[params.id]

    store.records[params.id] = {
      id: params.id,
      provider: params.provider,
      label: params.label,
      ciphertext,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    }

    await this.persistStore(store)

    securityLogger.logEvent('CREDENTIAL_OPERATION', 'main-process', 'PERMITTED', {
      capabilityId: 'credential:store',
      details: { id: params.id, provider: params.provider }
    })
  }

  /**
   * Checks whether a credential exists in the vault without decrypting it.
   */
  public async hasCredential(id: string): Promise<boolean> {
    const store = await this.loadStore()
    return Boolean(store.records[id])
  }

  /**
   * Retrieves and decrypts a credential secret.
   * Strictly restricted to trusted main-process execution.
   */
  public async retrieveSecret(id: string): Promise<string | null> {
    if (!this.isAvailable()) {
      throw new IpcException(
        'OPERATION_UNAVAILABLE',
        'Native credential encryption is unavailable. Cannot decrypt stored credentials.'
      )
    }

    const store = await this.loadStore()
    const record = store.records[id]
    if (!record) {
      return null
    }

    try {
      const cipherBuffer = Buffer.from(record.ciphertext, 'base64')
      const plainText = this.encryptionProvider.decryptString(cipherBuffer)

      securityLogger.logEvent('CREDENTIAL_OPERATION', 'main-process', 'PERMITTED', {
        capabilityId: 'credential:retrieve',
        details: { id, provider: record.provider }
      })

      return plainText
    } catch (err) {
      securityLogger.logEvent('CREDENTIAL_OPERATION', 'main-process', 'ERROR', {
        capabilityId: 'credential:retrieve',
        reason: 'Failed to decrypt credential buffer'
      })
      throw new IpcException(
        'INTERNAL_ERROR',
        `Failed to decrypt credential '${id}'. Record may be corrupted or key was rotated.`
      )
    }
  }

  /**
   * Deletes a stored credential record from the vault.
   */
  public async deleteSecret(id: string): Promise<boolean> {
    const store = await this.loadStore()
    if (!store.records[id]) {
      return false
    }

    delete store.records[id]
    await this.persistStore(store)

    securityLogger.logEvent('CREDENTIAL_OPERATION', 'main-process', 'PERMITTED', {
      capabilityId: 'credential:delete',
      details: { id }
    })

    return true
  }

  /**
   * Checks whether a credential exists in the vault.
   */
  public async hasSecret(id: string): Promise<boolean> {
    const store = await this.loadStore()
    return Boolean(store.records[id])
  }

  /**
   * Lists non-sensitive credential metadata without exposing ciphertext or plaintext secrets.
   */
  public async listMetadata(): Promise<CredentialMetadata[]> {
    const store = await this.loadStore()
    return Object.values(store.records).map((r) => ({
      id: r.id,
      provider: r.provider,
      label: r.label,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }))
  }

  /**
   * Loads the credential store from disk, handling missing or corrupted files safely.
   */
  private async loadStore(): Promise<CredentialStoreFile> {
    if (this.cache) return this.cache

    try {
      const data = await fs.readFile(this.storageFilePath, 'utf8')
      const parsed = JSON.parse(data) as CredentialStoreFile

      if (parsed.schema !== 'helioxen.credentials.v1' || !parsed.records) {
        throw new Error('Incompatible credential store format')
      }

      this.cache = parsed
      return parsed
    } catch (err: unknown) {
      const nodeErr = err as { code?: string }
      if (nodeErr.code === 'ENOENT') {
        const emptyStore: CredentialStoreFile = {
          version: 1,
          schema: 'helioxen.credentials.v1',
          records: {}
        }
        this.cache = emptyStore
        return emptyStore
      }

      // If file is corrupted, preserve it safely without overwriting
      securityLogger.logEvent('CREDENTIAL_OPERATION', 'system', 'ERROR', {
        reason: 'Credential store file is corrupted or unreadable'
      })
      throw new IpcException(
        'INTERNAL_ERROR',
        'Credential store file is corrupted or invalid. Refusing destructive reset.'
      )
    }
  }

  /**
   * Persists store file atomically using a temporary file rename.
   */
  private async persistStore(store: CredentialStoreFile): Promise<void> {
    const tempFile = `${this.storageFilePath}.${Date.now()}.tmp`
    const json = JSON.stringify(store, null, 2)

    await fs.writeFile(tempFile, json, 'utf8')
    await fs.rename(tempFile, this.storageFilePath)
    this.cache = store
  }
}
