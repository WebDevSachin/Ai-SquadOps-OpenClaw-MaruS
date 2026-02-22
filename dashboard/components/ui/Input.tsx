"use client";

import { forwardRef, InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      fullWidth = true,
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;
    const widthClass = fullWidth ? "w-full" : "";

    const inputClasses = `
      ${leftIcon ? "input-with-icon" : "input"}
      ${hasError ? "border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50" : ""}
      ${className}
    `;

    return (
      <div className={`${widthClass} ${className}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
              {rightIcon}
            </div>
          )}
        </div>
        {helperText && !hasError && (
          <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>
        )}
        {hasError && (
          <p className="mt-1.5 text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

// Textarea Component
interface TextareaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  fullWidth?: boolean;
  rows?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      error,
      fullWidth = true,
      rows = 4,
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;
    const widthClass = fullWidth ? "w-full" : "";

    const textareaClasses = `
      input resize-none
      ${hasError ? "border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50" : ""}
      ${className}
    `;

    return (
      <div className={`${widthClass}`}>
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={textareaClasses}
          {...props}
        />
        {helperText && !hasError && (
          <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>
        )}
        {hasError && (
          <p className="mt-1.5 text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

// Select Component
interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options: { value: string; label: string }[];
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      helperText,
      error,
      options,
      fullWidth = true,
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;
    const widthClass = fullWidth ? "w-full" : "";

    const selectClasses = `
      input appearance-none cursor-pointer
      ${hasError ? "border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50" : ""}
      ${className}
    `;

    return (
      <div className={`${widthClass}`}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={selectClasses}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
        {helperText && !hasError && (
          <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>
        )}
        {hasError && (
          <p className="mt-1.5 text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
