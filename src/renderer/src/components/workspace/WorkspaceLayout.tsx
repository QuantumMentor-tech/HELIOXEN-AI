import React from 'react'

export interface WorkspaceLayoutProps {
  navigation: React.ReactNode
  workspace: React.ReactNode
  context?: React.ReactNode
  voiceDock?: React.ReactNode
  className?: string
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  navigation,
  workspace,
  context,
  voiceDock,
  className = ''
}) => {
  return (
    <div
      className={`flex-1 flex overflow-hidden min-h-0 w-full relative bg-hx-space ${className}`}
    >
      {/* 1. Left Region: Navigation & Workspace Access */}
      <div className="shrink-0 h-full flex flex-col z-hx-elevated">
        {navigation}
      </div>

      {/* 2. Center Region: Primary Intelligence Workspace */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden relative z-hx-base">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {workspace}
        </div>
        {voiceDock && (
          <div className="shrink-0 w-full z-hx-elevated">
            {voiceDock}
          </div>
        )}
      </div>

      {/* 3. Right Region: Contextual Intelligence Panel (Optional / Collapsible) */}
      {context && (
        <div className="shrink-0 h-full flex flex-col z-hx-base">
          {context}
        </div>
      )}
    </div>
  )
}
