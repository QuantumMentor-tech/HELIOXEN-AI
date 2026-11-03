/**
 * HELIOXEN AI — Step 32: Research Subsystem Types
 * Strict types for web search, page content extraction, browser screenshots,
 * source provenance, and citation verification.
 */

export interface ResearchSearchQuery {
  query: string
  maxResults?: number
  domainFilter?: string[]
  safeSearch?: boolean
}

export interface ResearchSearchResult {
  id: string
  providerId: string
  query: string
  title: string
  url: string
  snippet: string
  domain: string
  publishedDate?: string
  retrievalTimestamp: number
  rank: number
  isDuplicate?: boolean
}

export interface ResearchSearchResponse {
  query: string
  providerId: string
  results: ResearchSearchResult[]
  totalCount: number
  retrievalTimestamp: number
  warnings?: string[]
  isPartial?: boolean
}

export type ContentExtractionMode = 'article' | 'general'

export interface ResearchExtractionRequest {
  tabId?: string
  url?: string
  mode?: ContentExtractionMode
  maxChars?: number
  conversationId?: string
  taskId?: string
}

export interface ResearchExtractedHeading {
  level: number
  text: string
}

export interface ResearchExtractedLink {
  text: string
  url: string
}

export interface ResearchSourceRecord {
  id: string
  sourceUrl: string
  canonicalUrl?: string
  title: string
  domain: string
  extractedText: string
  headings: ResearchExtractedHeading[]
  links: ResearchExtractedLink[]
  author?: string
  publishedDate?: string
  retrievalTimestamp: number
  extractionTimestamp: number
  extractor: string
  status: 'completed' | 'partial' | 'failed' | 'empty'
  isTruncated: boolean
  charCount: number
  wordCount: number
  warnings: string[]
  screenshotId?: string
  searchResultId?: string
  includedInContext: boolean
}

export interface BrowserScreenshotRequest {
  tabId: string
  format?: 'png' | 'jpeg'
  quality?: number
  conversationId?: string
  taskId?: string
}

export interface BrowserScreenshotRecord {
  id: string
  tabId: string
  sessionId: string
  pageUrl: string
  pageTitle: string
  captureTimestamp: number
  width: number
  height: number
  mimeType: string
  sizeBytes: number
  dataUrl: string
  isDiscarded: boolean
  sourceId?: string
}

export interface ResearchCitation {
  id: string
  sourceId?: string
  sourceUrl?: string
  title?: string
  claimText?: string
  passage?: string
  isVerified: boolean
  resolvedSourceTitle?: string
  resolvedUrl?: string
  notes?: string
}

export interface ValidateCitationsRequest {
  conversationId: string
  citations: Array<{
    id?: string
    sourceId?: string
    sourceUrl?: string
    title?: string
    claimText?: string
    passage?: string
  }>
}

export interface ResearchCollection {
  conversationId: string
  activeTaskId?: string
  queries: string[]
  searchResults: ResearchSearchResult[]
  sources: ResearchSourceRecord[]
  screenshots: BrowserScreenshotRecord[]
  citations: ResearchCitation[]
  createdAt: number
  updatedAt: number
}

export interface ManageCollectionRequest {
  conversationId: string
  action: 'get' | 'clear' | 'include_source' | 'exclude_source' | 'discard_screenshot'
  sourceId?: string
  screenshotId?: string
}

