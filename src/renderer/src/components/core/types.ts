export type AiCoreState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'executing'
  | 'awaiting-confirmation'
  | 'disconnected'
  | 'recovering'
  | 'error'

export interface AiCoreProps {
  state?: AiCoreState
  className?: string
  size?: number
  ariaLabel?: string
  onStateClick?: (state: AiCoreState) => void
}

export interface CoreVisualizerTheme {
  primaryColor: number
  secondaryColor: number
  accentColor: number
  rotationSpeed: number
  pulseRate: number
  particleCount: number
}
