export type NavDestinationId =
  | 'core'
  | 'conversations'
  | 'memory'
  | 'skills'
  | 'character'
  | 'monitor'
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
    description: 'Persistent Semantic Knowledge & Fact Store',
    status: 'roadmap',
    section: 'primary'
  },
  {
    id: 'skills',
    label: 'Skills & Tools',
    description: 'Installed Tools, Dynamic Skills & Manifests',
    status: 'roadmap',
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
    label: 'Monitor',
    description: '3D World Globe & System Performance Telemetry',
    status: 'roadmap',
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
