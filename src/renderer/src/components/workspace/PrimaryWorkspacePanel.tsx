import React from 'react'
import {
  Sparkles,
  Sliders,
  PanelRightOpen,
  PanelRightClose,
  Layout,
  Terminal,
  Layers,
  ArrowRight,
  AlertTriangle,
  Monitor,
  CheckCircle2,
  Cpu,
  MessageSquare,
  Mic,
  ShieldCheck
} from 'lucide-react'
import { NavDestinationId, NavItem } from '../navigation/types'
import { Header } from '../layout/Header'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { AiCoreVisualizer } from '../core/AiCoreVisualizer'
import { AiCoreState } from '../core/types'
import { ConversationPanel } from '../conversation/ConversationPanel'
import { ConversationMessage } from '../conversation/types'
import { ProviderSettingsPanel } from '../settings/ProviderSettingsPanel'
import helioxenLogo from '../../assets/brand/helioxen-orbital-logo.png'

export interface PrimaryWorkspacePanelProps {
  currentDestination: NavDestinationId
  currentDestinationMeta: NavItem
  onNavigate: (id: NavDestinationId) => void
  isContextOpen: boolean
  onToggleContext: () => void
  aiCoreState: AiCoreState
  onSetAiCoreState: (state: AiCoreState) => void
  messages: ConversationMessage[]
  onSendMessage: (content: string) => void
  onClearMessages: () => void
  className?: string
}

const availableCoreStates: AiCoreState[] = [
  'idle',
  'listening',
  'thinking',
  'speaking',
  'executing',
  'awaiting-confirmation',
  'disconnected',
  'error'
]

export const PrimaryWorkspacePanel: React.FC<PrimaryWorkspacePanelProps> = ({
  currentDestination,
  currentDestinationMeta,
  onNavigate,
  isContextOpen,
  onToggleContext,
  aiCoreState,
  onSetAiCoreState,
  messages,
  onSendMessage,
  onClearMessages,
  className = ''
}) => {
  return (
    <main
      id="primary-workspace"
      aria-label="Primary Intelligence Workspace"
      className={`flex-1 min-w-0 h-full flex flex-col bg-hx-space overflow-hidden ${className}`}
    >
      {/* Top Header Section */}
      <div className="px-6 py-4 border-b border-hx-border-panel bg-hx-panel/30 shrink-0">
        <Header
          title={currentDestinationMeta.label}
          subtitle={currentDestinationMeta.description}
          statusBadge={
            currentDestinationMeta.status === 'active' ? (
              <Badge variant="nominal" size="sm" isDot>
                ACTIVE WORKSPACE
              </Badge>
            ) : (
              <Badge variant="warning" size="sm" isDot>
                ROADMAP DESTINATION
              </Badge>
            )
          }
          actions={
            <div className="flex items-center space-x-2">
              <Badge variant="info" size="sm">
                Step 12 of 48
              </Badge>
              <IconButton
                icon={
                  isContextOpen ? (
                    <PanelRightClose className="w-4 h-4" />
                  ) : (
                    <PanelRightOpen className="w-4 h-4" />
                  )
                }
                aria-label={
                  isContextOpen
                    ? 'Collapse Contextual Panel'
                    : 'Expand Contextual Panel'
                }
                title={
                  isContextOpen
                    ? 'Collapse Right Context Panel'
                    : 'Expand Right Context Panel'
                }
                variant="secondary"
                size="sm"
                onClick={onToggleContext}
              />
              <IconButton
                icon={<Sliders className="w-4 h-4" />}
                aria-label="Workspace Settings"
                title="Workspace Settings"
                size="sm"
                onClick={() => onNavigate('settings')}
              />
            </div>
          }
        />
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {currentDestination === 'core' ? (
          <div className="max-w-5xl w-full mx-auto space-y-6 animate-hx-fade-in">
            {/* Top Command Center Status Card */}
            <Card variant="panel" border="glow" padding="md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-full bg-hx-space border border-hx-border-glow shadow-hx-glow-cyan-sm p-1 overflow-hidden shrink-0">
                    <img
                      src={helioxenLogo}
                      alt="Helioxen Emblem"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h2 className="text-base font-display font-semibold text-hx-cyan mb-1 flex items-center gap-2">
                      <Cpu className="w-4 h-4" />
                      Central AI Core, Conversation Panel &amp; Persistent Voice Dock
                    </h2>
                    <p className="text-xs text-hx-text-secondary leading-relaxed">
                      Distinctive Three.js WebGL orbital core visualizer, typed interaction contracts, conversation transcript architecture, and persistent voice dock.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <Badge variant="nominal" size="sm" isDot>
                    GPU PIPELINE ACTIVE
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Central Stage: Three.js 3D Orbital AI Core */}
            <Card
              variant="default"
              border="subtle"
              padding="md"
              className="relative overflow-hidden text-center py-6 flex flex-col items-center justify-center bg-hx-panel/40"
            >
              {/* 3D WebGL / 2D Canvas Core Visualizer */}
              <AiCoreVisualizer
                state={aiCoreState}
                size={240}
                ariaLabel={`HELIOXEN Central AI Core. Current State: ${aiCoreState}`}
              />

              {/* State Inspection Bar */}
              <div className="mt-4 pt-3 border-t border-hx-border-subtle/50 w-full max-w-xl">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-hx-text-muted">
                    Core Presentation State Controller
                  </span>
                  <Badge variant="info" size="sm">
                    {aiCoreState.toUpperCase()}
                  </Badge>
                </div>

                {/* State selector pills for manual test/inspection */}
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {availableCoreStates.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => onSetAiCoreState(st)}
                      aria-pressed={aiCoreState === st}
                      className={`px-2.5 py-1 rounded-hx-sm text-[10px] font-mono uppercase tracking-wider transition-all duration-fast ${
                        aiCoreState === st
                          ? 'bg-hx-hover text-hx-cyan border border-hx-border-glow shadow-hx-glow-cyan-sm font-semibold'
                          : 'bg-hx-surface/70 text-hx-text-secondary hover:text-hx-text-primary border border-transparent'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Integrated Conversation Workspace Panel */}
            <div className="h-[460px] w-full">
              <ConversationPanel
                messages={messages}
                onSendMessage={onSendMessage}
                onClearMessages={onClearMessages}
              />
            </div>

            {/* Architectural Foundation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card variant="default" border="subtle" padding="sm" isHoverable>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-display font-semibold text-hx-cyan flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    Three.js WebGL Core
                  </span>
                  <Badge variant="nominal" size="sm">
                    60 FPS
                  </Badge>
                </div>
                <h4 className="text-xs font-semibold text-hx-text-primary mb-1">
                  Orbital Geometry &amp; Shaders
                </h4>
                <p className="text-[11px] text-hx-text-secondary leading-relaxed">
                  Procedural torus rings, icosahedron core, and additive particle halos. Automatically falls back to 2D Canvas if WebGL context is lost.
                </p>
              </Card>

              <Card variant="default" border="subtle" padding="sm" isHoverable>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-display font-semibold text-hx-cyan flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Conversation Panel
                  </span>
                  <Badge variant="neutral" size="sm">
                    Safe DOM
                  </Badge>
                </div>
                <h4 className="text-xs font-semibold text-hx-text-primary mb-1">
                  Thread Transcript &amp; Composer
                </h4>
                <p className="text-[11px] text-hx-text-secondary leading-relaxed">
                  Sanitized text rendering, multiline textarea resize, keyboard submission, and truthful buffering without simulated model hallucinations.
                </p>
              </Card>

              <Card variant="default" border="subtle" padding="sm" isHoverable>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-display font-semibold text-hx-cyan flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5" />
                    Persistent Voice Dock
                  </span>
                  <Badge variant="warning" size="sm">
                    Standby
                  </Badge>
                </div>
                <h4 className="text-xs font-semibold text-hx-text-primary mb-1">
                  Shell-Level Controller
                </h4>
                <p className="text-[11px] text-hx-text-secondary leading-relaxed">
                  Anchored across all navigation views. Zero microphone permission requests or audio context capture until Step 19 audio engine activation.
                </p>
              </Card>
            </div>
          </div>
        ) : currentDestination === 'conversations' ? (
          /* Dedicated Full-Page Conversation View */
          <div className="max-w-4xl w-full mx-auto h-[640px] animate-hx-fade-in flex flex-col space-y-4">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-base font-display font-semibold text-hx-text-primary">
                  Conversation History &amp; Dialogue Workspace
                </h2>
                <p className="text-xs text-hx-text-secondary">
                  Threaded message records, token accounting, and interactive prompt drafting.
                </p>
              </div>
              <Badge variant="nominal" size="sm" isDot>
                ACTIVE VIEW
              </Badge>
            </div>

            <div className="flex-1 min-h-0">
              <ConversationPanel
                messages={messages}
                onSendMessage={onSendMessage}
                onClearMessages={onClearMessages}
              />
            </div>
          </div>
        ) : currentDestination === 'settings' ? (
          /* Provider & Model Registry Settings View (Phase 6, Step 17) */
          <div className="flex-1 overflow-y-auto px-4 py-2">
            <ProviderSettingsPanel />
          </div>
        ) : (
          /* Deliberate, Honest Roadmap Destination View */
          <div className="flex items-center justify-center h-full min-h-[360px] animate-hx-fade-in">
            <Card
              variant="panel"
              border="panel"
              padding="lg"
              className="max-w-md w-full text-center"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-hx-space border border-hx-border-glow text-hx-cyan mb-4 shadow-hx-glow-cyan-sm">
                <AlertTriangle className="w-6 h-6 text-hx-warning" />
              </div>
              <h2 className="text-lg font-display font-semibold text-hx-text-primary mb-1">
                {currentDestinationMeta.label}
              </h2>
              <p className="text-xs text-hx-warning font-mono uppercase tracking-wider mb-3">
                Roadmap Milestone • Not Yet Implemented
              </p>
              <p className="text-xs text-hx-text-secondary mb-6 leading-relaxed">
                {currentDestinationMeta.description}. Per project scope discipline, full feature modules are constructed during Phase 5, 6 &amp; 7 milestone steps.
              </p>
              <Button
                variant="primary"
                size="md"
                onClick={() => onNavigate('core')}
                leftIcon={<Sparkles className="w-4 h-4" />}
              >
                Return to Active Command Center
              </Button>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}
