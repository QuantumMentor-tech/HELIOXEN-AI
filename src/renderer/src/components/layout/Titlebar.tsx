import React, { useState, useEffect } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'
import helioxenLogo from '../../assets/brand/helioxen-orbital-logo.png'
import { Badge } from '../ui/Badge'

export interface TitlebarProps {
  title?: string
  statusText?: string
  className?: string
}

export const Titlebar: React.FC<TitlebarProps> = ({
  title = 'HELIOXEN AI',
  statusText = 'STANDBY',
  className = ''
}) => {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    // Check initial native maximize state
    if (window.helioxen?.window) {
      window.helioxen.window.isMaximized().then((maximized) => {
        setIsMaximized(maximized)
      }).catch((err) => {
        console.warn('[Titlebar] Could not query initial maximize state:', err)
      })

      // Subscribe to native maximize / restore state changes
      const unsubscribe = window.helioxen.window.onMaximizedChange((maximized) => {
        setIsMaximized(maximized)
      })

      return () => {
        unsubscribe()
      }
    }
    return undefined
  }, [])

  const handleMinimize = (): void => {
    window.helioxen?.window?.minimize().catch((err) => {
      console.error('[Titlebar] Minimize error:', err)
    })
  }

  const handleMaximizeToggle = (): void => {
    window.helioxen?.window?.maximize().catch((err) => {
      console.error('[Titlebar] Maximize toggle error:', err)
    })
  }

  const handleClose = (): void => {
    window.helioxen?.window?.close().catch((err) => {
      console.error('[Titlebar] Close error:', err)
    })
  }

  return (
    <header
      role="banner"
      aria-label="Application Window Titlebar"
      className={`h-9 w-full flex items-center justify-between bg-hx-panel border-b border-hx-border-subtle select-none z-hx-titlebar text-hx-text-secondary ${className}`}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onDoubleClick={handleMaximizeToggle}
    >
      {/* 1. Left Branding Section (Drag region) */}
      <div className="flex items-center space-x-2.5 pl-3">
        <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-hx-border-glow">
          <img
            src={helioxenLogo}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-contain"
          />
        </div>
        <span className="font-display font-semibold text-xs tracking-wider text-hx-text-primary">
          {title}
        </span>
      </div>

      {/* 2. Center Draggable Area (Informational Pill) */}
      <div className="hidden sm:flex items-center space-x-2">
        <Badge variant="nominal" size="sm" isDot>
          {statusText}
        </Badge>
        <span className="text-[11px] font-mono text-hx-text-muted">
          v0.1.0-alpha.1
        </span>
      </div>

      {/* 3. Right Native Window Controls (No-Drag Region) */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Minimize Button */}
        <button
          type="button"
          onClick={handleMinimize}
          aria-label="Minimize Window"
          title="Minimize"
          className="h-full px-3.5 flex items-center justify-center text-hx-text-secondary hover:text-hx-text-primary hover:bg-hx-hover active:bg-hx-active transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-hx-cyan"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Maximize / Restore Button */}
        <button
          type="button"
          onClick={handleMaximizeToggle}
          aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
          title={isMaximized ? 'Restore' : 'Maximize'}
          className="h-full px-3.5 flex items-center justify-center text-hx-text-secondary hover:text-hx-text-primary hover:bg-hx-hover active:bg-hx-active transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-hx-cyan"
        >
          {isMaximized ? (
            <Copy className="w-3.5 h-3.5" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Close Button (Windows Standard Red Hover) */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close Application"
          title="Close"
          className="h-full px-4 flex items-center justify-center text-hx-text-secondary hover:text-white hover:bg-[#e81123] active:bg-[#c4101e] transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
