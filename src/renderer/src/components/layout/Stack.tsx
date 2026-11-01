import React from 'react'

export type StackDirection = 'vertical' | 'horizontal'
export type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline'
export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around'
export type StackSpacing = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: StackDirection
  align?: StackAlign
  justify?: StackJustify
  spacing?: StackSpacing
  wrap?: boolean
}

const spacingStyles: Record<StackSpacing, string> = {
  none: 'gap-0',
  xs: 'gap-1.5',
  sm: 'gap-2.5',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8'
}

const alignStyles: Record<StackAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline'
}

const justifyStyles: Record<StackJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around'
}

export const Stack: React.FC<StackProps> = ({
  direction = 'vertical',
  align = 'stretch',
  justify = 'start',
  spacing = 'md',
  wrap = false,
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`flex ${direction === 'vertical' ? 'flex-col' : 'flex-row'} ${
        alignStyles[align]
      } ${justifyStyles[justify]} ${spacingStyles[spacing]} ${
        wrap ? 'flex-wrap' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
