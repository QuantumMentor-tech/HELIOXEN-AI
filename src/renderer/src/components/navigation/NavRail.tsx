import React from 'react'
import {
  Cpu,
  MessageSquare,
  Database,
  Sparkles,
  Boxes,
  FileText,
  Bot,
  Globe,
  Activity,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Share2
} from 'lucide-react'
import { NavDestinationId, NAV_DESTINATIONS, NavItem } from './types'
import helioxenLogo from '../../assets/brand/helioxen-orbital-logo.png'
import { Badge } from '../ui/Badge'
import { IconButton } from '../ui/IconButton'

export interface NavRailProps {
  currentDestination: NavDestinationId
  onSelectDestination: (id: NavDestinationId) => void
  isExpanded: boolean
  onToggleExpanded: () => void
  className?: string
}

const iconMap: Record<NavDestinationId, React.ReactNode> = {
  core: <Cpu className="w-5 h-5" />,
  conversations: <MessageSquare className="w-5 h-5" />,
  memory: <Database className="w-5 h-5" />,
  visual: <Sparkles className="w-5 h-5" />,
  skills: <Boxes className="w-5 h-5" />,
  office: <FileText className="w-5 h-5" />,
  integrations: <Share2 className="w-5 h-5" />,
  character: <Bot className="w-5 h-5" />,
  monitor: <Globe className="w-5 h-5" />,
  widgets: <Activity className="w-5 h-5" />,
  settings: <Settings className="w-5 h-5" />
}

export const NavRail: React.FC<NavRailProps> = ({
  currentDestination,
  onSelectDestination,
  isExpanded,
  onToggleExpanded,
  className = ''
}) => {
  const primaryDestinations = NAV_DESTINATIONS.filter((item) => item.section === 'primary')
  const systemDestinations = NAV_DESTINATIONS.filter((item) => item.section === 'system')

  const renderNavItem = (item: NavItem) => {
    const isActive = currentDestination === item.id
    const isRoadmap = item.status === 'roadmap'

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelectDestination(item.id)}
        aria-current={isActive ? 'page' : undefined}
        title={!isExpanded ? `${item.label} (${isRoadmap ? 'Roadmap' : 'Active'})` : undefined}
        className={`group relative flex items-center w-full rounded-hx-md transition-[background-color,border-color,color,box-shadow] duration-fast ease-standard select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hx-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-hx-panel ${
          isExpanded ? 'px-3 py-2.5 space-x-3' : 'justify-center py-2.5 px-0'
        } ${
          isActive
            ? 'bg-hx-hover text-hx-cyan font-medium border border-hx-border-glow shadow-hx-glow-cyan-sm'
            : 'text-hx-text-secondary hover:text-hx-text-primary hover:bg-hx-hover border border-transparent'
        }`}
      >
        {/* Active glowing indicator pill */}
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-hx-cyan rounded-r-full shadow-hx-glow-cyan-sm animate-hx-pulse-glow"
          />
        )}

        <span className="shrink-0 inline-flex items-center justify-center">
          {iconMap[item.id]}
        </span>

        {isExpanded && (
          <div className="flex-1 flex items-center justify-between min-w-0 animate-hx-fade-in">
            <span className="truncate text-sm tracking-wide font-body">
              {item.label}
            </span>
            {isRoadmap && (
              <Badge variant="neutral" size="sm" className="ml-1.5 opacity-70">
                Plan
              </Badge>
            )}
          </div>
        )}
      </button>
    )
  }

  return (
    <nav
      aria-label="Application Navigation Rail"
      aria-expanded={isExpanded}
      className={`h-full flex flex-col justify-between bg-hx-panel border-r border-hx-border-panel transition-[width,padding] duration-deliberate ease-standard select-none z-hx-elevated ${
        isExpanded ? 'w-56 p-3' : 'w-16 p-2'
      } ${className}`}
    >
      {/* Top Header & Branding */}
      <div className="flex flex-col space-y-4">
        <div
          className={`flex items-center ${
            isExpanded ? 'justify-between px-1' : 'justify-center flex-col space-y-2'
          }`}
        >
          {/* Miniature Brand Logo */}
          <div
            className="flex items-center space-x-2 cursor-pointer"
            onClick={() => onSelectDestination('core')}
            title="Helioxen AI — Core Intelligence"
          >
            <div className="w-8 h-8 rounded-full bg-hx-space border border-hx-border-glow shadow-hx-glow-cyan-sm p-0.5 overflow-hidden flex items-center justify-center shrink-0">
              <img
                src={helioxenLogo}
                alt="Helioxen Orbital Emblem"
                className="w-full h-full object-contain"
              />
            </div>
            {isExpanded && (
              <span className="font-display font-bold text-sm text-hx-text-primary tracking-wider">
                HELIOXEN
              </span>
            )}
          </div>

          {/* Rail Collapse / Expand Toggle */}
          <IconButton
            icon={isExpanded ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            aria-label={isExpanded ? 'Collapse Navigation Rail' : 'Expand Navigation Rail'}
            size="sm"
            onClick={onToggleExpanded}
          />
        </div>

        {/* Primary Destination List */}
        <div className="flex flex-col space-y-1">
          {primaryDestinations.map(renderNavItem)}
        </div>
      </div>

      {/* Bottom System Destination List */}
      <div className="flex flex-col space-y-1 border-t border-hx-border-subtle pt-3">
        {systemDestinations.map(renderNavItem)}
      </div>
    </nav>
  )
}
