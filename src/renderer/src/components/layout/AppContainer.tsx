import React from 'react'

export interface AppContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const AppContainer: React.FC<AppContainerProps> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`flex h-screen w-screen overflow-hidden bg-hx-space text-hx-text-primary font-body antialiased select-none ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
