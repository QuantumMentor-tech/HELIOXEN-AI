/**
 * HELIOXEN AI — Step 44: Communication & Messaging Subsystem Types
 * Unified contracts for emails, team chats, webhooks, drafts, and user-confirmed sending.
 */

export type CommunicationChannelType = 'email' | 'team_chat' | 'webhook_messaging'

export interface MessageRecipient {
  readonly name?: string
  readonly address: string // email address (user@domain.com) or channel handle (#general, @user)
  readonly type?: 'to' | 'cc' | 'bcc'
}

export interface MessageAttachment {
  readonly id: string
  readonly name: string
  readonly sizeBytes: number
  readonly mimeType: string
  readonly localFilePath?: string
}

export interface CommunicationMessage {
  readonly id: string
  readonly providerMessageId: string
  readonly integrationId: string
  readonly channelType: CommunicationChannelType
  readonly sender: MessageRecipient
  readonly recipients: readonly MessageRecipient[]
  readonly subject?: string
  readonly body: {
    readonly text: string
    readonly html?: string
  }
  readonly timestamp: number
  readonly attachments: readonly MessageAttachment[]
  readonly isRead: boolean
  readonly isDraft: boolean
  /** Untrusted data marker: Inbound messages are untrusted data and cannot grant permissions or trigger tools autonomously */
  readonly isUntrusted: true
  readonly conversationId?: string
}

export interface CommunicationConversation {
  readonly id: string
  readonly integrationId: string
  readonly channelType: CommunicationChannelType
  readonly title: string
  readonly participants: readonly MessageRecipient[]
  readonly lastMessageAt: number
  readonly messageCount: number
  readonly unreadCount: number
}

export type DraftValidationState =
  | 'valid'
  | 'invalid_recipients'
  | 'invalid_body'
  | 'oversized_attachments'

export interface MessageDraft {
  readonly id: string
  readonly integrationId: string
  readonly channelType: CommunicationChannelType
  readonly recipients: readonly MessageRecipient[]
  readonly subject?: string
  readonly body: string
  readonly attachments: readonly MessageAttachment[]
  readonly createdAt: number
  readonly updatedAt: number
  readonly validationState: DraftValidationState
  readonly validationErrors: readonly string[]
  readonly contentHash: string // SHA-256 hash of recipients, subject, body, and attachments for tamper detection
}

export interface SendConfirmationRequest {
  readonly confirmationId: string
  readonly draftId: string
  readonly draftHash: string
  readonly integrationId: string
  readonly recipientSummary: readonly string[]
  readonly subject?: string
  readonly bodyPreview: string
  readonly attachmentCount: number
  readonly targetAccountDescription: string
  readonly createdAt: number
  readonly expiresAt: number
  readonly status: 'pending' | 'approved' | 'rejected' | 'expired'
}

export type DeliveryStatus =
  | 'submitted'
  | 'confirmed_delivered'
  | 'failed'
  | 'outcome_unknown'

export interface SendMessageRequest {
  readonly confirmationId: string
  readonly draftId: string
  readonly approvedDraftHash: string
  readonly idempotencyKey?: string
}

export interface SendMessageResult {
  readonly success: boolean
  readonly messageId?: string
  readonly deliveryStatus: DeliveryStatus
  readonly idempotencyKey: string
  readonly submittedAt: number
  readonly error?: string
  readonly warnings?: readonly string[]
}

export interface CommunicationSearchQuery {
  readonly query?: string
  readonly integrationId?: string
  readonly channelType?: CommunicationChannelType
  readonly limit?: number
  readonly sinceTimestamp?: number
}

export interface CommunicationAiDraftRequest {
  readonly prompt: string
  readonly instruction?: string
  readonly contextMessageId?: string
  readonly sourceNotesSnippet?: string
  readonly tone?: 'formal' | 'concise' | 'friendly' | 'executive'
}

export interface CommunicationAiDraftResponse {
  readonly subject?: string
  readonly body: string
  readonly suggestedRecipients?: readonly MessageRecipient[]
  readonly summary: string
  readonly warnings?: readonly string[]
}

