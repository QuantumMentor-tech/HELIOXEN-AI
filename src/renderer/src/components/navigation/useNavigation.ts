import { useState, useCallback } from 'react'
import { NavDestinationId, NAV_DESTINATIONS } from './types'

export interface UseNavigationReturn {
  currentDestination: NavDestinationId
  currentDestinationMeta: (typeof NAV_DESTINATIONS)[number]
  isExpanded: boolean
  navigateTo: (destination: string) => void
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
}

export function useNavigation(
  initialDestination: NavDestinationId = 'core',
  initialExpanded: boolean = false
): UseNavigationReturn {
  const [currentDestination, setCurrentDestination] = useState<NavDestinationId>(initialDestination)
  const [isExpanded, setIsExpanded] = useState<boolean>(initialExpanded)

  const isValidDestination = (id: string): id is NavDestinationId => {
    return NAV_DESTINATIONS.some((item) => item.id === id)
  }

  const navigateTo = useCallback((destination: string) => {
    if (isValidDestination(destination)) {
      setCurrentDestination(destination)
    } else {
      console.warn(`[Navigation] Invalid destination '${destination}', falling back to 'core'.`)
      setCurrentDestination('core')
    }
  }, [])

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const currentDestinationMeta =
    NAV_DESTINATIONS.find((item) => item.id === currentDestination) || NAV_DESTINATIONS[0]

  return {
    currentDestination,
    currentDestinationMeta,
    isExpanded,
    navigateTo,
    toggleExpanded,
    setExpanded: setIsExpanded
  }
}
