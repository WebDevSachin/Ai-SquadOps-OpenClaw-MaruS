"use client";

import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  loadingText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantStyles = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const sizeStyles = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses = variantStyles[variant];
    const sizeClasses = sizeStyles[size];
    const widthClass = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${sizeClasses} ${widthClass} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {loadingText || children}
          </>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
