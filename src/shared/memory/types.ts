/**
 * HELIOXEN AI — Step 34: User Profile, Long-Term Memory, and Consent-Based Personalization
 * Authoritative type contracts for user profiles, memory records, consent settings,
 * suggestions, and bounded relevance retrieval.
 */

export const MEMORY_SCHEMA_VERSION = 1

export type MemoryCategory =
  | 'preferences'
  | 'projects'
  | 'workflows'
  | 'reference_facts'
  | 'personalization_settings'

export type MemorySourceType =
  | 'explicit_user_request'
  | 'approved_suggestion'
  | 'user_profile_edit'
  | 'user_correction'

export type MemoryStatus =
  | 'active'
  | 'superseded'
  | 'expired'
  | 'pending_deletion'

export type MemorySensitivity =
  | 'low'
  | 'standard'
  | 'restricted'

export type MemoryConsentBasis =
  | 'explicit_user_opt_in'
  | 'explicit_save_command'
  | 'approved_suggestion_prompt'
  | 'direct_profile_edit'

export type ResponseTonePreference =
  | 'concise'
  | 'balanced'
  | 'detailed'
  | 'technical'

export type FormattingPreference =
  | 'markdown'
  | 'bullet_points'
  | 'prose'
  | 'code_first'

export interface PersonalizationPreferences {
  responseTone: ResponseTonePreference
  preferredFormatting: FormattingPreference
  primaryLanguages: string[]
  customWorkingConventions: string
}

export const DEFAULT_PERSONALIZATION_PREFERENCES: PersonalizationPreferences = {
  responseTone: 'balanced',
  preferredFormatting: 'markdown',
  primaryLanguages: [],
  customWorkingConventions: ''
}

export interface MemoryConsentSettings {
  /** Master opt-in switch. Defaults strictly to false until explicit user consent. */
  memoryEnabled: boolean
  /** Whether active memories may be attached to external cloud AI provider requests. */
  allowMemoryInCloudRequests: boolean
  /** Whether HELIOXEN may propose transient memory save suggestions during conversations. */
  allowMemorySuggestions: boolean
  /** Timestamp when user explicitly granted consent (null if never enabled). */
  consentedAt: number | null
  /** Timestamp when user last revoked/disabled memory consent. */
  revokedAt: number | null
  /** Schema/policy version of the consent agreement. */
  consentVersion: number
}

export const DEFAULT_MEMORY_CONSENT_SETTINGS: MemoryConsentSettings = {
  memoryEnabled: false,
  allowMemoryInCloudRequests: true,
  allowMemorySuggestions: true,
  consentedAt: null,
  revokedAt: null,
  consentVersion: 1
}

export interface UserProfile {
  profileId: string
  displayName: string
  personalization: PersonalizationPreferences
  consent: MemoryConsentSettings
  schemaVersion: number
  createdAt: number
  updatedAt: number
}

export const DEFAULT_PROFILE_ID = 'default-profile'

export interface MemoryRecord {
  id: string
  profileId: string
  content: string
  category: MemoryCategory
  sourceType: MemorySourceType
  sourceReference?: string
  projectScope?: string
  createdAt: number
  updatedAt: number
  status: MemoryStatus
  supersededById?: string
  sensitivity: MemorySensitivity
  consentBasis: MemoryConsentBasis
  lastUsedAt?: number
  expiresAt?: number
  confidence?: number
  schemaVersion: number
  encryptedAtRest: boolean
}

export type MemorySuggestionStatus =
  | 'pending'
  | 'approved'
  | 'dismissed'

export interface MemorySuggestion {
  id: string
  profileId: string
  proposedContent: string
  category: MemoryCategory
  reason: string
  sourceReference?: string
  projectScope?: string
  createdAt: number
  status: MemorySuggestionStatus
}

export interface MemoryLimits {
  maxMemoryContentChars: number
  maxSourceReferenceChars: number
  maxProjectScopeChars: number
  maxMemoriesPerProfile: number
  maxRetrievedMemories: number
  maxTotalInjectedChars: number
  retrievalTimeoutMs: number
}

export const DEFAULT_MEMORY_LIMITS: MemoryLimits = {
  maxMemoryContentChars: 2000,
  maxSourceReferenceChars: 200,
  maxProjectScopeChars: 120,
  maxMemoriesPerProfile: 500,
  maxRetrievedMemories: 5,
  maxTotalInjectedChars: 4000,
  retrievalTimeoutMs: 500
}

export interface CreateMemoryRequest {
  profileId?: string
  content: string
  category: MemoryCategory
  sourceType: MemorySourceType
  sourceReference?: string
  projectScope?: string
  sensitivity?: MemorySensitivity
  consentBasis?: MemoryConsentBasis
  expiresAt?: number
  confidence?: number
  supersedesId?: string
}

export interface CreateMemoryResult {
  success: boolean
  record?: MemoryRecord
  supersededRecordIds: string[]
  deduplicated: boolean
  message: string
}

export interface UpdateMemoryRequest {
  id: string
  profileId?: string
  content: string
  category?: MemoryCategory
  projectScope?: string
  expiresAt?: number | null
}

export interface UpdateMemoryResult {
  success: boolean
  record: MemoryRecord
  message: string
}

export interface DeleteMemoryRequest {
  id: string
  profileId?: string
}

export interface DeleteMemoryResult {
  success: boolean
  deletedId: string
  message: string
}

export interface ClearMemoriesRequest {
  profileId?: string
  confirmClearAll: boolean
  resetPersonalization?: boolean
  consentRequestId?: string
}

export interface ClearMemoriesResult {
  success: boolean
  deletedCount: number
  personalizationReset: boolean
  message: string
}

export interface ListMemoriesRequest {
  profileId?: string
  category?: MemoryCategory
  status?: MemoryStatus | 'all'
  projectScope?: string
  searchQuery?: string
  includeExpired?: boolean
  limit?: number
}

export interface MemoryConsentUpdateRequest {
  profileId?: string
  memoryEnabled: boolean
  allowMemoryInCloudRequests?: boolean
  allowMemorySuggestions?: boolean
}

export interface UserProfileUpdateRequest {
  profileId?: string
  displayName?: string
  personalization?: Partial<PersonalizationPreferences>
  resetToDefaults?: boolean
}

export interface ProposeMemorySuggestionRequest {
  profileId?: string
  proposedContent: string
  category: MemoryCategory
  reason: string
  sourceReference?: string
  projectScope?: string
}

export interface ResolveMemorySuggestionRequest {
  suggestionId: string
  action: 'approve' | 'dismiss'
  editedContent?: string
  editedCategory?: MemoryCategory
  profileId?: string
}

export interface ResolveMemorySuggestionResult {
  success: boolean
  suggestion: MemorySuggestion
  savedRecord?: MemoryRecord
  message: string
}

export interface MemoryRetrievalRequest {
  profileId?: string
  query: string
  categories?: MemoryCategory[]
  projectScope?: string
  maxResults?: number
  maxTotalChars?: number
  targetProvider?: string
  isExternalCloudProvider?: boolean
  currentUserInstruction?: string
}

export interface RetrievedMemoryItem {
  id: string
  category: MemoryCategory
  content: string
  sourceType: MemorySourceType
  projectScope?: string
  updatedAt: number
  relevanceScore: number
  matchReasons: string[]
}

export interface MemoryRetrievalResult {
  profileId: string
  memoryEnabled: boolean
  allowedForProvider: boolean
  blockedReason?: string
  memories: RetrievedMemoryItem[]
  omittedCount: number
  totalChars: number
  formattedContextBlock: string
  personalizationSummary?: string
}

export interface MemoryStateOverview {
  profile: UserProfile
  activeMemoryCount: number
  supersededMemoryCount: number
  expiredMemoryCount: number
  pendingSuggestions: MemorySuggestion[]
  encryptionAvailable: boolean
  storageHealthy: boolean
  lastError?: string
}

