/**
 * HELIOXEN AI — Main Process Orchestration Services
 * Authoritative TaskPlanner, ToolDispatcher, and TaskExecutionEngine wired to main security authorizer.
 */

import { authorizer } from '../security'
import { mainToolRegistry } from '../tools'
import {
  ToolDispatcher,
  TaskExecutionEngine,
  TaskPlanner
} from '../../shared/orchestration'
import { DocumentExtractionService } from '../documents'
import {
  systemTelemetryManager,
  installedAppDiscoveryManager,
  windowDiscoveryManager
} from '../telemetry'
import {
  fileOperationsManager,
  fileOrganizationManager,
  clipboardManager
} from '../filesystem'
import {
  desktopInteractionManager,
  systemOperationManager
} from '../interaction'
import {
  browserSessionManager,
  browserTabManager,
  browserAgentManager,
  browserDownloadManager
} from '../browser'
import {
  webSearchService,
  webPageExtractor,
  browserScreenshotService,
  researchCollectionManager
} from '../research'

let mainDocExtractionService: DocumentExtractionService | null = null
function getDocService(): DocumentExtractionService {
  if (!mainDocExtractionService) {
    mainDocExtractionService = new DocumentExtractionService()
  }
  return mainDocExtractionService
}

export function createMainToolDispatcher(): ToolDispatcher {
  const dispatcher = new ToolDispatcher()

  // Connect documents:extract_text to the genuine DocumentExtractionService
  dispatcher.registerHandler('documents:extract_text', async (input: { filePath: string; maxChars?: number }) => {
    const docService = getDocService()
    const fileName = input.filePath.split(/[\\/]/).pop() || 'document'
    const result = await docService.extract('doc_' + Date.now(), fileName, input.filePath)
    const text = input.maxChars && result.text.length > input.maxChars
      ? result.text.slice(0, input.maxChars)
      : result.text
    return {
      text,
      format: result.format,
      pageCount: result.pageCount,
      charCount: text.length,
      isTruncated: Boolean(input.maxChars && result.text.length > input.maxChars)
    }
  })

  // Step 28: Connect system awareness tools to genuine main telemetry managers
  dispatcher.registerHandler('telemetry:get_system_health', async (input = {}) => {
    return await systemTelemetryManager.getSystemHealth(input)
  })

  dispatcher.registerHandler('system:list_installed_apps', async (input = {}) => {
    return await installedAppDiscoveryManager.getInstalledApps(input)
  })

  dispatcher.registerHandler('system:list_windows', async (input = {}) => {
    return await windowDiscoveryManager.getDesktopWindows(input)
  })

  // Step 29: Connect filesystem and clipboard tools to genuine main managers
  dispatcher.registerHandler('filesystem:list_directory', async (input) => {
    return await fileOperationsManager.listDirectory(input)
  })

  dispatcher.registerHandler('filesystem:get_metadata', async (input: { rootPath: string; filePath: string }) => {
    return await fileOperationsManager.getFileMetadata(input.rootPath, input.filePath)
  })

  dispatcher.registerHandler('filesystem:search_files', async (input) => {
    return await fileOperationsManager.searchFiles(input)
  })

  dispatcher.registerHandler('filesystem:read_text_file', async (input) => {
    return await fileOperationsManager.readTextFile(input)
  })

  dispatcher.registerHandler('filesystem:create_file', async (input) => {
    return await fileOperationsManager.createFile(input)
  })

  dispatcher.registerHandler('filesystem:copy_file', async (input) => {
    return await fileOperationsManager.copyFile(input)
  })

  dispatcher.registerHandler('filesystem:move_file', async (input) => {
    return await fileOperationsManager.moveFile(input)
  })

  dispatcher.registerHandler('filesystem:organize_preview', async (input) => {
    return await fileOrganizationManager.createOrganizationPlan(input)
  })

  dispatcher.registerHandler('filesystem:organize_apply', async (input) => {
    return await fileOrganizationManager.applyOrganizationPlan(input)
  })

  dispatcher.registerHandler('filesystem:organize_undo', async (input) => {
    return await fileOrganizationManager.undoOrganization(input)
  })

  dispatcher.registerHandler('clipboard:read_text', async (input: { maxChars?: number } = {}) => {
    return clipboardManager.readText(input.maxChars)
  })

  dispatcher.registerHandler('clipboard:write_text', async (input: { text: string }) => {
    return clipboardManager.writeText(input)
  })

  // Step 30: Connect desktop interaction and system operations to genuine main managers
  dispatcher.registerHandler('desktop:focus_window', async (input) => {
    return await desktopInteractionManager.focusWindow(input.target)
  })

  dispatcher.registerHandler('desktop:send_key_action', async (input) => {
    return await desktopInteractionManager.sendKeyAction(input)
  })

  dispatcher.registerHandler('desktop:send_text', async (input) => {
    return await desktopInteractionManager.sendText(input)
  })

  dispatcher.registerHandler('desktop:send_click', async (input) => {
    return await desktopInteractionManager.sendClick(input)
  })

  dispatcher.registerHandler('desktop:send_scroll', async (input) => {
    return await desktopInteractionManager.sendScroll(input)
  })

  dispatcher.registerHandler('desktop:emergency_stop', async () => {
    return desktopInteractionManager.emergencyStop()
  })

  dispatcher.registerHandler('desktop:undo_last_action', async (input = {}) => {
    return await desktopInteractionManager.undoLastAction(input)
  })

  dispatcher.registerHandler('system:open_path', async (input) => {
    return await systemOperationManager.openPath(input)
  })

  dispatcher.registerHandler('system:show_in_folder', async (input) => {
    return await systemOperationManager.showInFolder(input)
  })

  dispatcher.registerHandler('system:open_external_url', async (input) => {
    return await systemOperationManager.openExternalUrl(input)
  })

  dispatcher.registerHandler('system:alert_beep', async () => {
    return systemOperationManager.systemAlertBeep()
  })

  dispatcher.registerHandler('system:get_display_metrics', async () => {
    return systemOperationManager.getDisplayMetrics()
  })

  // Step 31: Connect browser services to genuine main managers
  dispatcher.registerHandler('browser:create_session', async (input = {}) => {
    return browserSessionManager.createSession(input)
  })

  dispatcher.registerHandler('browser:create_tab', async (input = {}) => {
    return await browserTabManager.createTab(input)
  })

  dispatcher.registerHandler('browser:navigate', async (input) => {
    return await browserTabManager.navigateTab(input)
  })

  dispatcher.registerHandler('browser:switch_tab', async (input) => {
    return browserTabManager.switchTab(input.tabId)
  })

  dispatcher.registerHandler('browser:close_tab', async (input) => {
    return browserTabManager.closeTab(input.tabId)
  })

  dispatcher.registerHandler('browser:get_tab_state', async (input) => {
    return browserTabManager.getTabState(input.tabId)
  })

  dispatcher.registerHandler('browser:list_tabs', async (input = {}) => {
    return { tabs: browserTabManager.listTabs(input?.sessionId) }
  })

  dispatcher.registerHandler('browser:reload', async (input) => {
    return browserTabManager.reloadTab(input.tabId)
  })

  dispatcher.registerHandler('browser:stop', async (input) => {
    return browserTabManager.stopTab(input.tabId)
  })

  dispatcher.registerHandler('browser:go_back', async (input) => {
    return browserTabManager.goBack(input.tabId)
  })

  dispatcher.registerHandler('browser:go_forward', async (input) => {
    return browserTabManager.goForward(input.tabId)
  })

  dispatcher.registerHandler('browser:clear_session', async (input) => {
    return await browserSessionManager.clearSessionData(input)
  })

  // Step 33: Connect browser automation & download management tools to genuine main managers
  dispatcher.registerHandler('browser:inspect_page', async (input) => {
    return await browserAgentManager.inspectPage(input)
  })

  dispatcher.registerHandler('browser:click_element', async (input) => {
    return await browserAgentManager.clickElement(input)
  })

  dispatcher.registerHandler('browser:scroll_page', async (input) => {
    return await browserAgentManager.scrollPage(input)
  })

  dispatcher.registerHandler('browser:fill_field', async (input) => {
    return await browserAgentManager.fillField(input)
  })

  dispatcher.registerHandler('browser:select_option', async (input) => {
    return await browserAgentManager.selectOption(input)
  })

  dispatcher.registerHandler('browser:review_form', async (input) => {
    return await browserAgentManager.reviewForm(input)
  })

  dispatcher.registerHandler('browser:submit_form', async (input) => {
    return await browserAgentManager.submitForm(input)
  })

  dispatcher.registerHandler('browser:manage_downloads', async (input: { action: string; downloadId?: string }) => {
    if (input.action === 'list') {
      return { downloads: browserDownloadManager.listDownloads() }
    } else if (input.action === 'get') {
      if (!input.downloadId) throw new Error('downloadId is required for action=get')
      const item = browserDownloadManager.getDownload(input.downloadId)
      if (!item) throw new Error(`Download ${input.downloadId} not found`)
      return item
    } else if (input.action === 'cancel') {
      if (!input.downloadId) throw new Error('downloadId is required for action=cancel')
      return browserDownloadManager.cancelDownload({ downloadId: input.downloadId })
    }
    throw new Error(`Unsupported action: ${input.action}`)
  })

  // Step 32: Connect research services to genuine main managers
  dispatcher.registerHandler('research:web_search', async (input, context) => {
    const res = await webSearchService.search(input)
    const convId = input.conversationId || context?.conversationId
    if (convId) {
      researchCollectionManager.addSearchResults(convId, input.query, res.results)
    }
    return res
  })

  dispatcher.registerHandler('research:extract_tab_content', async (input, context) => {
    const record = await webPageExtractor.extractTabContent(input)
    const convId = input.conversationId || context?.conversationId
    if (convId) {
      researchCollectionManager.addSourceRecord(convId, record)
    }
    return record
  })

  dispatcher.registerHandler('research:extract_url_content', async (input, context) => {
    const record = await webPageExtractor.extractTabContent(input)
    const convId = input.conversationId || context?.conversationId
    if (convId) {
      researchCollectionManager.addSourceRecord(convId, record)
    }
    return record
  })

  dispatcher.registerHandler('research:capture_tab_screenshot', async (input, context) => {
    const record = await browserScreenshotService.captureTabScreenshot(input)
    const convId = input.conversationId || context?.conversationId
    if (convId) {
      researchCollectionManager.addScreenshotRecord(convId, record)
    }
    return record
  })

  dispatcher.registerHandler('research:manage_collection', async (input, context) => {
    const convId = input.conversationId || context?.conversationId
    return researchCollectionManager.manageCollection({ ...input, conversationId: convId })
  })

  dispatcher.registerHandler('research:validate_citations', async (input, context) => {
    const convId = input.conversationId || context?.conversationId
    return researchCollectionManager.validateCitations({ ...input, conversationId: convId })
  })

  return dispatcher
}

export const mainToolDispatcher = createMainToolDispatcher()

export const mainExecutionEngine = new TaskExecutionEngine(
  mainToolRegistry,
  mainToolDispatcher,
  authorizer
)

export const mainTaskPlanner = new TaskPlanner(mainToolRegistry)
