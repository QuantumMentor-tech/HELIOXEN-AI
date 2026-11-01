import React from 'react'

export type CardVariant = 'default' | 'panel' | 'elevated' | 'space'
export type CardBorder = 'subtle' | 'panel' | 'glow' | 'none'
export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  border?: CardBorder
  padding?: CardPadding
  isHoverable?: boolean
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-hx-card text-hx-text-primary',
  panel: 'bg-hx-panel text-hx-text-primary',
  elevated: 'bg-hx-surface-elevated text-hx-text-primary shadow-hx-elevated',
  space: 'bg-hx-space text-hx-text-primary'
}

const borderStyles: Record<CardBorder, string> = {
  subtle: 'border border-hx-border-subtle',
  panel: 'border border-hx-border-panel',
  glow: 'border border-hx-border-glow shadow-hx-glow-cyan-sm',
  none: 'border-0'
}

const paddingStyles: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7'
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  border = 'subtle',
  padding = 'md',
  isHoverable = false,
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`rounded-hx-lg transition-[background-color,border-color,box-shadow,transform] duration-fast ease-standard ${variantStyles[variant]} ${
        borderStyles[border]
      } ${paddingStyles[padding]} ${
        isHoverable
          ? 'hover:border-hx-border-glow hover:bg-hx-hover hover:shadow-hx-glow-cyan-sm active:scale-[0.99] cursor-pointer'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
