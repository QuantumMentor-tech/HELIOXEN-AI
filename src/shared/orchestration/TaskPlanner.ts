/**
 * HELIOXEN AI — Step 26: Task Planner
 * Converts authorized user requests into validated, structured multi-step plans.
 * Preserves the direct conversation path for conversational queries without tools.
 */

import { ToolRegistry } from '../tools'
import { PlanValidator } from './PlanValidator'
import {
  DEFAULT_PLANNER_LIMITS,
  PlannerLimits,
  PlanStep,
  TaskPlan,
  TaskPlannerRequest,
  TaskPlannerResponse
} from './types'

export class TaskPlanner {
  private readonly toolRegistry: ToolRegistry
  private readonly validator: PlanValidator
  private readonly limits: PlannerLimits

  constructor(toolRegistry: ToolRegistry, limits: PlannerLimits = DEFAULT_PLANNER_LIMITS) {
    this.toolRegistry = toolRegistry
    this.validator = new PlanValidator(toolRegistry, limits)
    this.limits = limits
  }

  /**
   * Evaluates user request and produces a structured plan.
   * If no tools are required, returns requiresTools: false.
   */
  public planTask(request: TaskPlannerRequest): TaskPlannerResponse {
    const taskId = request.taskId || `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const normalizedPrompt = request.userPrompt.trim().toLowerCase()

    // 1. Determine if request requires tools or is direct conversational
    if (this.isDirectConversational(normalizedPrompt)) {
      const plan: TaskPlan = {
        id: planId,
        taskId,
        conversationId: request.conversationId,
        version: '1.0.0',
        intent: request.userPrompt,
        requiresTools: false,
        steps: [],
        createdAt: Date.now()
      }
      return {
        taskId,
        plan,
        requiresTools: false
      }
    }

    // 2. Identify candidate tool proposals from user request
    const candidateSteps = this.synthesizeCandidateSteps(request.userPrompt, request.conversationId)

    // Check if ambiguity / missing parameters detected
    if (candidateSteps.clarificationNeeded) {
      const plan: TaskPlan = {
        id: planId,
        taskId,
        conversationId: request.conversationId,
        version: '1.0.0',
        intent: request.userPrompt,
        requiresTools: true,
        clarificationNeeded: candidateSteps.clarificationNeeded,
        steps: [],
        createdAt: Date.now()
      }
      return {
        taskId,
        plan,
        requiresTools: true,
        clarificationNeeded: candidateSteps.clarificationNeeded
      }
    }

    const plan: TaskPlan = {
      id: planId,
      taskId,
      conversationId: request.conversationId,
      version: '1.0.0',
      intent: request.userPrompt,
      requiresTools: candidateSteps.steps.length > 0,
      steps: candidateSteps.steps,
      createdAt: Date.now()
    }

    // 3. Validate generated plan via PlanValidator
    const validation = this.validator.validate(plan)
    if (!validation.valid) {
      return {
        taskId,
        plan,
        requiresTools: true,
        clarificationNeeded: `Proposed plan could not be validated: ${validation.errors.join('; ')}`
      }
    }

    return {
      taskId,
      plan,
      requiresTools: true
    }
  }

  /**
   * Determines if a query can be answered via direct conversational LLM response without tools.
   */
  private isDirectConversational(prompt: string): boolean {
    const toolKeywords = [
      'time',
      'clock',
      'context summary',
      'workspace summary',
      'active context',
      'extract text',
      'read document',
      'parse pdf',
      'parse docx',
      'screen sources',
      'capture sources',
      'display sources',
      'list models',
      'available models',
      'ai models',
      'run command',
      'execute shell',
      'bash',
      'powershell'
    ]

    return !toolKeywords.some((kw) => prompt.includes(kw))
  }

  /**
   * Synthesizes candidate plan steps from registered tool capabilities.
   */
  private synthesizeCandidateSteps(
    prompt: string,
    conversationId: string
  ): { steps: PlanStep[]; clarificationNeeded?: string } {
    const lower = prompt.toLowerCase()
    const steps: PlanStep[] = []

    // Prohibited tool attempt detection
    if (lower.includes('run command') || lower.includes('execute shell') || lower.includes('powershell') || lower.includes('bash')) {
      return {
        steps: [],
        clarificationNeeded: 'Arbitrary shell and command execution is strictly prohibited by application security policy.'
      }
    }

    // Tool: system:get_time
    if (lower.includes('time') || lower.includes('clock')) {
      let timezone: string | undefined
      if (lower.includes('utc')) timezone = 'UTC'
      else if (lower.includes('tokyo')) timezone = 'Asia/Tokyo'
      else if (lower.includes('london')) timezone = 'Europe/London'
      else if (lower.includes('new york')) timezone = 'America/New_York'

      steps.push({
        id: 'step_system_time',
        toolId: 'system:get_time',
        description: 'Retrieve current system time and timezone',
        input: timezone ? { timezone } : {},
        dependencies: []
      })
    }

    // Tool: workspace:get_context_summary
    if (lower.includes('context summary') || lower.includes('workspace summary') || lower.includes('active context')) {
      // If previous step exists, depend on it sequentially
      const lastStep = steps[steps.length - 1]
      steps.push({
        id: 'step_workspace_summary',
        toolId: 'workspace:get_context_summary',
        description: 'Retrieve multimodal context statistics for active workspace',
        input: { conversationId },
        dependencies: lastStep ? [lastStep.id] : []
      })
    }

    // Tool: models:list_available
    if (lower.includes('list models') || lower.includes('available models') || lower.includes('ai models')) {
      let provider: string | undefined
      if (lower.includes('gemini')) provider = 'google-gemini'
      else if (lower.includes('openai')) provider = 'openai'

      const lastStep = steps[steps.length - 1]
      steps.push({
        id: 'step_list_models',
        toolId: 'models:list_available',
        description: 'Enumerate registered AI models and capability tiers',
        input: provider ? { provider } : {},
        dependencies: lastStep ? [lastStep.id] : []
      })
    }

    // Tool: media:get_capture_sources
    if (lower.includes('screen sources') || lower.includes('capture sources') || lower.includes('display sources')) {
      const lastStep = steps[steps.length - 1]
      steps.push({
        id: 'step_capture_sources',
        toolId: 'media:get_capture_sources',
        description: 'Enumerate desktop displays and window sources for capture',
        input: {},
        dependencies: lastStep ? [lastStep.id] : []
      })
    }

    // Tool: documents:extract_text
    if (lower.includes('extract text') || lower.includes('read document') || lower.includes('parse pdf') || lower.includes('parse docx')) {
      // Check for file path
      const pathMatch = prompt.match(/(?:from|file|path)\s+["']?([^"'\s]+\.[a-zA-Z0-9]+)["']?/i)
      if (!pathMatch) {
        return {
          steps: [],
          clarificationNeeded: 'Please specify the file path of the document you would like to extract text from.'
        }
      }

      const lastStep = steps[steps.length - 1]
      steps.push({
        id: 'step_extract_doc',
        toolId: 'documents:extract_text',
        description: `Extract text from document: ${pathMatch[1]}`,
        input: { filePath: pathMatch[1] },
        dependencies: lastStep ? [lastStep.id] : []
      })
    }

    return { steps }
  }
}
