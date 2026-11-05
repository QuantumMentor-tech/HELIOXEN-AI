import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { CommunicationService } from '../../src/main/communication/CommunicationService'
import {
  validateRecipientAddress,
  detectUnresolvedPlaceholders,
  computeDraftHash
} from '../../src/shared/communication/contracts'
import { MessageRecipient } from '../../src/shared/communication/types'

describe('Communication Service & Contracts (Step 44)', () => {
  let tempDir: string
  let service: CommunicationService
  let mockCurrentTime = 1700000000000

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-comm-test-'))
    mockCurrentTime = 1700000000000

    service = new CommunicationService({
      storageDir: tempDir,
      nowFn: () => mockCurrentTime,
      providerServiceGetter: () => null
    })
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe('1. Recipient Address & Placeholder Validation', () => {
    it('validates RFC-5322 standard email addresses correctly', () => {
      expect(validateRecipientAddress('alice@example.com', 'email').valid).toBe(true)
      expect(validateRecipientAddress('user.name+tag@sub.domain.co.uk', 'email').valid).toBe(true)

      // Malformed emails
      expect(validateRecipientAddress('not-an-email', 'email').valid).toBe(false)
      expect(validateRecipientAddress('missing@domain', 'email').valid).toBe(false)
      expect(validateRecipientAddress('@missing-user.com', 'email').valid).toBe(false)
      expect(validateRecipientAddress('   ', 'email').valid).toBe(false)
    })

    it('rejects unresolved placeholders in recipient addresses', () => {
      const res = validateRecipientAddress('[recipient_email]', 'email')
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('unresolved placeholder')
    })

    it('validates webhook URLs correctly', () => {
      expect(validateRecipientAddress('https://hooks.slack.com/services/T00/B00/X00', 'webhook_messaging').valid).toBe(true)
      expect(validateRecipientAddress('https://discord.com/api/webhooks/123/xyz', 'webhook_messaging').valid).toBe(true)

      // Insecure or malformed URLs
      expect(validateRecipientAddress('http://insecure.webhook.com', 'webhook_messaging').valid).toBe(false)
      expect(validateRecipientAddress('not-a-url', 'webhook_messaging').valid).toBe(false)
    })

    it('detects common unresolved placeholders in text body', () => {
      const textWithPlaceholders = 'Hello [Client Name], please review the TODO item and click {{verification_url}} or <link> before [Date].'
      const detected = detectUnresolvedPlaceholders(textWithPlaceholders)

      expect(detected).toContain('[Client Name]')
      expect(detected).toContain('TODO')
      expect(detected).toContain('{{verification_url}}')
      expect(detected).toContain('<link>')
      expect(detected).toContain('[Date]')
      expect(detected.length).toBe(5)

      // Clean text has no placeholders
      const cleanText = 'Hello Alice, please review the finalized financial report.'
      expect(detectUnresolvedPlaceholders(cleanText)).toHaveLength(0)
    })
  })

  describe('2. Draft Lifecycle & Tamper-Evident Content Hashing', () => {
    it('creates a draft and computes a deterministic content hash', () => {
      const recipients: readonly MessageRecipient[] = [{ address: 'team@helioxen.dev', type: 'to' }]
      const draft = service.createDraft({
        integrationId: 'integration_email_smtp_imap',
        channelType: 'email',
        recipients,
        subject: 'Q4 Architecture Update',
        body: 'All systems are operating nominally.'
      })

      expect(draft.id).toBeDefined()
      expect(draft.validationState).toBe('valid')
      expect(draft.validationErrors).toHaveLength(0)
      expect(draft.contentHash).toBeDefined()
      expect(draft.contentHash.length).toBe(64) // SHA-256 hex string

      // Verify the hash is deterministic
      const expectedHash = computeDraftHash({
        recipients,
        subject: 'Q4 Architecture Update',
        body: 'All systems are operating nominally.',
        attachments: []
      })
      expect(draft.contentHash).toBe(expectedHash)
    })

    it('flags validation errors when creating a draft with invalid recipients or placeholders', () => {
      const draft = service.createDraft({
        integrationId: 'integration_email_smtp_imap',
        channelType: 'email',
        recipients: [{ address: 'invalid-email', type: 'to' }],
        subject: 'Test',
        body: 'Please do TODO item'
      })

      expect(draft.validationState).toBe('invalid_recipients')
      expect(draft.validationErrors.length).toBeGreaterThan(0)
    })

    it('updates a draft and recomputes the hash', () => {
      const recipients: readonly MessageRecipient[] = [{ address: 'team@helioxen.dev', type: 'to' }]
      const draft = service.createDraft({
        integrationId: 'integration_email_smtp_imap',
        channelType: 'email',
        recipients,
        subject: 'Initial Subject',
        body: 'Initial Body'
      })

      const initialHash = draft.contentHash

      const updated = service.updateDraft(draft.id, {
        subject: 'Updated Subject'
      })

      expect(updated.subject).toBe('Updated Subject')
      expect(updated.contentHash).not.toBe(initialHash)
    })
  })

  describe('3. Mandatory Two-Tier Human Confirmation Flow', () => {
    it('issues a confirmation token with a 60-second TTL bound to exact draft hash', () => {
      const recipients: readonly MessageRecipient[] = [{ address: 'auditor@helioxen.dev', type: 'to' }]
      const draft = service.createDraft({
        integrationId: 'integration_email_smtp_imap',
        channelType: 'email',
        recipients,
        subject: 'Audit Report',
        body: 'Audit verified.'
      })

      const confirmation = service.requestSendConfirmation(draft.id)

      expect(confirmation.confirmationId).toBeDefined()
      expect(confirmation.draftId).toBe(draft.id)
      expect(confirmation.draftHash).toBe(draft.contentHash)
      expect(confirmation.expiresAt).toBe(mockCurrentTime + 60000) // Exactly 60s TTL
      expect(confirmation.status).toBe('pending')
      expect(confirmation.recipientSummary[0]).toContain('auditor@helioxen.dev')
    })

    it('rejects sending when authorization token has expired (> 60s)', async () => {
      const draft = service.createDraft({
        integrationId: 'integration_email_smtp_imap',
        channelType: 'email',
        recipients: [{ address: 'auditor@helioxen.dev', type: 'to' }],
        subject: 'Audit Report',
        body: 'Audit verified.'
      })

      const confirmation = service.requestSendConfirmation(draft.id)

      // Advance time past the 60s TTL (61 seconds)
      mockCurrentTime += 61000

      const sendResult = await service.confirmAndSend({
        confirmationId: confirmation.confirmationId,
        draftId: draft.id,
        approvedDraftHash: confirmation.draftHash
      })

      expect(sendResult.success).toBe(false)
      expect(sendResult.error).toContain('expired')
    })

    it('rejects sending when draft was modified after confirmation was requested (tamper detection)', async () => {
      const draft = service.createDraft({
        integrationId: 'integration_email_smtp_imap',
        channelType: 'email',
        recipients: [{ address: 'auditor@helioxen.dev', type: 'to' }],
        subject: 'Audit Report',
        body: 'Audit verified.'
      })

      const confirmation = service.requestSendConfirmation(draft.id)

      // User or attacker silently alters the draft body after user reviewed it!
      service.updateDraft(draft.id, {
        body: 'Altered content: Transfer $50,000 to unauthorized account.'
      })

      // Attempting to send with the old confirmation token
      const sendResult = await service.confirmAndSend({
        confirmationId: confirmation.confirmationId,
        draftId: draft.id,
        approvedDraftHash: confirmation.draftHash
      })

      expect(sendResult.success).toBe(false)
      // Since updateDraft invalidates pending confirmations if content changes, confirmation is not found or rejected
      expect(sendResult.error).toBeDefined()
    })

    it('successfully confirms and sends message when token, hash, and TTL are valid', async () => {
      const draft = service.createDraft({
        integrationId: 'integration_email_smtp_imap',
        channelType: 'email',
        recipients: [{ address: 'partner@enterprise.com', type: 'to' }],
        subject: 'Contract Signed',
        body: 'Please find our acceptance.'
      })

      const confirmation = service.requestSendConfirmation(draft.id)

      const sendResult = await service.confirmAndSend({
        confirmationId: confirmation.confirmationId,
        draftId: draft.id,
        approvedDraftHash: confirmation.draftHash,
        idempotencyKey: 'idem-test-100'
      })

      expect(sendResult.success).toBe(true)
      expect(sendResult.messageId).toBeDefined()
      expect(sendResult.deliveryStatus).toBe('confirmed_delivered')

      // Draft should be removed after being promoted to sent
      expect(service.getDraft(draft.id)).toBeNull()
    })

    it('prevents accidental duplicate sending via idempotency key', async () => {
      const draft = service.createDraft({
        integrationId: 'integration_email_smtp_imap',
        channelType: 'email',
        recipients: [{ address: 'partner@enterprise.com', type: 'to' }],
        subject: 'Contract Signed',
        body: 'Please find our acceptance.'
      })

      const confirmation = service.requestSendConfirmation(draft.id)

      // First send
      const firstResult = await service.confirmAndSend({
        confirmationId: confirmation.confirmationId,
        draftId: draft.id,
        approvedDraftHash: confirmation.draftHash,
        idempotencyKey: 'unique-idempotency-key-abc'
      })
      expect(firstResult.success).toBe(true)

      // Second identical send with same idempotency key (e.g. user double-clicked or network retried)
      const duplicateResult = await service.confirmAndSend({
        confirmationId: confirmation.confirmationId,
        draftId: draft.id,
        approvedDraftHash: confirmation.draftHash,
        idempotencyKey: 'unique-idempotency-key-abc'
      })

      expect(duplicateResult.success).toBe(true)
      expect(duplicateResult.messageId).toBe(firstResult.messageId)
      expect(duplicateResult.warnings).toBeDefined()
      expect(duplicateResult.warnings![0]).toContain('Duplicate send request prevented')
    })
  })

  describe('4. AI-Assisted Drafting (Quarantined Proposals)', () => {
    it('generates a quarantined draft proposal with explicit human oversight warnings', async () => {
      const proposal = await service.generateAiDraft({
        prompt: 'Draft an urgent security patch notification for our internal engineering channel',
        tone: 'formal'
      })

      expect(proposal.body).toBeDefined()
      expect(proposal.subject).toBeDefined()
      expect(proposal.summary).toBeDefined()
      expect(proposal.warnings).toBeDefined()
      expect(proposal.warnings![0]).toContain('AI proposals are drafts only')
    })
  })
})
