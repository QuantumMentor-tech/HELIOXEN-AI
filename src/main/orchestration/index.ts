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
import { memoryService } from '../memory'
import { productivityService } from '../productivity'
import { mediaLibraryService } from '../media'
import { visualHubService } from '../visual'
import { worldMonitorService } from '../world'
import {
  systemHealthService,
  networkMonitorService,
  weatherService
} from '../widgets'

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

  // Step 34: Connect long-term memory tools to genuine main memoryService
  dispatcher.registerHandler('memory:remember_fact', async (input, context) => {
    return await memoryService.createMemory({
      ...input,
      sourceType: 'explicit_user_request',
      sourceReference: context?.conversationId
    })
  })

  dispatcher.registerHandler('memory:retrieve_relevant', async (input) => {
    return memoryService.retrieveMemories(input)
  })

  dispatcher.registerHandler('memory:propose_suggestion', async (input, context) => {
    return memoryService.proposeSuggestion({
      ...input,
      sourceReference: context?.conversationId
    })
  })

  // Step 35: Connect productivity tools to genuine main productivityService
  dispatcher.registerHandler('notes:create', async (input) => {
    const note = productivityService.createNote({
      ...input,
      sourceAttribution: 'assistant_command'
    })
    return { id: note.id, title: note.title, createdAt: note.createdAt }
  })

  dispatcher.registerHandler('notes:search', async (input) => {
    const notes = productivityService.listNotes(input)
    return { notes, totalCount: notes.length }
  })

  dispatcher.registerHandler('tasks:create', async (input) => {
    const task = productivityService.createTask({
      ...input,
      sourceAttribution: 'assistant_command'
    })
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority
    }
  })

  dispatcher.registerHandler('tasks:list', async (input) => {
    const tasks = productivityService.listTasks(input)
    return { tasks, totalCount: tasks.length }
  })

  dispatcher.registerHandler('tasks:complete', async (input) => {
    return productivityService.completeTaskByTitle(input)
  })

  dispatcher.registerHandler('reminders:create', async (input) => {
    const rem = productivityService.createReminder({
      title: input.title,
      description: input.description,
      dueAt: input.dueAt,
      timeZone: input.timeZone,
      recurrence: input.frequency ? { frequency: input.frequency } : undefined,
      sourceAttribution: 'assistant_command'
    })
    return {
      id: rem.id,
      title: rem.title,
      dueAt: rem.dueAt,
      status: rem.status
    }
  })

  dispatcher.registerHandler('reminders:manage', async (input) => {
    let rem
    if (input.action === 'snooze') {
      rem = productivityService.snoozeReminder({
        id: input.id,
        durationMinutes: input.durationMinutes
      })
    } else if (input.action === 'dismiss') {
      rem = productivityService.dismissReminder({ id: input.id })
    } else {
      rem = productivityService.cancelReminder({ id: input.id })
    }
    return { id: rem.id, status: rem.status, dueAt: rem.dueAt }
  })

  dispatcher.registerHandler('calendar:list_events', async (input) => {
    const events = productivityService.listCalendarEvents(input)
    return { events, totalCount: events.length }
  })

  dispatcher.registerHandler('calendar:create_event', async (input) => {
    const ev = await productivityService.createCalendarEvent({
      ...input,
      providerId: 'local'
    })
    return { id: ev.id, title: ev.title, startAt: ev.startAt, endAt: ev.endAt }
  })

  dispatcher.registerHandler('calendar:modify_external_event', async (input) => {
    if (input.action === 'delete') {
      const res = await productivityService.deleteCalendarEvent({
        id: input.id,
        recurrenceScope: input.recurrenceScope,
        humanConfirmed: input.humanConfirmed ?? true
      })
      return { success: res.deleted, id: input.id, action: 'delete' }
    }
    const updated = await productivityService.updateCalendarEvent({
      id: input.id,
      title: input.title,
      startAt: input.startAt,
      endAt: input.endAt,
      recurrenceScope: input.recurrenceScope,
      humanConfirmed: input.humanConfirmed ?? true
    })
    return { success: true, id: updated.id, action: 'update' }
  })

  dispatcher.registerHandler('briefing:generate', async (input) => {
    const report = await productivityService.generateDailyBriefing({
      dateKey: input.dateKey,
      forceRegenerate: input.forceRegenerate ?? true,
      mode: 'manual'
    })
    return {
      id: report.id,
      dateKey: report.dateKey,
      summaryText: report.summaryText,
      isEmpty: report.isEmpty
    }
  })

  // Step 36: Connect media gallery tools to genuine main mediaLibraryService
  dispatcher.registerHandler('media:list_assets', async (input) => {
    const res = mediaLibraryService.listAssets(input)
    return { assets: res.assets, totalCount: res.totalCount }
  })

  dispatcher.registerHandler('media:update_metadata', async (input) => {
    const updated = mediaLibraryService.updateAssetMetadata(input)
    return {
      id: updated.id,
      displayName: updated.displayName,
      favorite: updated.favorite
    }
  })

  dispatcher.registerHandler('media:manage_collections', async (input) => {
    if (input.action === 'list') {
      return { success: true, collections: mediaLibraryService.listCollections() }
    }
    if (input.action === 'create') {
      const col = mediaLibraryService.createCollection({ name: input.name || 'New Collection' })
      return { success: true, collection: col }
    }
    if (input.action === 'delete' && input.collectionId) {
      const res = mediaLibraryService.deleteCollection({ id: input.collectionId })
      return { success: res.deleted }
    }
    if (
      (input.action === 'add_assets' || input.action === 'remove_assets') &&
      input.collectionId &&
      input.assetIds
    ) {
      const col = mediaLibraryService.modifyCollectionMembership({
        collectionId: input.collectionId,
        assetIds: input.assetIds,
        action: input.action === 'add_assets' ? 'add' : 'remove'
      })
      return { success: true, collection: col }
    }
    return { success: false }
  })

  dispatcher.registerHandler('media:remove_asset', async (input) => {
    return mediaLibraryService.removeAssetFromLibrary({ id: input.id })
  })

  dispatcher.registerHandler('media:delete_managed_asset', async (input) => {
    return mediaLibraryService.deleteManagedAssetPermanently({
      id: input.id,
      confirmPermanentDelete: input.confirmPermanentDelete ?? true
    })
  })

  // Step 37: Connect VisualHub tools to genuine main visualHubService
  dispatcher.registerHandler('visual:render_mermaid', async (input) => {
    const res = visualHubService.validateAndRenderMermaid({
      source: input.sourceText ?? input.source ?? ''
    })
    return {
      valid: res.valid,
      diagramType: res.diagramType ?? 'unknown',
      nodeCount: res.nodeCount,
      edgeCount: res.edgeCount,
      diagnostics: res.diagnostics,
      svgMarkup: res.svgMarkup ?? undefined
    }
  })

  dispatcher.registerHandler('visual:export_diagram', async (input) => {
    const res = visualHubService.exportDiagram({
      source: input.sourceText ?? input.source ?? '',
      format: input.format,
      suggestedFileName: input.title ?? 'Untitled-Diagram',
      targetFilePath: input.destinationPath,
      overwriteExisting: input.conflictPolicy === 'overwrite'
    })
    return {
      exported: res.exported,
      format: res.format,
      destinationPath: res.filePath ?? '',
      fileName: res.filePath ? res.filePath.split(/[\\/]/).pop() ?? '' : '',
      sizeBytes: res.byteSize
    }
  })

  dispatcher.registerHandler('visual:generate_image', async (input) => {
    const outputFormatMap: Record<string, 'image/png' | 'image/jpeg' | 'image/webp'> = {
      png: 'image/png',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      'image/png': 'image/png',
      'image/jpeg': 'image/jpeg',
      'image/webp': 'image/webp'
    }
    const job = await visualHubService.generateImage({
      providerId: input.providerId,
      modelId: input.modelId,
      prompt: input.prompt,
      aspectRatio: input.aspectRatio ?? '1:1',
      resolution: input.resolutionTier ?? input.sizePreset,
      quality: input.quality === 'standard' ? 'auto' : input.quality,
      outputFormat: outputFormatMap[input.outputFormat ?? 'png'] ?? 'image/png',
      background: input.transparentBackground ? 'transparent' : 'auto',
      numberOfImages: 1,
      referenceAssetIds: [],
      externalTransmissionConfirmed: input.externalTransmissionConfirmed ?? true
    })
    return {
      id: job.jobId,
      status: job.state,
      providerId: job.providerId,
      modelId: job.modelId,
      candidates: job.candidates
    }
  })

  dispatcher.registerHandler('visual:save_to_gallery', async (input) => {
    const res = await visualHubService.saveGeneratedImageToGallery({
      candidateId: input.candidateId,
      displayName: input.displayName ?? 'Generated Image',
      tags: input.tags ?? [],
      favorite: input.favorite ?? false
    })
    return {
      saved: res.saved,
      candidateId: res.candidateId,
      mediaAssetId: res.asset.id
    }
  })

  // Step 38: Connect World Monitor tools to genuine main worldMonitorService
  dispatcher.registerHandler('world:query_news_feed', async (input) => {
    const res = worldMonitorService.queryFeedAndMarkers({
      searchQuery: input.searchQuery,
      category: input.category ?? 'all',
      regionId: input.regionId ?? 'all',
      pageSize: input.pageSize ?? 20
    })
    return {
      totalMatchingCount: res.totalMatchingCount,
      articles: res.articles,
      markers: res.markers,
      freshnessState: res.freshnessState
    }
  })

  dispatcher.registerHandler('world:search_locations', async (input) => {
    return worldMonitorService.searchLocations({
      query: input.query,
      limit: input.limit ?? 10
    })
  })

  dispatcher.registerHandler('world:refresh_news_feed', async (input) => {
    const res = await worldMonitorService.refreshNewsFeed({
      searchQuery: input.searchQuery,
      forceRefresh: input.forceRefresh ?? false
    })
    return {
      refreshedAt: res.refreshedAt,
      freshnessState: res.freshnessState,
      totalArticles: res.totalArticles,
      newArticlesCount: res.newArticlesCount,
      warnings: res.warnings
    }
  })

  // Step 39: Connect System Health, Network Monitor, and Weather widgets tools
  dispatcher.registerHandler('widgets:get_system_health', async (input) => {
    return await systemHealthService.getSnapshot(input.sampleDurationMs ?? 100)
  })

  dispatcher.registerHandler('widgets:run_network_diagnostic', async (input) => {
    return await networkMonitorService.runDiagnostic({
      targetUrl: input.targetUrl,
      timeoutMs: input.timeoutMs
    })
  })

  dispatcher.registerHandler('widgets:get_weather_forecast', async (input) => {
    return await weatherService.getForecast({
      temperatureUnit: input.temperatureUnit,
      windSpeedUnit: input.windSpeedUnit,
      forceRefresh: input.forceRefresh
    })
  })

  // Step 40: Connect Agent Town and Dynamic Skills tools
  dispatcher.registerHandler('agents:list_available', async (input) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { agentTownService } = require('../agents')
    const agents = agentTownService.listAgents(input?.category)
    return {
      agents: agents.map((a: { id: string; name: string; role: string; status: string; enabled: boolean }) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        status: a.status,
        enabled: a.enabled
      }))
    }
  })

  dispatcher.registerHandler('skills:execute_skill', async (input) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { agentTownService } = require('../agents')
    const res = await agentTownService.executeSkill(input.skillId, input.parameters ?? {})
    return {
      success: res.success,
      skillId: res.skillId,
      outputs: res.stepResults,
      durationMs: res.durationMs,
      error: res.error
    }
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
