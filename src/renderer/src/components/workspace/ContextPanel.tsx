import React from 'react'
import {
  PanelRightClose,
  ShieldCheck,
  Cpu,
  Layers,
  Terminal,
  Info
} from 'lucide-react'
import { Badge } from '../ui/Badge'
import { IconButton } from '../ui/IconButton'
import { Card } from '../ui/Card'

export interface ContextPanelProps {
  isOpen: boolean
  onToggle: () => void
  className?: string
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  isOpen,
  onToggle,
  className = ''
}) => {
  if (!isOpen) {
    return null
  }

  return (
    <aside
      id="contextual-workspace"
      aria-label="Contextual Intelligence Panel"
      className={`h-full w-80 shrink-0 flex flex-col bg-hx-panel border-l border-hx-border-panel transition-all duration-deliberate ease-standard select-none z-hx-base overflow-hidden ${className}`}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-hx-border-panel bg-hx-surface/40">
        <div className="flex items-center space-x-2 min-w-0">
          <Layers className="w-4 h-4 text-hx-cyan shrink-0" />
          <h2 className="text-xs font-display font-semibold text-hx-text-primary uppercase tracking-wider truncate">
            Contextual Intelligence
          </h2>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          <Badge variant="nominal" size="sm" isDot>
            STANDBY
          </Badge>
          <IconButton
            icon={<PanelRightClose className="w-4 h-4" />}
            aria-label="Collapse Contextual Panel"
            size="sm"
            variant="ghost"
            onClick={onToggle}
          />
        </div>
      </div>

      {/* Panel Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Context Status Card */}
        <Card variant="default" border="subtle" padding="sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-hx-text-muted uppercase tracking-wider">
              Session Context
            </span>
            <Badge variant="neutral" size="sm">
              Idle
            </Badge>
          </div>
          <p className="text-xs text-hx-text-secondary leading-relaxed">
            No active conversation thread or background agent execution is currently attached to this workspace.
          </p>
        </Card>

        {/* Structural Boundary Note */}
        <Card variant="panel" border="subtle" padding="sm">
          <div className="flex items-start space-x-2">
            <Info className="w-4 h-4 text-hx-cyan shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-hx-text-primary">
                Future Integration Boundary
              </h3>
              <p className="text-[11px] text-hx-text-secondary leading-relaxed">
                This panel is architecturally reserved for supporting data, tool call traces, semantic memory associations, and contextual file inspectors in Phase 4 &amp; 5 milestones.
              </p>
            </div>
          </div>
        </Card>

        {/* Environment Security Status */}
        <div className="space-y-2">
          <div className="flex items-center space-x-1.5 px-1">
            <ShieldCheck className="w-3.5 h-3.5 text-hx-nominal" />
            <span className="text-[11px] font-mono font-medium text-hx-text-muted uppercase tracking-wider">
              Security Boundary
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-hx-sm bg-hx-surface/50 border border-hx-border-subtle">
              <span className="text-hx-text-secondary">Context Isolation</span>
              <span className="text-hx-nominal font-medium">Verified Active</span>
            </div>
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-hx-sm bg-hx-surface/50 border border-hx-border-subtle">
              <span className="text-hx-text-secondary">Node Integration</span>
              <span className="text-hx-nominal font-medium">Disabled (Sandbox)</span>
            </div>
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-hx-sm bg-hx-surface/50 border border-hx-border-subtle">
              <span className="text-hx-text-secondary">Window IPC Bridge</span>
              <span className="text-hx-cyan font-medium">Validated Safe</span>
            </div>
          </div>
        </div>

        {/* Execution Trace Indicator */}
        <div className="space-y-2 pt-2 border-t border-hx-border-subtle">
          <div className="flex items-center space-x-1.5 px-1">
            <Terminal className="w-3.5 h-3.5 text-hx-text-muted" />
            <span className="text-[11px] font-mono font-medium text-hx-text-muted uppercase tracking-wider">
              Execution Trace
            </span>
          </div>

          <div className="p-2.5 rounded-hx-md bg-hx-space border border-hx-border-subtle text-[11px] font-mono text-hx-text-muted">
            <div className="flex items-center space-x-2 text-hx-text-secondary mb-1">
              <Cpu className="w-3 h-3 text-hx-cyan" />
              <span>Workspace Engine</span>
            </div>
            <div className="text-[10px] text-hx-text-muted">
              Step 11 Command Center Ready. Awaiting Step 12 Core Engine.
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 border-t border-hx-border-panel bg-hx-surface/30 flex items-center justify-between text-[10px] font-mono text-hx-text-muted">
        <span>PANEL REGION: RIGHT</span>
        <span className="text-hx-cyan">320 PX</span>
      </div>
    </aside>
  )
}
