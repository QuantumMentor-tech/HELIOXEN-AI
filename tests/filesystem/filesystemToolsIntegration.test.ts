/**
 * HELIOXEN AI — Step 29: Filesystem & Clipboard Tools Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { mainToolRegistry } from '../../src/main/tools'
import { mainToolDispatcher, mainExecutionEngine } from '../../src/main/orchestration'
import { authorizer, consentGate } from '../../src/main/security'
import { CAPABILITIES } from '../../src/shared/security/capabilities'
import { TaskPlan } from '../../src/shared/orchestration/types'

describe('Step 29: Filesystem & Clipboard Tools Integration', () => {
  let tempBaseDir: string

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-tool-fs-'))
    fs.writeFileSync(path.join(tempBaseDir, 'test.txt'), 'Sample integration text')
  })

  afterEach(() => {
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('registers all Step 29 tools in authoritative ToolRegistry and BUILTIN_TOOL_CATALOG', () => {
    const requiredTools = [
      'filesystem:list_directory',
      'filesystem:get_metadata',
      'filesystem:search_files',
      'filesystem:read_text_file',
      'filesystem:create_file',
      'filesystem:copy_file',
      'filesystem:move_file',
      'filesystem:organize_preview',
      'filesystem:organize_apply',
      'filesystem:organize_undo',
      'clipboard:read_text',
      'clipboard:write_text'
    ]

    for (const toolId of requiredTools) {
      expect(mainToolRegistry.get(toolId)).toBeDefined()
    }

    const organizeApplyMeta = mainToolRegistry.getMetadata('filesystem:organize_apply')
    expect(organizeApplyMeta?.riskTier).toBe('high')
    expect(organizeApplyMeta?.confirmationPolicy).toBe('user_confirmation')
    expect(organizeApplyMeta?.requiredCapabilities).toContain('filesystem:organize')
  })

  it('declares corresponding security capabilities with appropriate risk tiers', () => {
    expect(CAPABILITIES['filesystem:read'].riskTier).toBe('low')
    expect(CAPABILITIES['filesystem:write'].riskTier).toBe('moderate')
    expect(CAPABILITIES['filesystem:organize'].riskTier).toBe('high')
    expect(CAPABILITIES['filesystem:organize'].requiresHumanConsent).toBe(true)
    expect(CAPABILITIES['clipboard:read'].riskTier).toBe('moderate')
    expect(CAPABILITIES['clipboard:write'].riskTier).toBe('moderate')
  })

  it('authorizes renderer access for filesystem and clipboard capabilities', () => {
    expect(() =>
      authorizer.authorize('filesystem:read', { requester: 'renderer-main-window' })
    ).not.toThrow()

    expect(() =>
      authorizer.authorize('filesystem:write', { requester: 'renderer-main-window' })
    ).not.toThrow()

    expect(() =>
      authorizer.authorize('filesystem:organize', { requester: 'renderer-main-window' })
    ).toThrow(/requires explicit user confirmation/)

    const consentReq = consentGate.createRequest('filesystem:organize', 'File organization plan')
    consentGate.resolveRequest(consentReq.requestId, true)

    expect(() =>
      authorizer.authorize('filesystem:organize', {
        requester: 'renderer-main-window',
        consentRequestId: consentReq.requestId
      })
    ).not.toThrow()

    expect(() =>
      authorizer.authorize('clipboard:read', { requester: 'renderer-main-window' })
    ).not.toThrow()
  })

  it('dispatches filesystem:read_text_file to genuine manager handler', async () => {
    const toolDef = mainToolRegistry.get('filesystem:read_text_file')!
    const context = { taskId: 'task_fs_test', stepId: 'step_1', conversationId: 'conv_1' }

    const filePath = path.join(tempBaseDir, 'test.txt')
    const result = await mainToolDispatcher.dispatch(toolDef, { rootPath: tempBaseDir, filePath }, context)

    expect(result.content).toBe('Sample integration text')
    expect(result.byteLength).toBe(23)
  })

  it('executes a task plan calling filesystem:read_text_file through mainExecutionEngine', async () => {
    const filePath = path.join(tempBaseDir, 'test.txt')
    const plan: TaskPlan = {
      id: 'plan_fs_exec',
      taskId: 'task_exec_fs',
      conversationId: 'conv_fs',
      version: '1.0.0',
      intent: 'Read text file contents safely',
      requiresTools: true,
      steps: [
        {
          id: 'step_read',
          toolId: 'filesystem:read_text_file',
          description: 'Read contents of test.txt',
          input: { rootPath: tempBaseDir, filePath },
          dependencies: []
        }
      ],
      createdAt: Date.now()
    }

    const execResult = await mainExecutionEngine.executePlan(plan)
    expect(execResult.status).toBe('completed')
    expect(execResult.stepResults['step_read'].status).toBe('completed')
    expect((execResult.stepResults['step_read'].output as any)?.content).toBe('Sample integration text')
  })
})
