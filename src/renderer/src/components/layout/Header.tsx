import React from 'react'

export interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  title: string
  subtitle?: string
  statusBadge?: React.ReactNode
  actions?: React.ReactNode
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  statusBadge,
  actions,
  className = '',
  ...props
}) => {
  return (
    <header
      className={`flex items-center justify-between border-b border-hx-border-subtle pb-4 mb-4 ${className}`}
      {...props}
    >
      <div className="flex flex-col space-y-1">
        <div className="flex items-center space-x-3">
          <h1 className="text-lg font-display font-semibold text-hx-text-primary tracking-wide">
            {title}
          </h1>
          {statusBadge && <div>{statusBadge}</div>}
        </div>
        {subtitle && (
          <p className="text-xs text-hx-text-secondary font-body">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center space-x-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  )
}
