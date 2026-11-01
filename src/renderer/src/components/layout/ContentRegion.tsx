import React from 'react'

export interface ContentRegionProps extends React.HTMLAttributes<HTMLDivElement> {
  scrollable?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingStyles = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8'
}

export const ContentRegion: React.FC<ContentRegionProps> = ({
  scrollable = true,
  padding = 'md',
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`flex-1 flex flex-col min-w-0 ${
        scrollable ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'
      } ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
