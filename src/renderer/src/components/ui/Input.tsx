import React, { forwardRef, useId } from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  errorMessage?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      errorMessage,
      leftIcon,
      rightIcon,
      id,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const isError = Boolean(errorMessage)

    return (
      <div className="w-full flex flex-col space-y-1.5 font-body">
        {label && (
          <label
            htmlFor={inputId}
            className={`text-xs font-medium tracking-wide ${
              disabled ? 'text-hx-text-muted cursor-not-allowed' : 'text-hx-text-secondary'
            }`}
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div
              aria-hidden="true"
              className="absolute left-3 flex items-center pointer-events-none text-hx-text-muted"
            >
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={isError}
            aria-describedby={
              isError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            className={`w-full bg-hx-card text-hx-text-primary text-sm rounded-hx-md transition-[border-color,box-shadow,background-color] duration-fast ease-standard placeholder:text-hx-text-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-hx-space ${
              leftIcon ? 'pl-9' : 'pl-3.5'
            } ${rightIcon ? 'pr-9' : 'pr-3.5'} py-2 ${
              isError
                ? 'border border-hx-danger focus:ring-hx-danger shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                : 'border border-hx-border-panel focus:border-hx-cyan focus:ring-hx-cyan focus:shadow-hx-glow-cyan-sm'
            } ${
              disabled
                ? 'opacity-40 cursor-not-allowed bg-hx-space'
                : 'hover:border-hx-border-glow'
            } ${className}`}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 flex items-center text-hx-text-muted">
              {rightIcon}
            </div>
          )}
        </div>

        {isError && (
          <p id={`${inputId}-error`} className="text-xs text-hx-danger font-medium animate-hx-fade-in">
            {errorMessage}
          </p>
        )}

        {!isError && helperText && (
          <p id={`${inputId}-helper`} className="text-xs text-hx-text-muted animate-hx-fade-in">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
