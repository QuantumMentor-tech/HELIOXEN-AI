import React from 'react'

export type BadgeVariant = 'nominal' | 'warning' | 'danger' | 'info' | 'neutral'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  isDot?: boolean
  icon?: React.ReactNode
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  nominal: {
    container: 'bg-hx-nominal/15 text-hx-nominal border border-hx-nominal/30',
    dot: 'bg-hx-nominal'
  },
  warning: {
    container: 'bg-hx-warning/15 text-hx-warning border border-hx-warning/30',
    dot: 'bg-hx-warning'
  },
  danger: {
    container: 'bg-hx-danger/15 text-hx-danger border border-hx-danger/30',
    dot: 'bg-hx-danger'
  },
  info: {
    container: 'bg-hx-cyan/15 text-hx-cyan border border-hx-cyan/30',
    dot: 'bg-hx-cyan'
  },
  neutral: {
    container: 'bg-hx-card text-hx-text-secondary border border-hx-border-subtle',
    dot: 'bg-hx-text-muted'
  }
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[11px] px-2 py-0.5 rounded-full font-mono font-medium gap-1.5',
  md: 'text-xs px-2.5 py-1 rounded-full font-mono font-medium gap-2'
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'sm',
  isDot = false,
  icon,
  className = '',
  children,
  ...props
}) => {
  const styles = variantStyles[variant]

  return (
    <span
      className={`inline-flex items-center justify-center select-none ${styles.container} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {isDot && (
        <span
          aria-hidden="true"
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`}
        />
      )}
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  )
}
