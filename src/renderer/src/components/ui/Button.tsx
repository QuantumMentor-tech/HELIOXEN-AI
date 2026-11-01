import React, { forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-hx-cyan text-hx-text-inverse hover:bg-hx-cyan-hover active:bg-hx-sky font-semibold shadow-hx-glow-cyan-sm',
  secondary:
    'bg-hx-card hover:bg-hx-hover active:bg-hx-active text-hx-text-primary border border-hx-border-panel',
  ghost:
    'bg-transparent hover:bg-hx-hover active:bg-hx-active text-hx-text-secondary hover:text-hx-text-primary',
  outline:
    'bg-transparent hover:bg-hx-hover active:bg-hx-active text-hx-cyan border border-hx-border-glow hover:border-hx-cyan',
  danger:
    'bg-hx-danger/20 hover:bg-hx-danger/30 active:bg-hx-danger/40 text-hx-danger border border-hx-danger/40'
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-2.5 py-1.5 rounded-hx-sm gap-1.5',
  md: 'text-sm px-4 py-2 rounded-hx-md gap-2',
  lg: 'text-base px-5 py-2.5 rounded-hx-lg gap-2.5'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center font-body font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-fast ease-standard select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hx-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-hx-space ${
          variantStyles[variant]
        } ${sizeStyles[size]} ${
          fullWidth ? 'w-full' : ''
        } ${
          isDisabled
            ? 'opacity-40 cursor-not-allowed pointer-events-none'
            : 'cursor-pointer active:scale-[0.98]'
        } ${className}`}
        {...props}
      >
        {isLoading ? (
          <span
            aria-hidden="true"
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0 mr-1"
          />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span className="truncate">{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'
