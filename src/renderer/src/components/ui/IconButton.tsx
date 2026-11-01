import React, { forwardRef } from 'react'

export type IconButtonVariant = 'ghost' | 'secondary' | 'primary' | 'danger'
export type IconButtonSize = 'sm' | 'md' | 'lg'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  'aria-label': string
  variant?: IconButtonVariant
  size?: IconButtonSize
  isActive?: boolean
  tooltip?: string
}

const variantStyles: Record<IconButtonVariant, string> = {
  ghost:
    'bg-transparent hover:bg-hx-hover active:bg-hx-active text-hx-text-secondary hover:text-hx-text-primary',
  secondary:
    'bg-hx-card hover:bg-hx-hover active:bg-hx-active text-hx-text-primary border border-hx-border-panel',
  primary:
    'bg-hx-cyan text-hx-text-inverse hover:bg-hx-cyan-hover active:bg-hx-sky shadow-hx-glow-cyan-sm',
  danger:
    'bg-hx-danger/20 hover:bg-hx-danger/30 active:bg-hx-danger/40 text-hx-danger border border-hx-danger/40'
}

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'w-7 h-7 rounded-hx-sm text-sm',
  md: 'w-9 h-9 rounded-hx-md text-base',
  lg: 'w-11 h-11 rounded-hx-lg text-lg'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      'aria-label': ariaLabel,
      variant = 'ghost',
      size = 'md',
      isActive = false,
      tooltip,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        aria-label={ariaLabel}
        title={tooltip || ariaLabel}
        disabled={disabled}
        className={`inline-flex items-center justify-center transition-[color,background-color,border-color,box-shadow,transform] duration-fast ease-standard select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hx-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-hx-space relative ${
          isActive
            ? 'bg-hx-hover text-hx-cyan border border-hx-border-glow shadow-hx-glow-cyan-sm'
            : variantStyles[variant]
        } ${sizeStyles[size]} ${
          disabled
            ? 'opacity-40 cursor-not-allowed pointer-events-none'
            : 'cursor-pointer active:scale-95'
        } ${className}`}
        {...props}
      >
        <span className="inline-flex shrink-0 items-center justify-center">{icon}</span>
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-hx-cyan rounded-r-full shadow-hx-glow-cyan-sm"
          />
        )}
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'
