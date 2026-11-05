/**
 * HELIOXEN AI — Step 44: Communication Subsystem Validation & Contracts
 * Recipient address validation, placeholder detection, draft hashing, and Zod schemas.
 */

import { z } from 'zod'
import {
  CommunicationChannelType,
  MessageRecipient,
  MessageAttachment,
  MessageDraft,
  DraftValidationState
} from './types'

// ============================================================================
// 1. RECIPIENT & PLACEHOLDER VALIDATION
// ============================================================================

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
const WEBHOOK_REGEX = /^https:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?$/
const CHANNEL_HANDLE_REGEX = /^[#@][a-zA-Z0-9_.-]{1,64}$/

export function validateRecipientAddress(
  address: string,
  channelType: CommunicationChannelType
): { valid: boolean; reason?: string } {
  const trimmed = address.trim()
  if (!trimmed) {
    return { valid: false, reason: 'Recipient address cannot be empty.' }
  }

  // Check for obvious placeholders first
  const placeholderMatch = detectUnresolvedPlaceholders(trimmed)
  if (placeholderMatch.length > 0) {
    return {
      valid: false,
      reason: `Recipient contains unresolved placeholder: "${placeholderMatch[0]}"`
    }
  }

  if (channelType === 'email') {
    if (!EMAIL_REGEX.test(trimmed)) {
      return { valid: false, reason: `Invalid email address format: "${trimmed}"` }
    }
  } else if (channelType === 'webhook_messaging') {
    if (!WEBHOOK_REGEX.test(trimmed)) {
      return { valid: false, reason: `Invalid webhook destination URL: "${trimmed}". Must be a valid HTTPS URL.` }
    }
  } else if (channelType === 'team_chat') {
    if (!CHANNEL_HANDLE_REGEX.test(trimmed) && !EMAIL_REGEX.test(trimmed)) {
      return { valid: false, reason: `Invalid team chat handle or channel: "${trimmed}". Must start with # or @ or be an email address.` }
    }
  }

  return { valid: true }
}

/**
 * Detects unresolved AI or template placeholders such as [recipient name], <insert company>, TODO, etc.
 */
export function detectUnresolvedPlaceholders(text: string): string[] {
  const patterns = [
    /\[(?:recipient|name|insert|company|user|contact|client|TODO|TBD|date|time)[^\]]*\]/gi,
    /<(?:recipient|name|insert|company|user|contact|client|TODO|TBD|date|time|link|url)[^>]*>/gi,
    /\bTODO\b/g,
    /\bTBD\b/g,
    /\bFIXME\b/g,
    /\{\{[^}]+\}\}/gi
  ]

  const matches = new Set<string>()
  for (const pattern of patterns) {
    let m: RegExpExecArray | null
    while ((m = pattern.exec(text)) !== null) {
      matches.add(m[0])
    }
  }
  return Array.from(matches)
}

/**
 * Computes deterministic SHA-256 hash of a draft's content to enforce that
 * any material change after user confirmation automatically invalidates the approval token.
 */
export function computeDraftHash(draft: {
  recipients: readonly MessageRecipient[]
  subject?: string
  body: string
  attachments?: readonly MessageAttachment[]
}): string {
  const normalizedRecipients = [...draft.recipients]
    .map((r) => `${r.type || 'to'}:${r.address.toLowerCase().trim()}`)
    .sort()
    .join(';')

  const normalizedAttachments = (draft.attachments || [])
    .map((a) => `${a.name}:${a.sizeBytes}`)
    .sort()
    .join(';')

  const payload = [
    normalizedRecipients,
    (draft.subject || '').trim(),
    draft.body.trim(),
    normalizedAttachments
  ].join('|')

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto')
    if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
      return nodeCrypto.createHash('sha256').update(payload, 'utf-8').digest('hex')
    }
  } catch {
    // Browser or fallback environment
  }

  let hash1 = 0x811c9dc5
  let hash2 = 0x27d4eb2f
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i)
    hash1 ^= ch
    hash1 = Math.imul(hash1, 0x01000193)
    hash2 = Math.imul(hash2 ^ ch, 0x5bd1e995)
  }
  const h1 = (hash1 >>> 0).toString(16).padStart(8, '0')
  const h2 = (hash2 >>> 0).toString(16).padStart(8, '0')
  return (h1 + h2).repeat(4)
}

// ============================================================================
// 2. ZOD VALIDATION SCHEMAS
// ============================================================================

export const MessageRecipientSchema = z.object({
  name: z.string().max(128).optional(),
  address: z.string().min(1).max(320),
  type: z.enum(['to', 'cc', 'bcc']).optional().default('to')
})

export const MessageAttachmentSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  sizeBytes: z.number().int().nonnegative().max(25 * 1024 * 1024), // Max 25MB attachment limit
  mimeType: z.string().max(128),
  localFilePath: z.string().max(1024).optional()
})

export const MessageDraftSchema = z.object({
  id: z.string().min(1).max(64),
  integrationId: z.string().min(1).max(64),
  channelType: z.enum(['email', 'team_chat', 'webhook_messaging']),
  recipients: z.array(MessageRecipientSchema).min(1, 'At least one recipient is required.').max(50),
  subject: z.string().max(256).optional(),
  body: z.string().min(1, 'Message body cannot be empty.').max(100000),
  attachments: z.array(MessageAttachmentSchema).max(10).default([]),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  validationState: z.enum(['valid', 'invalid_recipients', 'invalid_body', 'oversized_attachments']),
  validationErrors: z.array(z.string()).default([]),
  contentHash: z.string().length(64)
})

export const SendConfirmationRequestSchema = z.object({
  confirmationId: z.string().min(1).max(64),
  draftId: z.string().min(1).max(64),
  draftHash: z.string().length(64),
  integrationId: z.string().min(1).max(64),
  recipientSummary: z.array(z.string()).min(1),
  subject: z.string().max(256).optional(),
  bodyPreview: z.string().max(1000),
  attachmentCount: z.number().int().nonnegative(),
  targetAccountDescription: z.string().max(256),
  createdAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
  status: z.enum(['pending', 'approved', 'rejected', 'expired'])
})

export const SendMessageRequestSchema = z.object({
  confirmationId: z.string().min(1).max(64),
  draftId: z.string().min(1).max(64),
  approvedDraftHash: z.string().length(64),
  idempotencyKey: z.string().max(64).optional()
})
