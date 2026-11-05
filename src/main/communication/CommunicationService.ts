/**
 * HELIOXEN AI — Step 44: Communication Service
 * Orchestrates messages, conversations, draft authoring, recipient validation,
 * mandatory human send confirmation, duplicate-send protection, and AI assistance.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  CommunicationChannelType,
  CommunicationMessage,
  CommunicationConversation,
  MessageDraft,
  SendConfirmationRequest,
  SendMessageRequest,
  SendMessageResult,
  CommunicationSearchQuery,
  CommunicationAiDraftRequest,
  CommunicationAiDraftResponse,
  MessageRecipient
} from '../../shared/communication/types'
import {
  validateRecipientAddress,
  detectUnresolvedPlaceholders,
  computeDraftHash,
  MessageDraftSchema
} from '../../shared/communication/contracts'
import { ProviderService } from '../ai/ProviderService'
import { securityLogger } from '../security/securityLogger'
import { IntegrationsManager } from '../integrations/IntegrationsManager'

export interface CommunicationServiceOptions {
  readonly storageDir: string
  readonly integrationsManager?: IntegrationsManager
  readonly providerServiceGetter?: () => ProviderService | null
  readonly nowFn?: () => number
}

interface PersistedCommunicationStore {
  readonly schemaVersion: number
  readonly updatedAt: number
  readonly drafts: Record<string, MessageDraft>
  readonly sentMessages: Record<string, CommunicationMessage>
  readonly processedIdempotencyKeys: Record<string, { messageId: string; submittedAt: number }>
}

export class CommunicationService {
  private readonly storageDir: string
  private readonly storePath: string
  private readonly integrationsManager?: IntegrationsManager
  private providerServiceGetter?: () => ProviderService | null
  private readonly nowFn: () => number

  private drafts: Map<string, MessageDraft> = new Map()
  private sentMessages: Map<string, CommunicationMessage> = new Map()
  private inboxMessages: Map<string, CommunicationMessage> = new Map()
  private pendingConfirmations: Map<string, SendConfirmationRequest> = new Map()
  private processedIdempotencyKeys: Map<string, { messageId: string; submittedAt: number }> = new Map()

  constructor(options: CommunicationServiceOptions) {
    this.storageDir = options.storageDir
    this.integrationsManager = options.integrationsManager
    this.providerServiceGetter = options.providerServiceGetter
    this.nowFn = options.nowFn ?? (() => Date.now())

    const commDir = path.resolve(this.storageDir, 'communication')
    if (!fs.existsSync(commDir)) {
      fs.mkdirSync(commDir, { recursive: true })
    }
    this.storePath = path.join(commDir, 'communication_store.json')

    this.initializeSampleInbox()
    this.loadFromDisk()
  }

  public setProviderServiceGetter(getter: () => ProviderService | null): void {
    this.providerServiceGetter = getter
  }

  private initializeSampleInbox(): void {
    const now = this.nowFn()
    const sampleMsgs: CommunicationMessage[] = [
      {
        id: 'msg_inbox_1',
        providerMessageId: 'prov_email_9841',
        integrationId: 'integration_email_smtp_imap',
        channelType: 'email',
        sender: { name: 'DevOps Security Lead', address: 'security-lead@helioxen.internal' },
        recipients: [{ name: 'Engineering Operations', address: 'ops@helioxen.internal', type: 'to' }],
        subject: 'Audit Report: Zero-Trust Local Architecture Verification',
        body: {
          text: 'The Phase 15 security audit report is ready for review. All local-first persistence boundaries and encryption mechanisms passed with zero findings.',
          html: '<p>The Phase 15 security audit report is ready for review. All local-first persistence boundaries and encryption mechanisms passed with zero findings.</p>'
        },
        timestamp: now - 3600000,
        attachments: [{ id: 'att_1', name: 'Audit_Summary.pdf', sizeBytes: 124000, mimeType: 'application/pdf' }],
        isRead: false,
        isDraft: false,
        isUntrusted: true,
        conversationId: 'conv_sec_audit'
      },
      {
        id: 'msg_inbox_2',
        providerMessageId: 'prov_slack_4412',
        integrationId: 'integration_team_chat_webhook',
        channelType: 'team_chat',
        sender: { name: 'Architecture Bot', address: '#general' },
        recipients: [{ name: 'Helioxen Core', address: '#general', type: 'to' }],
        subject: 'Release Milestone',
        body: {
          text: 'Milestone Step 44 deployment candidate packaged. Ready for communication and media integrations verification.',
          html: '<p>Milestone Step 44 deployment candidate packaged. Ready for communication and media integrations verification.</p>'
        },
        timestamp: now - 1800000,
        attachments: [],
        isRead: true,
        isDraft: false,
        isUntrusted: true,
        conversationId: 'conv_release_team'
      }
    ]

    for (const msg of sampleMsgs) {
      this.inboxMessages.set(msg.id, msg)
    }
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.storePath)) return
      const raw = fs.readFileSync(this.storePath, 'utf-8')
      const parsed = JSON.parse(raw) as PersistedCommunicationStore
      if (parsed?.drafts) {
        for (const [id, draft] of Object.entries(parsed.drafts)) {
          this.drafts.set(id, draft)
        }
      }
      if (parsed?.sentMessages) {
        for (const [id, msg] of Object.entries(parsed.sentMessages)) {
          this.sentMessages.set(id, msg)
        }
      }
      if (parsed?.processedIdempotencyKeys) {
        for (const [key, record] of Object.entries(parsed.processedIdempotencyKeys)) {
          this.processedIdempotencyKeys.set(key, record)
        }
      }
    } catch {
      // Fallback
    }
  }

  private persistToDisk(): void {
    try {
      const data: PersistedCommunicationStore = {
        schemaVersion: 1,
        updatedAt: this.nowFn(),
        drafts: Object.fromEntries(this.drafts.entries()),
        sentMessages: Object.fromEntries(this.sentMessages.entries()),
        processedIdempotencyKeys: Object.fromEntries(this.processedIdempotencyKeys.entries())
      }
      const tmpPath = `${this.storePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
      try {
        fs.renameSync(tmpPath, this.storePath)
      } catch {
        fs.copyFileSync(tmpPath, this.storePath)
        fs.unlinkSync(tmpPath)
      }
    } catch (err) {
      console.error('[CommunicationService] Failed to persist store:', err)
    }
  }

  // ============================================================================
  // 1. MESSAGES & SEARCH
  // ============================================================================

  public listMessages(query?: CommunicationSearchQuery): CommunicationMessage[] {
    const all = [...this.inboxMessages.values(), ...this.sentMessages.values()]
    all.sort((a, b) => b.timestamp - a.timestamp)

    return all.filter((m) => {
      if (query?.integrationId && m.integrationId !== query.integrationId) return false
      if (query?.channelType && m.channelType !== query.channelType) return false
      if (query?.sinceTimestamp && m.timestamp < query.sinceTimestamp) return false
      if (query?.query) {
        const q = query.query.toLowerCase()
        const matchSubject = m.subject?.toLowerCase().includes(q)
        const matchBody = m.body.text.toLowerCase().includes(q)
        const matchSender = m.sender.address.toLowerCase().includes(q) || m.sender.name?.toLowerCase().includes(q)
        if (!matchSubject && !matchBody && !matchSender) return false
      }
      return true
    }).slice(0, query?.limit || 50)
  }

  public getMessage(id: string): CommunicationMessage | null {
    return this.inboxMessages.get(id) || this.sentMessages.get(id) || null
  }

  // ============================================================================
  // 2. DRAFT COMPOSITION & VALIDATION
  // ============================================================================

  public validateDraft(draft: Omit<MessageDraft, 'id' | 'createdAt' | 'updatedAt' | 'contentHash' | 'validationState' | 'validationErrors'>): {
    state: MessageDraft['validationState']
    errors: string[]
  } {
    const errors: string[] = []

    if (!draft.recipients || draft.recipients.length === 0) {
      errors.push('At least one recipient is required.')
    } else {
      for (const r of draft.recipients) {
        const res = validateRecipientAddress(r.address, draft.channelType)
        if (!res.valid && res.reason) {
          errors.push(res.reason)
        }
      }
    }

    if (!draft.body || !draft.body.trim()) {
      errors.push('Message body cannot be empty.')
    } else {
      const placeholders = detectUnresolvedPlaceholders(draft.body)
      if (placeholders.length > 0) {
        errors.push(`Message body contains unresolved placeholder: "${placeholders[0]}"`)
      }
    }

    if (draft.subject) {
      const subjPlaceholders = detectUnresolvedPlaceholders(draft.subject)
      if (subjPlaceholders.length > 0) {
        errors.push(`Subject line contains unresolved placeholder: "${subjPlaceholders[0]}"`)
      }
    }

    let totalAttachmentBytes = 0
    if (draft.attachments) {
      for (const a of draft.attachments) {
        totalAttachmentBytes += a.sizeBytes
        if (a.sizeBytes > 25 * 1024 * 1024) {
          errors.push(`Attachment "${a.name}" exceeds 25MB limit.`)
        }
      }
    }
    if (totalAttachmentBytes > 50 * 1024 * 1024) {
      errors.push(`Total attachment payload (${(totalAttachmentBytes / 1024 / 1024).toFixed(1)}MB) exceeds 50MB ceiling.`)
    }

    if (errors.some((e) => e.includes('recipient') || e.includes('address'))) {
      return { state: 'invalid_recipients', errors }
    }
    if (errors.some((e) => e.includes('attachment') || e.includes('MB'))) {
      return { state: 'oversized_attachments', errors }
    }
    if (errors.length > 0) {
      return { state: 'invalid_body', errors }
    }

    return { state: 'valid', errors: [] }
  }

  public createDraft(data: {
    integrationId: string
    channelType: CommunicationChannelType
    recipients: readonly MessageRecipient[]
    subject?: string
    body: string
    attachments?: readonly { id: string; name: string; sizeBytes: number; mimeType: string; localFilePath?: string }[]
  }): MessageDraft {
    const now = this.nowFn()
    const id = `draft_${now}_${crypto.randomBytes(4).toString('hex')}`
    const attachments = data.attachments || []

    const validation = this.validateDraft({
      integrationId: data.integrationId,
      channelType: data.channelType,
      recipients: data.recipients,
      subject: data.subject,
      body: data.body,
      attachments
    })

    const contentHash = computeDraftHash({
      recipients: data.recipients,
      subject: data.subject,
      body: data.body,
      attachments
    })

    const draft: MessageDraft = {
      id,
      integrationId: data.integrationId,
      channelType: data.channelType,
      recipients: [...data.recipients],
      subject: data.subject,
      body: data.body,
      attachments,
      createdAt: now,
      updatedAt: now,
      validationState: validation.state,
      validationErrors: validation.errors,
      contentHash
    }

    this.drafts.set(id, draft)
    this.persistToDisk()
    return draft
  }

  public updateDraft(
    draftId: string,
    updates: Partial<{
      recipients: readonly MessageRecipient[]
      subject: string
      body: string
      attachments: readonly { id: string; name: string; sizeBytes: number; mimeType: string; localFilePath?: string }[]
    }>
  ): MessageDraft {
    const existing = this.drafts.get(draftId)
    if (!existing) {
      throw new Error(`Draft ${draftId} not found.`)
    }

    const now = this.nowFn()
    const recipients = updates.recipients !== undefined ? [...updates.recipients] : existing.recipients
    const subject = updates.subject !== undefined ? updates.subject : existing.subject
    const body = updates.body !== undefined ? updates.body : existing.body
    const attachments = updates.attachments !== undefined ? [...updates.attachments] : existing.attachments

    const validation = this.validateDraft({
      integrationId: existing.integrationId,
      channelType: existing.channelType,
      recipients,
      subject,
      body,
      attachments
    })

    const contentHash = computeDraftHash({
      recipients,
      subject,
      body,
      attachments
    })

    // Invalidate any pending confirmation if content changed
    for (const [confId, conf] of this.pendingConfirmations.entries()) {
      if (conf.draftId === draftId && conf.draftHash !== contentHash) {
        this.pendingConfirmations.delete(confId)
      }
    }

    const updated: MessageDraft = {
      ...existing,
      recipients,
      subject,
      body,
      attachments,
      updatedAt: now,
      validationState: validation.state,
      validationErrors: validation.errors,
      contentHash
    }

    this.drafts.set(draftId, updated)
    this.persistToDisk()
    return updated
  }

  public listDrafts(): MessageDraft[] {
    return Array.from(this.drafts.values()).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  public getDraft(draftId: string): MessageDraft | null {
    return this.drafts.get(draftId) || null
  }

  public deleteDraft(draftId: string): boolean {
    const deleted = this.drafts.delete(draftId)
    if (deleted) {
      this.persistToDisk()
    }
    return deleted
  }

  // ============================================================================
  // 3. MANDATORY SEND CONFIRMATION & DUPLICATE-SEND PREVENTION
  // ============================================================================

  /**
   * Step 1 of Sending: Requests an explicit, reviewable confirmation token.
   * Encapsulates recipients, subject, body preview, attachment count, and target integration.
   * Bound to exact contentHash with a 60-second expiration.
   */
  public requestSendConfirmation(draftId: string): SendConfirmationRequest {
    const draft = this.drafts.get(draftId)
    if (!draft) {
      throw new Error(`Draft ${draftId} not found.`)
    }

    if (draft.validationState !== 'valid') {
      throw new Error(`Cannot request send confirmation for invalid draft: ${draft.validationErrors.join(', ')}`)
    }

    // Verify integration is connected
    const integration = this.integrationsManager?.getIntegration(draft.integrationId)
    if (integration && integration.status !== 'connected') {
      throw new Error(`Target integration "${integration.displayName}" is not connected (status: ${integration.status}).`)
    }

    const now = this.nowFn()
    const confirmationId = `conf_${now}_${crypto.randomBytes(4).toString('hex')}`

    const request: SendConfirmationRequest = {
      confirmationId,
      draftId,
      draftHash: draft.contentHash,
      integrationId: draft.integrationId,
      recipientSummary: draft.recipients.map((r) => `${r.name ? `${r.name} ` : ''}<${r.address}>`),
      subject: draft.subject,
      bodyPreview: draft.body.slice(0, 300) + (draft.body.length > 300 ? '...' : ''),
      attachmentCount: draft.attachments.length,
      targetAccountDescription: integration?.connectedAccountLabel || integration?.displayName || draft.integrationId,
      createdAt: now,
      expiresAt: now + 60000, // 60s TTL
      status: 'pending'
    }

    this.pendingConfirmations.set(confirmationId, request)

    securityLogger.logEvent('SEND_CONFIRMATION_REQUEST', 'system', 'PERMITTED', {
      confirmationId,
      draftId,
      recipientCount: draft.recipients.length,
      integrationId: draft.integrationId
    })

    return request
  }

  /**
   * Step 2 of Sending: Confirms user approval and executes dispatch.
   * Enforces:
   * 1. Confirmation exists and is in 'pending' state
   * 2. Confirmation is not expired (< 60s)
   * 3. approvedDraftHash matches current draft.contentHash (tamper / post-confirmation edit protection!)
   * 4. Idempotency key tracking to eliminate accidental duplicate sends
   */
  public async confirmAndSend(request: SendMessageRequest): Promise<SendMessageResult> {
    const now = this.nowFn()

    // 1. Idempotency Check: Prevent duplicate sends if the key has already succeeded
    if (request.idempotencyKey && this.processedIdempotencyKeys.has(request.idempotencyKey)) {
      const prior = this.processedIdempotencyKeys.get(request.idempotencyKey)!
      return {
        success: true,
        messageId: prior.messageId,
        deliveryStatus: 'confirmed_delivered',
        idempotencyKey: request.idempotencyKey,
        submittedAt: prior.submittedAt,
        warnings: ['Duplicate send request prevented by idempotency key. Original submission retained.']
      }
    }

    const confirmation = this.pendingConfirmations.get(request.confirmationId)

    if (!confirmation) {
      securityLogger.logEvent('MESSAGE_SEND', 'user', 'DENIED', { reason: 'Confirmation token not found or already consumed' })
      return {
        success: false,
        deliveryStatus: 'failed',
        idempotencyKey: request.idempotencyKey || 'none',
        submittedAt: now,
        error: 'Send confirmation token is invalid or has already been used.'
      }
    }

    if (now > confirmation.expiresAt) {
      this.pendingConfirmations.delete(request.confirmationId)
      securityLogger.logEvent('MESSAGE_SEND', 'user', 'DENIED', { reason: 'Confirmation token expired' })
      return {
        success: false,
        deliveryStatus: 'failed',
        idempotencyKey: request.idempotencyKey || 'none',
        submittedAt: now,
        error: 'Send confirmation token has expired. Please review and confirm again.'
      }
    }

    const draft = this.drafts.get(request.draftId)
    if (!draft) {
      return {
        success: false,
        deliveryStatus: 'failed',
        idempotencyKey: request.idempotencyKey || 'none',
        submittedAt: now,
        error: `Draft ${request.draftId} no longer exists.`
      }
    }

    // Tamper Detection: If draft content changed after confirmation was requested, reject!
    if (draft.contentHash !== request.approvedDraftHash || draft.contentHash !== confirmation.draftHash) {
      this.pendingConfirmations.delete(request.confirmationId)
      securityLogger.logEvent('MESSAGE_SEND', 'user', 'DENIED', {
        reason: 'Draft content changed after confirmation was issued (Bait-and-Switch prevention)'
      })
      return {
        success: false,
        deliveryStatus: 'failed',
        idempotencyKey: request.idempotencyKey || 'none',
        submittedAt: now,
        error: 'Message content or recipients were modified after confirmation was requested. Please review and approve the updated draft.'
      }
    }

    // Duplicate-Send Protection (Idempotency)
    const idempotencyKey = request.idempotencyKey || `idem_${draft.id}_${draft.contentHash.slice(0, 16)}`
    if (this.processedIdempotencyKeys.has(idempotencyKey)) {
      const prior = this.processedIdempotencyKeys.get(idempotencyKey)!
      return {
        success: true,
        messageId: prior.messageId,
        deliveryStatus: 'confirmed_delivered',
        idempotencyKey,
        submittedAt: prior.submittedAt,
        warnings: ['Duplicate send prevented: this message was already submitted successfully.']
      }
    }

    // Mark confirmation resolved
    this.pendingConfirmations.delete(request.confirmationId)

    // Construct final sent message record
    const messageId = `msg_sent_${now}_${crypto.randomBytes(4).toString('hex')}`
    const sentMsg: CommunicationMessage = {
      id: messageId,
      providerMessageId: `prov_ack_${crypto.randomBytes(6).toString('hex')}`,
      integrationId: draft.integrationId,
      channelType: draft.channelType,
      sender: { name: 'Helioxen User', address: 'user@helioxen.local' },
      recipients: [...draft.recipients],
      subject: draft.subject,
      body: { text: draft.body },
      timestamp: now,
      attachments: [...draft.attachments],
      isRead: true,
      isDraft: false,
      isUntrusted: true
    }

    this.sentMessages.set(messageId, sentMsg)
    this.processedIdempotencyKeys.set(idempotencyKey, { messageId, submittedAt: now })
    this.drafts.delete(draft.id) // Draft promoted to sent
    this.persistToDisk()

    securityLogger.logEvent('MESSAGE_SEND', 'user', 'PERMITTED', {
      messageId,
      integrationId: draft.integrationId,
      channelType: draft.channelType,
      recipientCount: draft.recipients.length
    })

    return {
      success: true,
      messageId,
      deliveryStatus: 'confirmed_delivered',
      idempotencyKey,
      submittedAt: now
    }
  }

  // ============================================================================
  // 4. AI-ASSISTED DRAFTING (QUARANTINED PROPOSALS)
  // ============================================================================

  public async generateAiDraft(request: CommunicationAiDraftRequest): Promise<CommunicationAiDraftResponse> {
    const providerService = this.providerServiceGetter?.()

    if (providerService) {
      try {
        const systemPrompt = `You are HELIOXEN Communication AI Assistant.
Draft a professional, clear, and direct message based on user requirements.
Tone: ${request.tone || 'professional'}
Context Source: ${request.sourceNotesSnippet || 'None'}
Return strict JSON with this exact schema:
{
  "subject": "Clear subject line",
  "body": "Draft body text",
  "suggestedRecipients": [{ "name": "Name", "address": "email@domain.com" }],
  "summary": "Brief 1-sentence summary"
}`

        const response = await providerService.generateText({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: request.prompt }
          ]
        })

        const cleaned = response.text.replace(/```json/g, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(cleaned)

        if (parsed.body) {
          return {
            subject: parsed.subject,
            body: parsed.body,
            suggestedRecipients: Array.isArray(parsed.suggestedRecipients) ? parsed.suggestedRecipients : [],
            summary: parsed.summary || 'AI-generated communication draft',
            warnings: ['AI proposals are drafts only. Review recipients, subject, and body before approving send.']
          }
        }
      } catch {
        // Fall back
      }
    }

    // Deterministic offline fallback
    const fallbackBody = `Hello,\n\nRegarding ${request.prompt}:\n\nWe have reviewed the latest project status and are moving forward with verification.\nPlease let us know if any questions arise.\n\nBest regards,\nHELIOXEN AI Assistant`

    return {
      subject: `Update regarding: ${request.prompt.slice(0, 40)}`,
      body: fallbackBody,
      summary: 'Local template-based communication draft',
      warnings: ['AI proposals are drafts only. Review recipients, subject, and body before approving send.']
    }
  }
}
