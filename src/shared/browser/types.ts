/**
 * HELIOXEN AI — Step 31: Browser Service, Sessions & Tab Management Types
 * Typed data contracts for browser session isolation, tab lifecycle, and navigation states.
 */

export interface BrowserSessionConfig {
  sessionId?: string
  persist?: boolean
  userAgent?: string
}

export interface BrowserSessionMetadata {
  sessionId: string
  isPersistent: boolean
  partition: string
  activeTabId?: string
  tabCount: number
  createdAt: number
}

export type TabLoadingStatus =
  | 'empty'
  | 'loading'
  | 'loaded'
  | 'failed'
  | 'crashed'
  | 'closed'

export interface BrowserTabState {
  tabId: string
  sessionId: string
  url: string
  title: string
  loading: boolean
  status: TabLoadingStatus
  canGoBack: boolean
  canGoForward: boolean
  error?: string
  createdAt: number
  updatedAt: number
}

export interface CreateSessionRequest {
  sessionId?: string
  persist?: boolean
}

export interface CreateTabRequest {
  sessionId?: string
  url?: string
  activate?: boolean
}

export interface NavigateTabRequest {
  tabId: string
  url: string
}

export interface SwitchTabRequest {
  tabId: string
}

export interface CloseTabRequest {
  tabId: string
}

export interface TabActionRequest {
  tabId: string
}

export interface ClearSessionDataRequest {
  sessionId: string
  storages?: Array<'cookies' | 'cache' | 'localstorage'>
}

export interface BrowserViewBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface SetBrowserViewBoundsRequest {
  bounds: BrowserViewBounds
}

export interface BrowserOperationResult {
  success: boolean
  message?: string
  tabId?: string
  sessionId?: string
  tabState?: BrowserTabState
  sessionMetadata?: BrowserSessionMetadata
}

// --- Step 33: Browser Agent Automation, Forms & Downloads Types ---

export type InteractiveElementRole =
  | 'button'
  | 'link'
  | 'input'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'tab'
  | 'menuitem'

export interface InteractiveElementLocator {
  role?: InteractiveElementRole
  name?: string
  label?: string
  id?: string
  nameAttr?: string
  selector?: string
}

export interface PageInteractiveElement {
  elementId: string
  role: InteractiveElementRole
  tagName: string
  name: string
  label?: string
  type?: string
  value?: string
  checked?: boolean
  disabled: boolean
  visible: boolean
  isSensitive: boolean
  locator: InteractiveElementLocator
}

export interface PageFormField {
  fieldId: string
  role: string
  type: string
  label: string
  name: string
  currentValue?: string
  isSensitive: boolean
  required: boolean
}

export interface PageFormSummary {
  formId: string
  action?: string
  method?: string
  fields: PageFormField[]
  submitButtonName?: string
}

export interface PageInspectionSnapshot {
  snapshotId: string
  tabId: string
  url: string
  origin: string
  title: string
  timestamp: number
  elements: PageInteractiveElement[]
  forms: PageFormSummary[]
  isTruncated: boolean
}

export interface InspectPageRequest {
  tabId: string
  maxElements?: number
}

export interface ClickElementRequest {
  tabId: string
  target: InteractiveElementLocator
  expectedUrl?: string
  confirmationToken?: string
}

export interface ScrollPageRequest {
  tabId: string
  direction: 'up' | 'down' | 'top' | 'bottom'
  distance?: number
}

export interface FillFieldRequest {
  tabId: string
  target: InteractiveElementLocator
  value: string
  clearFirst?: boolean
}

export interface SelectOptionRequest {
  tabId: string
  target: InteractiveElementLocator
  optionValue: string
}

export interface ReviewFormRequest {
  tabId: string
  formId?: string
  proposedValues?: Record<string, string>
}

export interface FormReviewSummary {
  reviewId: string
  tabId: string
  formId: string
  destinationOrigin: string
  actionUrl: string
  fieldsToSubmit: Record<string, string>
  isConsequential: boolean
  consequenceDescription: string
  confirmationToken: string
  expiresAt: number
}

export interface SubmitFormRequest {
  tabId: string
  formId?: string
  confirmationToken: string
}

export interface BrowserActionResult {
  success: boolean
  action: string
  tabId: string
  resultingUrl: string
  targetFound: boolean
  message?: string
  error?: string
  requiresConfirmation?: boolean
  confirmationReview?: FormReviewSummary
}

export type DownloadItemStatus =
  | 'pending'
  | 'progressing'
  | 'completed'
  | 'cancelled'
  | 'interrupted'
  | 'blocked'

export interface DownloadRequestReview {
  downloadId: string
  tabId: string
  sessionId: string
  sourceUrl: string
  origin: string
  suggestedFilename: string
  mimeType?: string
  totalBytes?: number
  isDangerousType: boolean
  riskReason?: string
  requiresApproval: boolean
  confirmationToken?: string
}

export interface ApproveDownloadRequest {
  downloadId: string
  savePath: string
  confirmationToken: string
}

export interface CancelDownloadRequest {
  downloadId: string
}

export interface DownloadStateRecord {
  downloadId: string
  tabId: string
  sessionId: string
  url: string
  filename: string
  savePath?: string
  receivedBytes: number
  totalBytes: number
  status: DownloadItemStatus
  error?: string
  isDangerousType: boolean
  createdAt: number
  updatedAt: number
}

