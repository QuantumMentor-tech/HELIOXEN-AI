/**
 * HELIOXEN AI — Step 30: Action Catalog & Schema Validation Tests
 */

import { describe, it, expect } from 'vitest'
import {
  BUILTIN_TOOL_CATALOG,
  DesktopFocusWindowTool,
  DesktopSendKeyActionTool,
  DesktopSendTextTool,
  DesktopSendClickTool,
  DesktopSendScrollTool,
  DesktopEmergencyStopTool,
  DesktopUndoLastActionTool,
  SystemOpenPathTool,
  SystemShowInFolderTool,
  SystemOpenExternalUrlTool,
  SystemAlertBeepTool,
  SystemGetDisplayMetricsTool,
  ProhibitedShellExecuteTool
} from '../../src/shared/tools/catalog'
import { CAPABILITIES } from '../../src/shared/security/capabilities'

describe('Step 30: Action Catalog & Schema Validation', () => {
  it('registers all 12 Step 30 tools in the BUILTIN_TOOL_CATALOG', () => {
    const registeredIds = BUILTIN_TOOL_CATALOG.map((t) => t.id)

    expect(registeredIds).toContain('desktop:focus_window')
    expect(registeredIds).toContain('desktop:send_key_action')
    expect(registeredIds).toContain('desktop:send_text')
    expect(registeredIds).toContain('desktop:send_click')
    expect(registeredIds).toContain('desktop:send_scroll')
    expect(registeredIds).toContain('desktop:emergency_stop')
    expect(registeredIds).toContain('desktop:undo_last_action')
    expect(registeredIds).toContain('system:open_path')
    expect(registeredIds).toContain('system:show_in_folder')
    expect(registeredIds).toContain('system:open_external_url')
    expect(registeredIds).toContain('system:alert_beep')
    expect(registeredIds).toContain('system:get_display_metrics')
  })

  it('binds valid capability declarations matching CAPABILITIES registry', () => {
    const step30Tools = [
      DesktopFocusWindowTool,
      DesktopSendKeyActionTool,
      DesktopSendTextTool,
      DesktopSendClickTool,
      DesktopSendScrollTool,
      DesktopEmergencyStopTool,
      DesktopUndoLastActionTool,
      SystemOpenPathTool,
      SystemShowInFolderTool,
      SystemOpenExternalUrlTool,
      SystemAlertBeepTool,
      SystemGetDisplayMetricsTool
    ]

    for (const tool of step30Tools) {
      for (const capId of tool.requiredCapabilities) {
        expect(CAPABILITIES[capId], `Capability '${capId}' must exist`).toBeDefined()
        expect(CAPABILITIES[capId].status).toBe('active')
      }
    }
  })

  it('marks high-consequence tools as requiring user confirmation', () => {
    expect(DesktopSendTextTool.riskTier).toBe('high')
    expect(DesktopSendTextTool.confirmationPolicy).toBe('user_confirmation')

    expect(SystemOpenExternalUrlTool.riskTier).toBe('high')
    expect(SystemOpenExternalUrlTool.confirmationPolicy).toBe('user_confirmation')

    expect(DesktopFocusWindowTool.riskTier).toBe('low')
    expect(DesktopFocusWindowTool.confirmationPolicy).toBe('none')

    expect(DesktopEmergencyStopTool.riskTier).toBe('low')
    expect(DesktopEmergencyStopTool.confirmationPolicy).toBe('none')
  })

  it('strictly validates tool input schemas and rejects unknown properties', () => {
    // Valid target
    const validTarget = { windowId: 'win_123' }

    // Desktop focus tool
    expect(() => DesktopFocusWindowTool.inputSchema.parse({ target: validTarget })).not.toThrow()
    expect(() =>
      DesktopFocusWindowTool.inputSchema.parse({ target: validTarget, unknownField: 'attack' })
    ).toThrow()

    // Key action tool
    expect(() =>
      DesktopSendKeyActionTool.inputSchema.parse({ target: validTarget, shortcut: 'Copy' })
    ).not.toThrow()
    expect(() =>
      DesktopSendKeyActionTool.inputSchema.parse({ target: validTarget, shortcut: 'ArbitraryShellKey' })
    ).toThrow()

    // Send click tool
    expect(() =>
      DesktopSendClickTool.inputSchema.parse({ target: validTarget, x: 100, y: 150 })
    ).not.toThrow()
    expect(() =>
      DesktopSendClickTool.inputSchema.parse({ target: validTarget, x: -10, y: 150 })
    ).toThrow()
  })

  it('enforces strict prohibition on shell execution tools', () => {
    expect(ProhibitedShellExecuteTool.riskTier).toBe('prohibited')
    expect(ProhibitedShellExecuteTool.confirmationPolicy).toBe('prohibited')
    expect(ProhibitedShellExecuteTool.implementationStatus).toBe('unavailable')
    expect(ProhibitedShellExecuteTool.registrationStatus).toBe('disabled')
  })
})

