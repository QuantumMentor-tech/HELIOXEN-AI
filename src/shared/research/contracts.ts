/**
 * HELIOXEN AI — Step 32: Research Contracts & Zod Schemas
 * Strict validation for web search queries, content extraction, screenshots,
 * collections, and citations.
 */

import { z } from 'zod'
import { ValidBrowserUrlSchema } from '../browser/contracts'

export const ResearchSearchQuerySchema = z
  .object({
    query: z.string().min(1, 'Query cannot be empty').max(500, 'Query exceeds 500 characters'),
    maxResults: z.number().int().min(1).max(20).default(5).optional(),
    domainFilter: z.array(z.string().min(1).max(100)).max(10).optional(),
    safeSearch: z.boolean().default(true).optional()
  })
  .strict()

export const ResearchSearchResultSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  query: z.string(),
  title: z.string(),
  url: ValidBrowserUrlSchema,
  snippet: z.string(),
  domain: z.string(),
  publishedDate: z.string().optional(),
  retrievalTimestamp: z.number().int().positive(),
  rank: z.number().int().min(1),
  isDuplicate: z.boolean().optional()
})

export const ResearchSearchResponseSchema = z.object({
  query: z.string(),
  providerId: z.string(),
  results: z.array(ResearchSearchResultSchema),
  totalCount: z.number().int().min(0),
  retrievalTimestamp: z.number().int().positive(),
  warnings: z.array(z.string()).optional(),
  isPartial: z.boolean().optional()
})

export const ContentExtractionModeSchema = z.enum(['article', 'general'])

export const ResearchExtractionRequestSchema = z
  .object({
    tabId: z.string().min(1).max(64).optional(),
    url: ValidBrowserUrlSchema.optional(),
    mode: ContentExtractionModeSchema.default('article').optional(),
    maxChars: z.number().int().min(100).max(100000).default(50000).optional(),
    conversationId: z.string().min(1).max(64).optional(),
    taskId: z.string().min(1).max(64).optional()
  })
  .strict()
  .refine(
    (data) => Boolean(data.tabId || data.url),
    { message: 'Either tabId or valid URL must be provided for content extraction' }
  )

export const ResearchExtractedHeadingSchema = z.object({
  level: z.number().int().min(1).max(6),
  text: z.string()
})

export const ResearchExtractedLinkSchema = z.object({
  text: z.string(),
  url: z.string()
})

export const ResearchSourceRecordSchema = z.object({
  id: z.string(),
  sourceUrl: z.string(),
  canonicalUrl: z.string().optional(),
  title: z.string(),
  domain: z.string(),
  extractedText: z.string(),
  headings: z.array(ResearchExtractedHeadingSchema),
  links: z.array(ResearchExtractedLinkSchema),
  author: z.string().optional(),
  publishedDate: z.string().optional(),
  retrievalTimestamp: z.number().int().positive(),
  extractionTimestamp: z.number().int().positive(),
  extractor: z.string(),
  status: z.enum(['completed', 'partial', 'failed', 'empty']),
  isTruncated: z.boolean(),
  charCount: z.number().int().min(0),
  wordCount: z.number().int().min(0),
  warnings: z.array(z.string()),
  screenshotId: z.string().optional(),
  searchResultId: z.string().optional(),
  includedInContext: z.boolean()
})

export const BrowserScreenshotRequestSchema = z
  .object({
    tabId: z.string().min(1).max(64),
    format: z.enum(['png', 'jpeg']).default('jpeg').optional(),
    quality: z.number().int().min(1).max(100).default(85).optional(),
    conversationId: z.string().min(1).max(64).optional(),
    taskId: z.string().min(1).max(64).optional()
  })
  .strict()

export const BrowserScreenshotRecordSchema = z.object({
  id: z.string(),
  tabId: z.string(),
  sessionId: z.string(),
  pageUrl: z.string(),
  pageTitle: z.string(),
  captureTimestamp: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
  dataUrl: z.string(),
  isDiscarded: z.boolean(),
  sourceId: z.string().optional()
})

export const ResearchCitationSchema = z.object({
  id: z.string(),
  sourceId: z.string().optional(),
  sourceUrl: z.string().optional(),
  title: z.string().optional(),
  claimText: z.string().optional(),
  passage: z.string().optional(),
  isVerified: z.boolean(),
  resolvedSourceTitle: z.string().optional(),
  resolvedUrl: z.string().optional(),
  notes: z.string().optional()
})

export const ValidateCitationsRequestSchema = z
  .object({
    conversationId: z.string().min(1).max(64),
    citations: z.array(
      z
        .object({
          id: z.string().optional(),
          sourceId: z.string().optional(),
          sourceUrl: z.string().optional(),
          title: z.string().optional(),
          claimText: z.string().optional(),
          passage: z.string().optional()
        })
        .strict()
    )
  })
  .strict()

export const ManageCollectionRequestSchema = z
  .object({
    conversationId: z.string().min(1).max(64),
    action: z.enum(['get', 'clear', 'include_source', 'exclude_source', 'discard_screenshot']),
    sourceId: z.string().optional(),
    screenshotId: z.string().optional()
  })
  .strict()

export const ResearchCollectionSchema = z.object({
  conversationId: z.string(),
  activeTaskId: z.string().optional(),
  queries: z.array(z.string()),
  searchResults: z.array(ResearchSearchResultSchema),
  sources: z.array(ResearchSourceRecordSchema),
  screenshots: z.array(BrowserScreenshotRecordSchema),
  citations: z.array(ResearchCitationSchema),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive()
})

