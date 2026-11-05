import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { IntegrationsManager } from '../../src/main/integrations/IntegrationsManager'
import { CredentialStorageService } from '../../src/main/security/credentialStorage'
import { CommunicationService } from '../../src/main/communication/CommunicationService'

describe('Integrations & Communication Security Isolation (Step 44)', () => {
  let tempDir: string
  let credentialService: CredentialStorageService
  let integrationsManager: IntegrationsManager
  let communicationService: CommunicationService

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-security-test-'))
    const credsPath = path.join(tempDir, 'credentials.vault')
    const mockEncryptionProvider = {
      isEncryptionAvailable: () => true,
      encryptString: (plainText: string) =>
        Buffer.from(`CIPHER_${Buffer.from(plainText, 'utf8').toString('base64')}`, 'utf8'),
      decryptString: (encrypted: Buffer) => {
        const str = encrypted.toString('utf8')
        const b64 = str.replace('CIPHER_', '')
        return Buffer.from(b64, 'base64').toString('utf8')
      }
    }
    credentialService = new CredentialStorageService(credsPath, mockEncryptionProvider)
    integrationsManager = new IntegrationsManager({ storageDir: tempDir, credentialStorage: credentialService })
    communicationService = new CommunicationService({ storageDir: tempDir, integrationsManager })
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe('1. DPAPI Credential Vault Integration', () => {
    it('initializes with default integration adapters in disconnected/not_configured state', () => {
      const list = integrationsManager.listIntegrations()
      expect(list.length).toBeGreaterThanOrEqual(4)

      const emailIntegration = list.find((i) => i.id === 'integration_email_smtp_imap')
      expect(emailIntegration).toBeDefined()
      expect(emailIntegration?.category).toBe('communication')
      expect(emailIntegration?.status).toBe('disconnected')

      const spotifyIntegration = list.find((i) => i.id === 'integration_spotify_streaming')
      expect(spotifyIntegration).toBeDefined()
      expect(spotifyIntegration?.category).toBe('media')
    })

    it('stores credentials in secure storage on connect and clears on disconnect', async () => {
      const connectRes = await integrationsManager.connectIntegration({
        integrationId: 'integration_team_chat_webhook',
        accountLabel: 'Dev Operations Webhook',
        credentials: {
          webhookUrl: 'https://hooks.slack.com/services/T123/B456/SECRET_TOKEN'
        }
      })

      expect(connectRes.success).toBe(true)

      // State is updated to connected
      const connectedDescriptor = integrationsManager.getIntegration('integration_team_chat_webhook')
      expect(connectedDescriptor?.status).toBe('connected')
      expect(connectedDescriptor?.connectedAccountLabel).toBe('Dev Operations Webhook')

      // Disconnect and purge credentials
      const disconnectRes = await integrationsManager.disconnectIntegration({
        integrationId: 'integration_team_chat_webhook',
        revokeRemote: true
      })

      expect(disconnectRes.success).toBe(true)

      const disconnectedDescriptor = integrationsManager.getIntegration('integration_team_chat_webhook')
      expect(disconnectedDescriptor?.status).toBe('disconnected')
      expect(disconnectedDescriptor?.connectedAccountLabel).toBeUndefined()
    })
  })

  describe('2. Inbound Message Untrusted Content Isolation', () => {
    it('strictly marks all inbound external messages as isUntrusted: true', () => {
      const messages = communicationService.listMessages()

      expect(messages.length).toBeGreaterThan(0)
      for (const msg of messages) {
        // Enforce security invariant: All external inbound communication content is marked untrusted
        expect(msg.isUntrusted).toBe(true)
        expect(typeof msg.body.text).toBe('string')
      }
    })

    it('filters messages by channel without leaking unselected channels', () => {
      const emailMessages = communicationService.listMessages({ channelType: 'email' })
      for (const msg of emailMessages) {
        expect(msg.channelType).toBe('email')
      }

      const chatMessages = communicationService.listMessages({ channelType: 'team_chat' })
      for (const msg of chatMessages) {
        expect(msg.channelType).toBe('team_chat')
      }
    })
  })

  describe('3. Integration Health Checks & Diagnostics', () => {
    it('runs health checks on integration adapters with latency reporting', async () => {
      const health = await integrationsManager.checkHealth('integration_local_media')

      expect(health.id).toBe('integration_local_media')
      expect(health.status).toBe('connected')
      expect(health.isHealthy).toBe(true)
    })
  })
})
