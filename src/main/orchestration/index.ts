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
import { getDocumentExtractionService } from '../index'

export function createMainToolDispatcher(): ToolDispatcher {
  const dispatcher = new ToolDispatcher()

  // Connect documents:extract_text to the genuine DocumentExtractionService
  dispatcher.registerHandler('documents:extract_text', async (input: { filePath: string; maxChars?: number }) => {
    const docService = getDocumentExtractionService()
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

  return dispatcher
}

export const mainToolDispatcher = createMainToolDispatcher()

export const mainExecutionEngine = new TaskExecutionEngine(
  mainToolRegistry,
  mainToolDispatcher,
  authorizer
)

export const mainTaskPlanner = new TaskPlanner(mainToolRegistry)
