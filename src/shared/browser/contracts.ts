/**
 * HELIOXEN AI — Step 31: Browser Service Contracts & Zod Schemas
 * Strict validation for browser sessions, tab management, and URL navigation.
 */

import { z } from 'zod'

// Strict HTTP/HTTPS URL Regex
const HTTP_HTTPS_URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i

export const ValidBrowserUrlSchema = z
  .string()
  .min(8, 'URL is too short')
  .max(2048, 'URL exceeds 2048 character limit')
  .refine(
    (val) => {
      try {
        const parsed = new URL(val)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return false
        }
        // Reject credentials in URL
        if (parsed.username || parsed.password) {
          return false
        }
        return true
      } catch {
        return false
      }
    },
    { message: 'Only valid HTTP and HTTPS URLs without embedded credentials are permitted' }
  )

export const BrowserSessionConfigSchema = z
  .object({
    sessionId: z.string().min(1).max(64),
    persist: z.boolean().default(false).optional(),
    userAgent: z.string().max(256).optional()
  })
  .strict()

export const BrowserSessionMetadataSchema = z.object({
  sessionId: z.string(),
  isPersistent: z.boolean(),
  partition: z.string(),
  activeTabId: z.string().optional(),
  tabCount: z.number().int().min(0),
  createdAt: z.number().int().positive()
})

export const TabLoadingStatusSchema = z.enum([
  'empty',
  'loading',
  'loaded',
  'failed',
  'crashed',
  'closed'
])

export const BrowserTabStateSchema = z.object({
  tabId: z.string(),
  sessionId: z.string(),
  url: z.string(),
  title: z.string(),
  loading: z.boolean(),
  status: TabLoadingStatusSchema,
  canGoBack: z.boolean(),
  canGoForward: z.boolean(),
  error: z.string().optional(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive()
})

export const CreateSessionRequestSchema = z
  .object({
    sessionId: z.string().min(1).max(64).optional(),
    persist: z.boolean().default(false).optional()
  })
  .strict()

export const CreateTabRequestSchema = z
  .object({
    sessionId: z.string().min(1).max(64).optional(),
    url: ValidBrowserUrlSchema.optional(),
    activate: z.boolean().default(true).optional()
  })
  .strict()

export const NavigateTabRequestSchema = z
  .object({
    tabId: z.string().min(1).max(64),
    url: ValidBrowserUrlSchema
  })
  .strict()

export const SwitchTabRequestSchema = z
  .object({
    tabId: z.string().min(1).max(64)
  })
  .strict()

export const CloseTabRequestSchema = z
  .object({
    tabId: z.string().min(1).max(64)
  })
  .strict()

export const TabActionRequestSchema = z
  .object({
    tabId: z.string().min(1).max(64)
  })
  .strict()

export const ClearSessionDataRequestSchema = z
  .object({
    sessionId: z.string().min(1).max(64),
    storages: z.array(z.enum(['cookies', 'cache', 'localstorage'])).optional()
  })
  .strict()

export const BrowserViewBoundsSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(0),
  height: z.number().int().min(0)
})

export const SetBrowserViewBoundsRequestSchema = z
  .object({
    bounds: BrowserViewBoundsSchema
  })
  .strict()

export const BrowserOperationResultSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  tabId: z.string().optional(),
  sessionId: z.string().optional(),
  tabState: BrowserTabStateSchema.optional(),
  sessionMetadata: BrowserSessionMetadataSchema.optional()
})

// --- Step 33: Browser Agent Automation, Forms & Downloads Schemas ---

export const InteractiveElementRoleSchema = z.enum([
  'button',
  'link',
  'input',
  'textarea',
  'select',
  'checkbox',
  'radio',
  'tab',
  'menuitem'
])

export const InteractiveElementLocatorSchema = z
  .object({
    role: InteractiveElementRoleSchema.optional(),
    name: z.string().min(1).max(200).optional(),
    label: z.string().min(1).max(200).optional(),
    id: z.string().min(1).max(100).optional(),
    nameAttr: z.string().min(1).max(100).optional(),
    selector: z.string().min(1).max(500).optional()
  })
  .strict()
  .refine(
    (loc) => Boolean(loc.name || loc.label || loc.id || loc.nameAttr || loc.selector),
    { message: 'Locator must specify at least one identifying property (name, label, id, nameAttr, or selector)' }
  )

export const PageInteractiveElementSchema = z.object({
  elementId: z.string(),
  role: InteractiveElementRoleSchema,
  tagName: z.string(),
  name: z.string(),
  label: z.string().optional(),
  type: z.string().optional(),
  value: z.string().optional(),
  checked: z.boolean().optional(),
  disabled: z.boolean(),
  visible: z.boolean(),
  isSensitive: z.boolean(),
  locator: InteractiveElementLocatorSchema
})

export const PageFormFieldSchema = z.object({
  fieldId: z.string(),
  role: z.string(),
  type: z.string(),
  label: z.string(),
  name: z.string(),
  currentValue: z.string().optional(),
  isSensitive: z.boolean(),
  required: z.boolean()
})

export const PageFormSummarySchema = z.object({
  formId: z.string(),
  action: z.string().optional(),
  method: z.string().optional(),
  fields: z.array(PageFormFieldSchema),
  submitButtonName: z.string().optional()
})

export const PageInspectionSnapshotSchema = z.object({
  snapshotId: z.string(),
  tabId: z.string(),
  url: z.string(),
  origin: z.string(),
  title: z.string(),
  timestamp: z.number().int().positive(),
  elements: z.array(PageInteractiveElementSchema),
  forms: z.array(PageFormSummarySchema),
  isTruncated: z.boolean()
})

export const InspectPageRequestSchema = z
  .object({
    tabId: z.string().min(1).max(64),
    maxElements: z.number().int().min(1).max(200).default(60).optional()
  })
  .strict()

export const ClickElementRequestSchema = z
  .object({
    tabId: z.string().min(1).max(64),
    target: InteractiveElementLocatorSchema,
    expectedUrl: ValidBrowserUrlSchema.optional(),
    confirmationToken: z.string().optional()
  })
  .strict()

export const ScrollPageRequestSchema = z
  .object({
    tabId: z.string().min(1).max(64),
    direction: z.enum(['up', 'down', 'top', 'bottom']),
    distance: z.number().int().min(10).max(5000).default(500).optional()
  })
  .strict()

export const FillFieldRequestSchema = z
  .object({
    tabId: z.string().min(1).max(64),
    target: InteractiveElementLocatorSchema,
    value: z.string().max(5000, 'Input value exceeds maximum length of 5000 characters'),
    clearFirst: z.boolean().default(true).optional()
  })
  .strict()

export const SelectOptionRequestSchema = z
  .object({
    tabId: z.string().min(1).max(64),
    target: InteractiveElementLocatorSchema,
    optionValue: z.string().min(1).max(200)
  })
  .strict()

export const ReviewFormRequestSchema = z
  .object({
    tabId: z.string().min(1).max(64),
    formId: z.string().optional(),
    proposedValues: z.record(z.string(), z.string()).optional()
  })
  .strict()

export const FormReviewSummarySchema = z.object({
  reviewId: z.string(),
  tabId: z.string(),
  formId: z.string(),
  destinationOrigin: z.string(),
  actionUrl: z.string(),
  fieldsToSubmit: z.record(z.string(), z.string()),
  isConsequential: z.boolean(),
  consequenceDescription: z.string(),
  confirmationToken: z.string(),
  expiresAt: z.number().int().positive()
})

export const SubmitFormRequestSchema = z
  .object({
    tabId: z.string().min(1).max(64),
    formId: z.string().optional(),
    confirmationToken: z.string().min(16, 'Valid confirmation token is required for form submission')
  })
  .strict()

export const BrowserActionResultSchema = z.object({
  success: z.boolean(),
  action: z.string(),
  tabId: z.string(),
  resultingUrl: z.string(),
  targetFound: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  requiresConfirmation: z.boolean().optional(),
  confirmationReview: FormReviewSummarySchema.optional()
})

export const DownloadItemStatusSchema = z.enum([
  'pending',
  'progressing',
  'completed',
  'cancelled',
  'interrupted',
  'blocked'
])

export const DownloadRequestReviewSchema = z.object({
  downloadId: z.string(),
  tabId: z.string(),
  sessionId: z.string(),
  sourceUrl: z.string(),
  origin: z.string(),
  suggestedFilename: z.string(),
  mimeType: z.string().optional(),
  totalBytes: z.number().int().optional(),
  isDangerousType: z.boolean(),
  riskReason: z.string().optional(),
  requiresApproval: z.boolean(),
  confirmationToken: z.string().optional()
})

export const ApproveDownloadRequestSchema = z
  .object({
    downloadId: z.string().min(1).max(64),
    savePath: z.string().min(1).max(1024),
    confirmationToken: z.string().min(16)
  })
  .strict()

export const CancelDownloadRequestSchema = z
  .object({
    downloadId: z.string().min(1).max(64)
  })
  .strict()

export const DownloadStateRecordSchema = z.object({
  downloadId: z.string(),
  tabId: z.string(),
  sessionId: z.string(),
  url: z.string(),
  filename: z.string(),
  savePath: z.string().optional(),
  receivedBytes: z.number().int().min(0),
  totalBytes: z.number().int().min(0),
  status: DownloadItemStatusSchema,
  error: z.string().optional(),
  isDangerousType: z.boolean(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive()
})


