import React from 'react'
import { Titlebar } from './Titlebar'

export interface AppShellProps {
  title?: string
  statusText?: string
  className?: string
  children: React.ReactNode
}

export const AppShell: React.FC<AppShellProps> = ({
  title = 'HELIOXEN AI',
  statusText = 'STANDBY',
  className = '',
  children
}) => {
  return (
    <div
      className={`flex h-screen w-screen flex-col overflow-hidden bg-hx-space text-hx-text-primary font-body antialiased select-none ${className}`}
    >
      {/* 1. Custom Frameless Desktop Titlebar */}
      <Titlebar title={title} statusText={statusText} />

      {/* 2. Primary Desktop Viewport Region (NavRail + Content) */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {children}
      </div>
    </div>
  )
}
