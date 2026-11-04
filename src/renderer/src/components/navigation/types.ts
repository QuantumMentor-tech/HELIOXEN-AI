export type NavDestinationId =
  | 'core'
  | 'conversations'
  | 'memory'
  | 'visual'
  | 'skills'
  | 'character'
  | 'monitor'
  | 'widgets'
  | 'settings'

export type NavItemStatus = 'active' | 'roadmap' | 'disabled'

export interface NavItem {
  id: NavDestinationId
  label: string
  description: string
  status: NavItemStatus
  section: 'primary' | 'system'
}

export const NAV_DESTINATIONS: NavItem[] = [
  {
    id: 'core',
    label: 'AI Core',
    description: 'Central Command Intelligence & Active Assistant',
    status: 'active',
    section: 'primary'
  },
  {
    id: 'conversations',
    label: 'Conversations',
    description: 'Threaded Dialogue History & Context Records',
    status: 'active',
    section: 'primary'
  },
  {
    id: 'memory',
    label: 'Memory Vault',
    description: 'User Profile, Long-Term Memory & Consent-Based Personalization',
    status: 'active',
    section: 'primary'
  },
  {
    id: 'visual',
    label: 'VisualHub',
    description: 'Mermaid Diagram Studio & Capability-Aware AI Image Generation',
    status: 'active',
    section: 'primary'
  },
  {
    id: 'skills',
    label: 'Agent Town',
    description: 'Agent Town, Plugin Connectors & Dynamic Skills Studio',
    status: 'active',
    section: 'primary'
  },
  {
    id: 'character',
    label: 'Character',
    description: 'Personality Archetypes & Voice Modulation',
    status: 'roadmap',
    section: 'primary'
  },
  {
    id: 'monitor',
    label: 'World Monitor',
    description: 'Interactive 3D Globe, Geographic Maps & Source-Attributed News Intelligence',
    status: 'active',
    section: 'primary'
  },
  {
    id: 'widgets',
    label: 'System & Widgets',
    description: 'System Health, Bounded Network Diagnostics & Weather Intelligence',
    status: 'active',
    section: 'primary'
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Provider API Routes, Audio Devices & Security Vault',
    status: 'active',
    section: 'system'
  }
]
